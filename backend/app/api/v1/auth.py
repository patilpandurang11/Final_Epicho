import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import (
    ADMIN_ROLE_NAMES,
    get_current_user,
    get_user_permissions,
    get_user_role_names,
    rate_limit,
    require_permission,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decrypt_sensitive_text,
    encrypt_sensitive_text,
    generate_totp_secret,
    get_password_hash,
    get_totp_provisioning_uri,
    verify_password,
    verify_totp_code,
)
from app.models.admin import AuditLog
from app.models.user import AdminInvitation, AuthUser, Role, UserAccount, UserProfile, UserSession
from app.schemas.auth import (
    AdminInviteRequest,
    LoginRequest,
    MFASetupResponse,
    MFAVerifyRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    TokenResponse,
    UserProfileSchema,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


def serialize_user(user: UserAccount, db: Session, include_sensitive: bool = True) -> UserResponse:
    roles = sorted(get_user_role_names(user, db))
    permissions = sorted(get_user_permissions(user, db))
    profile_data = None
    if user.profile:
        allergies = []
        health_conditions = []
        if include_sensitive:
            raw_allergies = decrypt_sensitive_text(user.profile.allergies_encrypted)
            raw_health = decrypt_sensitive_text(user.profile.health_conditions_encrypted)
            allergies = [a.strip() for a in raw_allergies.split(",") if a.strip()] if raw_allergies else []
            health_conditions = [h.strip() for h in raw_health.split(",") if h.strip()] if raw_health else []
        profile_data = UserProfileSchema(
            bio=user.profile.bio,
            diet_preference=user.profile.diet_preference,
            dietary_restrictions=user.profile.dietary_restrictions or [],
            dislikes=user.profile.dislikes or [],
            available_equipment=user.profile.available_equipment or [],
            city=user.profile.city,
            preferred_language=user.profile.preferred_language,
            health_data_consent=user.profile.health_data_consent,
            allergies=allergies,
            health_conditions=health_conditions,
        )
    return UserResponse(
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
        username=user.username,
        account_tier=user.account_tier,
        tier=user.account_tier,
        roles=roles,
        permissions=permissions,
        is_verified=user.is_verified,
        mfa_enabled=user.mfa_enabled,
        avatar_url=user.avatar_url,
        profile=profile_data,
    )


def _issue_session_tokens(user: UserAccount, request: Request, db: Session) -> tuple[str, str]:
    access_token = create_access_token(
        data={"sub": str(user.user_id), "email": user.email, "role": user.account_tier}
    )
    refresh_token = create_refresh_token(data={"sub": str(user.user_id)})
    token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
    sess = UserSession(
        user_id=user.user_id,
        refresh_token_hash=token_hash,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(sess)
    db.commit()
    return access_token, refresh_token


@router.post("/register", response_model=TokenResponse, dependencies=[Depends(rate_limit("auth_register", 20, 60))])
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    existing_user = db.query(UserAccount).filter(
        (UserAccount.email == req.email.lower()) | (UserAccount.username == req.username.lower())
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists.",
        )

    requested_tier = (req.account_tier or "registered").lower()
    # Prevent self-escalation to admin on public signup
    if requested_tier not in {"registered", "creator", "business"}:
        requested_tier = "registered"

    role = db.query(Role).filter(Role.tier == requested_tier).first() or db.query(Role).filter(Role.tier == "registered").first() or db.query(Role).first()

    user_id = uuid.uuid4()
    hashed_pw = get_password_hash(req.password)

    auth_user = AuthUser(
        id=user_id,
        email=req.email.lower(),
        encrypted_password=hashed_pw,
        raw_user_meta_data={"full_name": req.full_name, "username": req.username},
    )
    db.add(auth_user)

    new_user = UserAccount(
        user_id=user_id,
        full_name=req.full_name,
        username=req.username.lower(),
        email=req.email.lower(),
        role_id=role.role_id,
        account_tier=requested_tier,
        is_verified=False,
        status="active",
    )
    db.add(new_user)

    profile = UserProfile(
        user_id=user_id,
        diet_preference=req.diet_preference or "veg",
        city="Mumbai",
        health_data_consent=False,
    )
    db.add(profile)
    db.commit()
    db.refresh(new_user)

    access_token, refresh_token = _issue_session_tokens(new_user, request, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=86400,
        user=serialize_user(new_user, db),
    )


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit("auth_login", 30, 60))])
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(UserAccount).filter(UserAccount.email == req.email.lower()).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    auth_user = db.query(AuthUser).filter(AuthUser.id == user.user_id).first()
    if not auth_user or not auth_user.encrypted_password or not verify_password(req.password, auth_user.encrypted_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended or inactive.")

    if user.mfa_enabled and user.mfa_secret:
        if not req.mfa_code:
            challenge = create_access_token(
                data={"sub": str(user.user_id), "type": "mfa_challenge"},
                expires_delta=timedelta(minutes=5),
            )
            return TokenResponse(
                access_token="",
                mfa_required=True,
                mfa_challenge_token=challenge,
            )
        if not verify_totp_code(user.mfa_secret, req.mfa_code):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA verification code.")

    access_token, refresh_token = _issue_session_tokens(user, request, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=86400,
        user=serialize_user(user, db),
    )


@router.post("/admin-login", response_model=TokenResponse, dependencies=[Depends(rate_limit("admin_login", 20, 60))])
def admin_login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(UserAccount).filter(UserAccount.email == req.email.lower()).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrative credentials required.")

    role_names = get_user_role_names(user, db)
    if "admin" not in role_names and not (role_names & ADMIN_ROLE_NAMES):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrative credentials required.")

    auth_user = db.query(AuthUser).filter(AuthUser.id == user.user_id).first()
    if not auth_user or not verify_password(req.password, auth_user.encrypted_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid administrative credentials.")

    if user.mfa_enabled and user.mfa_secret:
        if not req.mfa_code:
            challenge = create_access_token(
                data={"sub": str(user.user_id), "type": "mfa_challenge"},
                expires_delta=timedelta(minutes=5),
            )
            return TokenResponse(
                access_token="",
                mfa_required=True,
                mfa_challenge_token=challenge,
            )
        if not verify_totp_code(user.mfa_secret, req.mfa_code):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin MFA code.")

    audit = AuditLog(
        actor_id=user.user_id,
        actor_role=user.account_tier,
        action="admin.login",
        target_table="user_accounts",
        target_id=user.user_id,
        metadata_={"ip": request.client.host if request.client else "unknown", "mfa_used": user.mfa_enabled},
    )
    db.add(audit)
    db.commit()

    access_token, refresh_token = _issue_session_tokens(user, request, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=86400,
        user=serialize_user(user, db),
    )


@router.post("/mfa/setup", response_model=MFASetupResponse)
def setup_mfa(current_user: UserAccount = Depends(get_current_user), db: Session = Depends(get_db)):
    secret = generate_totp_secret()
    current_user.mfa_secret = secret
    db.commit()
    return MFASetupResponse(
        secret=secret,
        provisioning_uri=get_totp_provisioning_uri(secret, current_user.email),
    )


@router.post("/mfa/enable")
def enable_mfa(
    req: MFAVerifyRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="Run MFA setup first.")
    if not verify_totp_code(current_user.mfa_secret, req.code):
        raise HTTPException(status_code=400, detail="Invalid 6-digit TOTP code.")
    current_user.mfa_enabled = True
    db.commit()
    return {"message": "Multi-factor authentication enabled successfully.", "mfa_enabled": True}


@router.post("/mfa/verify", response_model=TokenResponse)
def verify_mfa_challenge(req: MFAVerifyRequest, request: Request, db: Session = Depends(get_db)):
    if not req.challenge_token:
        raise HTTPException(status_code=400, detail="MFA challenge token required.")
    payload = decode_access_token(req.challenge_token)
    if not payload or payload.get("type") != "mfa_challenge":
        raise HTTPException(status_code=401, detail="Invalid or expired MFA challenge.")
    user = db.query(UserAccount).filter(UserAccount.user_id == payload.get("sub")).first()
    if not user or not user.mfa_secret or not verify_totp_code(user.mfa_secret, req.code):
        raise HTTPException(status_code=401, detail="Invalid 6-digit MFA code.")
    access_token, refresh_token = _issue_session_tokens(user, request, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=86400,
        user=serialize_user(user, db),
    )


@router.post("/admin-invite")
def invite_admin_staff(
    req: AdminInviteRequest,
    admin: UserAccount = Depends(require_permission("user.manage")),
    db: Session = Depends(get_db),
):
    role = db.query(Role).filter(Role.role_name == req.role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Admin role '{req.role_name}' not found.")
    raw_token = secrets.token_urlsafe(32)
    invite = AdminInvitation(
        email=req.email.lower(),
        target_role_id=role.role_id,
        invited_by=admin.user_id,
        token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invite)
    db.add(
        AuditLog(
            actor_id=admin.user_id,
            actor_role=admin.account_tier,
            action="admin.invite_created",
            target_table="admin_invitations",
            target_id=invite.invitation_id,
            metadata_={"email": req.email.lower(), "role_name": req.role_name},
        )
    )
    db.commit()
    return {
        "invitation_id": str(invite.invitation_id),
        "email": invite.email,
        "role_name": role.role_name,
        "invite_token": raw_token,
        "expires_at": invite.expires_at,
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: UserAccount = Depends(get_current_user), db: Session = Depends(get_db)):
    return serialize_user(current_user, db)


@router.put("/me", response_model=UserResponse)
def update_me(
    req: ProfileUpdateRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.full_name is not None:
        current_user.full_name = req.full_name
    if req.avatar_url is not None:
        current_user.avatar_url = req.avatar_url

    profile = current_user.profile
    if not profile:
        profile = UserProfile(user_id=current_user.user_id)
        db.add(profile)
        db.flush()

    if req.bio is not None:
        profile.bio = req.bio
    if req.diet_preference is not None:
        profile.diet_preference = req.diet_preference
    if req.dietary_restrictions is not None:
        profile.dietary_restrictions = req.dietary_restrictions
    if req.dislikes is not None:
        profile.dislikes = req.dislikes
    if req.available_equipment is not None:
        profile.available_equipment = req.available_equipment
    if req.city is not None:
        profile.city = req.city
    if req.preferred_language is not None:
        profile.preferred_language = req.preferred_language
    if req.health_data_consent is not None:
        profile.health_data_consent = req.health_data_consent
        profile.consent_updated_at = datetime.now(timezone.utc)
    if req.allergies is not None:
        profile.allergies_encrypted = encrypt_sensitive_text(", ".join(req.allergies))
    if req.health_conditions is not None:
        if not profile.health_data_consent and len(req.health_conditions) > 0:
            raise HTTPException(
                status_code=400,
                detail="Explicit health data consent (DPDP) is required before storing health conditions.",
            )
        profile.health_conditions_encrypted = encrypt_sensitive_text(", ".join(req.health_conditions))

    db.commit()
    db.refresh(current_user)
    return serialize_user(current_user, db)
