import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.email import EmailDeliveryError, send_action_email
from app.core.rbac import (
    ADMIN_ROLE_NAMES,
    get_current_user,
    get_user_permissions,
    get_user_role_names,
    rate_limit,
    require_permission,
    security,
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
from app.models.user import (
    AdminInvitation,
    AuthActionToken,
    AuthUser,
    Role,
    UserAccount,
    UserProfile,
    UserSession,
)
from app.schemas.auth import (
    AdminInviteAcceptRequest,
    AdminInviteRequest,
    EmailRequest,
    EmailTokenRequest,
    LogoutRequest,
    LoginRequest,
    MFASetupResponse,
    MFAVerifyRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    RegistrationResponse,
    RefreshRequest,
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
            is_private=user.profile.is_private,
            cover_image_url=user.profile.cover_image_url,
            cuisine_interests=user.profile.cuisine_interests or [],
            website_url=user.profile.website_url,
            social_links=user.profile.social_links or {},
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
    now = datetime.now(timezone.utc)
    session_id = uuid.uuid4()
    access_token = create_access_token(
        data={"sub": str(user.user_id), "sid": str(session_id)}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.user_id), "sid": str(session_id)}
    )
    token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
    sess = UserSession(
        session_id=session_id,
        user_id=user.user_id,
        refresh_token_hash=token_hash,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(sess)
    db.commit()
    return access_token, refresh_token


def _create_action_token(
    db: Session,
    user_id: uuid.UUID,
    purpose: str,
    lifetime: timedelta,
) -> str:
    now = datetime.now(timezone.utc)
    (
        db.query(AuthActionToken)
        .filter(
            AuthActionToken.user_id == user_id,
            AuthActionToken.purpose == purpose,
            AuthActionToken.used_at.is_(None),
        )
        .update({"used_at": now}, synchronize_session=False)
    )
    raw_token = secrets.token_urlsafe(32)
    db.add(
        AuthActionToken(
            user_id=user_id,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
            purpose=purpose,
            expires_at=now + lifetime,
        )
    )
    return raw_token


def _send_action_link(email: str, purpose: str, raw_token: str) -> None:
    pages = {
        "verify_email": ("verify-email", "Verify your EpiCho email"),
        "password_reset": ("reset-password", "Reset your EpiCho password"),
        "admin_invite": ("accept-admin-invite", "Your EpiCho staff invitation"),
    }
    page, subject = pages[purpose]
    action_url = (
        f"{settings.FRONTEND_BASE_URL.rstrip('/')}/{page}"
        f"?token={quote(raw_token)}"
    )
    send_action_email(email, subject, action_url)


def _valid_action_token(
    db: Session,
    raw_token: str,
    purpose: str,
) -> AuthActionToken:
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    action_token = (
        db.query(AuthActionToken)
        .filter(
            AuthActionToken.token_hash == token_hash,
            AuthActionToken.purpose == purpose,
            AuthActionToken.used_at.is_(None),
            AuthActionToken.expires_at > datetime.now(timezone.utc),
        )
        .with_for_update()
        .first()
    )
    if not action_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link is invalid or has expired.",
        )
    return action_token


def _expires_in_seconds() -> int:
    return settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def _is_unique_violation(exc: IntegrityError) -> bool:
    original = exc.orig
    return (
        getattr(original, "sqlstate", None) == "23505"
        or getattr(original, "pgcode", None) == "23505"
    )


@router.post(
    "/register",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("auth_register", 20, 60))],
)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    email = str(req.email).lower()
    username = req.username.lower()
    existing_account = db.query(UserAccount).filter(
        (UserAccount.email == email) | (UserAccount.username == username)
    ).first()
    existing_auth = db.query(AuthUser).filter(AuthUser.email == email).first()
    if existing_account or existing_auth:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email or username already exists.",
        )

    role = db.query(Role).filter(Role.role_name == "registered").first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account registration is temporarily unavailable.",
        )

    user_id = uuid.uuid4()
    hashed_pw = get_password_hash(req.password)

    auth_user = AuthUser(
        id=user_id,
        email=email,
        encrypted_password=hashed_pw,
        raw_user_meta_data={"full_name": req.full_name, "username": req.username},
    )
    db.add(auth_user)

    new_user = UserAccount(
        user_id=user_id,
        full_name=req.full_name,
        username=username,
        email=email,
        role_id=role.role_id,
        account_tier="registered",
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
    db.flush()
    verification_token = _create_action_token(
        db,
        user_id,
        "verify_email",
        timedelta(hours=24),
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _is_unique_violation(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email or username already exists.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account registration could not be completed.",
        ) from exc
    db.refresh(new_user)

    try:
        _send_action_link(email, "verify_email", verification_token)
    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account created, but the verification email could not be sent. Request a new link.",
        ) from exc
    return RegistrationResponse(
        message="Account created. Check your email to verify it before signing in.",
        email=email,
    )


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit("auth_login", 30, 60))])
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(UserAccount).filter(UserAccount.email == str(req.email).lower()).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    auth_user = db.query(AuthUser).filter(AuthUser.id == user.user_id).first()
    if not auth_user or not auth_user.encrypted_password or not verify_password(req.password, auth_user.encrypted_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended or inactive.")
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email address before signing in.",
        )

    if user.mfa_enabled and user.mfa_secret:
        if not req.mfa_code:
            challenge = create_access_token(
                data={"sub": str(user.user_id), "type": "mfa_challenge", "scope": "user"},
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
        expires_in=_expires_in_seconds(),
        user=serialize_user(user, db),
    )


@router.post("/admin-login", response_model=TokenResponse, dependencies=[Depends(rate_limit("admin_login", 20, 60))])
def admin_login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(UserAccount).filter(UserAccount.email == str(req.email).lower()).first()
    auth_user = db.query(AuthUser).filter(AuthUser.id == user.user_id).first() if user else None
    if (
        not user
        or not auth_user
        or not auth_user.encrypted_password
        or not verify_password(req.password, auth_user.encrypted_password)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid administrative credentials.")

    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended or inactive.")
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email address before signing in.",
        )
    role_names = get_user_role_names(user, db)
    if not role_names & ADMIN_ROLE_NAMES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrative credentials required.")

    if user.mfa_enabled and user.mfa_secret:
        if not req.mfa_code:
            challenge = create_access_token(
                data={"sub": str(user.user_id), "type": "mfa_challenge", "scope": "admin"},
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
        expires_in=_expires_in_seconds(),
        user=serialize_user(user, db),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit("auth_refresh", 60, 60))],
)
def refresh_session(req: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_access_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")
    try:
        user_id = uuid.UUID(str(payload["sub"]))
        session_id = uuid.UUID(str(payload["sid"]))
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    now = datetime.now(timezone.utc)
    session = (
        db.query(UserSession)
        .filter(
            UserSession.session_id == session_id,
            UserSession.user_id == user_id,
            UserSession.is_revoked.is_(False),
            UserSession.expires_at > now,
        )
        .with_for_update()
        .first()
    )
    token_hash = hashlib.sha256(req.refresh_token.encode("utf-8")).hexdigest()
    if not session or not hmac.compare_digest(session.refresh_token_hash, token_hash):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    user = db.query(UserAccount).filter(UserAccount.user_id == user_id).first()
    if not user or user.status != "active" or not user.is_verified:
        session.is_revoked = True
        db.commit()
        raise HTTPException(status_code=401, detail="This account cannot refresh its session.")

    access_token = create_access_token(
        data={"sub": str(user.user_id), "sid": str(session.session_id)}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.user_id), "sid": str(session.session_id)}
    )
    session.refresh_token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
    session.expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.commit()
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=_expires_in_seconds(),
        user=serialize_user(user, db),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    req: LogoutRequest | None = None,
    credentials=Depends(security),
    db: Session = Depends(get_db),
):
    session = None
    raw_refresh = req.refresh_token if req else None
    if raw_refresh:
        payload = decode_access_token(raw_refresh)
        if payload and payload.get("type") == "refresh":
            try:
                session_id = uuid.UUID(str(payload["sid"]))
                user_id = uuid.UUID(str(payload["sub"]))
            except (KeyError, TypeError, ValueError):
                session_id = user_id = None
            if session_id and user_id:
                session = (
                    db.query(UserSession)
                    .filter(
                        UserSession.session_id == session_id,
                        UserSession.user_id == user_id,
                        UserSession.is_revoked.is_(False),
                    )
                    .with_for_update()
                    .first()
                )
                token_hash = hashlib.sha256(raw_refresh.encode("utf-8")).hexdigest()
                if session and not hmac.compare_digest(session.refresh_token_hash, token_hash):
                    session = None

    if not session and credentials:
        payload = decode_access_token(credentials.credentials)
        if payload and payload.get("type") == "access":
            try:
                session_id = uuid.UUID(str(payload["sid"]))
                user_id = uuid.UUID(str(payload["sub"]))
            except (KeyError, TypeError, ValueError):
                session_id = user_id = None
            if session_id and user_id:
                session = (
                    db.query(UserSession)
                    .filter(
                        UserSession.session_id == session_id,
                        UserSession.user_id == user_id,
                        UserSession.is_revoked.is_(False),
                    )
                    .with_for_update()
                    .first()
                )

    if session:
        session.is_revoked = True
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/verify-email",
    dependencies=[Depends(rate_limit("auth_verify_email", 20, 60))],
)
def verify_email(req: EmailTokenRequest, db: Session = Depends(get_db)):
    action_token = _valid_action_token(db, req.token, "verify_email")
    user = db.query(UserAccount).filter(UserAccount.user_id == action_token.user_id).first()
    if not user or user.status != "active":
        raise HTTPException(status_code=400, detail="This link is invalid or has expired.")
    action_token.used_at = datetime.now(timezone.utc)
    user.is_verified = True
    db.commit()
    return {"message": "Email verified. You can now sign in."}


@router.post(
    "/resend-verification",
    dependencies=[Depends(rate_limit("auth_resend_verification", 10, 60))],
)
def resend_verification(req: EmailRequest, db: Session = Depends(get_db)):
    email = str(req.email).lower()
    user = db.query(UserAccount).filter(UserAccount.email == email).first()
    if user and not user.is_verified and user.status == "active":
        raw_token = _create_action_token(
            db,
            user.user_id,
            "verify_email",
            timedelta(hours=24),
        )
        db.commit()
        try:
            _send_action_link(email, "verify_email", raw_token)
        except EmailDeliveryError as exc:
            raise HTTPException(
                status_code=503,
                detail="Verification email could not be sent. Please try again later.",
            ) from exc
    return {
        "message": "If the account needs verification, a new link will be sent to that email address."
    }


@router.post(
    "/password-reset/request",
    dependencies=[Depends(rate_limit("auth_password_reset", 10, 60))],
)
def request_password_reset(req: PasswordResetRequest, db: Session = Depends(get_db)):
    email = str(req.email).lower()
    user = db.query(UserAccount).filter(UserAccount.email == email).first()
    auth_user = (
        db.query(AuthUser)
        .filter(AuthUser.id == user.user_id)
        .first()
        if user
        else None
    )
    if user and auth_user and user.status == "active":
        raw_token = _create_action_token(
            db,
            user.user_id,
            "password_reset",
            timedelta(hours=1),
        )
        db.commit()
        try:
            _send_action_link(email, "password_reset", raw_token)
        except EmailDeliveryError as exc:
            raise HTTPException(
                status_code=503,
                detail="Password recovery email could not be sent. Please try again later.",
            ) from exc
    return {
        "message": "If an active account uses that email, password recovery instructions will be sent."
    }


@router.post("/password-reset/confirm")
def confirm_password_reset(
    req: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
):
    action_token = _valid_action_token(db, req.token, "password_reset")
    auth_user = db.query(AuthUser).filter(AuthUser.id == action_token.user_id).first()
    if not auth_user:
        raise HTTPException(status_code=400, detail="This link is invalid or has expired.")
    now = datetime.now(timezone.utc)
    auth_user.encrypted_password = get_password_hash(req.new_password)
    auth_user.updated_at = now
    action_token.used_at = now
    db.query(UserSession).filter(
        UserSession.user_id == action_token.user_id,
        UserSession.is_revoked.is_(False),
    ).update({"is_revoked": True}, synchronize_session=False)
    db.commit()
    return {"message": "Password reset successfully. Sign in with your new password."}


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
    if (
        not user
        or user.status != "active"
        or not user.is_verified
        or not user.mfa_secret
        or not verify_totp_code(user.mfa_secret, req.code)
    ):
        raise HTTPException(status_code=401, detail="Invalid 6-digit MFA code.")
    if payload.get("scope") == "admin" and not get_user_role_names(user, db) & ADMIN_ROLE_NAMES:
        raise HTTPException(status_code=403, detail="Administrative credentials required.")
    access_token, refresh_token = _issue_session_tokens(user, request, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=_expires_in_seconds(),
        user=serialize_user(user, db),
    )


@router.post(
    "/admin-invite",
    dependencies=[Depends(rate_limit("admin_invite", 10, 60))],
)
def invite_admin_staff(
    req: AdminInviteRequest,
    admin: UserAccount = Depends(require_permission("user.manage")),
    db: Session = Depends(get_db),
):
    email = str(req.email).lower()
    existing_account = db.query(UserAccount).filter(UserAccount.email == email).first()
    existing_auth = db.query(AuthUser).filter(AuthUser.email == email).first()
    if existing_account or existing_auth:
        raise HTTPException(status_code=409, detail="An account already uses this email.")

    role = db.query(Role).filter(Role.role_name == req.role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Admin role '{req.role_name}' not found.")
    raw_token = secrets.token_urlsafe(32)
    invitation_id = uuid.uuid4()
    invite = AdminInvitation(
        invitation_id=invitation_id,
        email=email,
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
            target_id=invitation_id,
            metadata_={"email": email, "role_name": req.role_name},
        )
    )
    db.flush()
    try:
        _send_action_link(email, "admin_invite", raw_token)
    except EmailDeliveryError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Staff invitation email could not be sent. Please try again later.",
        ) from exc
    db.commit()
    return {
        "invitation_id": str(invite.invitation_id),
        "email": invite.email,
        "role_name": role.role_name,
        "expires_at": invite.expires_at,
    }


@router.post(
    "/admin-invite/accept",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("admin_invite_accept", 10, 60))],
)
def accept_admin_invitation(
    req: AdminInviteAcceptRequest,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    token_hash = hashlib.sha256(req.token.encode("utf-8")).hexdigest()
    invite = (
        db.query(AdminInvitation)
        .filter(
            AdminInvitation.token_hash == token_hash,
            AdminInvitation.accepted_at.is_(None),
            AdminInvitation.expires_at > now,
        )
        .with_for_update()
        .first()
    )
    email = str(req.email).lower()
    if not invite or not hmac.compare_digest(invite.email, email):
        raise HTTPException(
            status_code=400,
            detail="This invitation is invalid or has expired.",
        )

    if (
        db.query(UserAccount).filter(UserAccount.email == email).first()
        or db.query(UserAccount).filter(UserAccount.username == req.username.lower()).first()
        or db.query(AuthUser).filter(AuthUser.email == email).first()
    ):
        raise HTTPException(
            status_code=409,
            detail="An account already uses this email or username.",
        )

    role = db.query(Role).filter(Role.role_id == invite.target_role_id).first()
    if not role or role.role_name.lower() not in ADMIN_ROLE_NAMES:
        raise HTTPException(
            status_code=400,
            detail="This invitation does not grant a valid staff role.",
        )

    user_id = uuid.uuid4()
    db.add(
        AuthUser(
            id=user_id,
            email=email,
            encrypted_password=get_password_hash(req.password),
            raw_user_meta_data={"full_name": req.full_name, "username": req.username},
        )
    )
    staff_user = UserAccount(
        user_id=user_id,
        full_name=req.full_name,
        username=req.username.lower(),
        email=email,
        role_id=role.role_id,
        account_tier="admin",
        is_verified=True,
        status="active",
    )
    db.add(staff_user)
    try:
        db.flush()
        invite.accepted_at = now
        db.add(
            AuditLog(
                actor_id=user_id,
                actor_role=role.role_name,
                action="admin.invite_accepted",
                target_table="admin_invitations",
                target_id=invite.invitation_id,
                metadata_={"role_name": role.role_name},
            )
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _is_unique_violation(exc):
            raise HTTPException(
                status_code=409,
                detail="An account already uses this email or username.",
            ) from exc
        raise HTTPException(
            status_code=500,
            detail="Staff account could not be created.",
        ) from exc

    return {
        "message": "Staff account created. Sign in through the administrative login.",
        "email": email,
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
    if req.username is not None:
        normalized_username = req.username.lower()
        username_owner = db.query(UserAccount).filter(
            UserAccount.username == normalized_username,
            UserAccount.user_id != current_user.user_id,
        ).first()
        if username_owner:
            raise HTTPException(status_code=409, detail="Username is already taken.")
        current_user.username = normalized_username
    if req.avatar_url is not None:
        current_user.avatar_url = req.avatar_url

    profile = current_user.profile
    if not profile:
        profile = UserProfile(user_id=current_user.user_id)
        db.add(profile)
        db.flush()

    if req.bio is not None:
        profile.bio = req.bio
    if req.is_private is not None:
        profile.is_private = req.is_private
    if req.cover_image_url is not None:
        profile.cover_image_url = req.cover_image_url
    if req.cuisine_interests is not None:
        profile.cuisine_interests = req.cuisine_interests
    if req.website_url is not None:
        profile.website_url = req.website_url
    if req.social_links is not None:
        profile.social_links = req.social_links
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
