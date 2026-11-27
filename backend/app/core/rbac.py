from typing import List, Optional, Set
from datetime import datetime, timezone
from uuid import UUID
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import Role, UserAccount, UserRole, UserSession

security = HTTPBearer(auto_error=False)

# Canonical RBAC Permission Matrix (Prompt Section 3 & Section 19)
BASE_USER_PERMISSIONS: Set[str] = {
    "recipe.view",
    "recipe.create",
    "recipe.edit_own",
    "recipe.delete_own",
    "reel.view",
    "reel.upload",
    "reel.delete_own",
    "post.create",
    "post.comment",
    "ai.generate",
    "ai.customize",
    "mealplan.manage_own",
    "grocery.manage_own",
    "ranking.vote",
    "blog.create",
}

ROLE_PERMISSION_MAP = {
    "guest": {"recipe.view", "reel.view", "ai.generate"},
    "registered": set(BASE_USER_PERMISSIONS),
    "primary": set(BASE_USER_PERMISSIONS),
    "creator": set(BASE_USER_PERMISSIONS) | {"creator.analytics", "creator.collections"},
    "business": set(BASE_USER_PERMISSIONS) | {"business.manage_own", "business.analytics"},
    "restaurant": set(BASE_USER_PERMISSIONS) | {"business.manage_own", "business.analytics"},
    "nutritionist": set(BASE_USER_PERMISSIONS) | {"consultation.provide", "nutrition.publish"},
    "chef": set(BASE_USER_PERMISSIONS) | {"creator.analytics", "creator.collections", "consultation.provide"},
    "food_brand": set(BASE_USER_PERMISSIONS) | {"business.manage_own", "business.analytics"},
    "critic": set(BASE_USER_PERMISSIONS) | {"critic.review_official", "ranking.critic_weight"},
    "chefexpert": set(BASE_USER_PERMISSIONS) | {"creator.analytics", "consultation.provide"},
    # 9 Administrative Staff Roles
    "super_admin": {"*"},
    "sysadmin": {"*"},
    "infra_admin": {"system.configure", "infra.manage", "analytics.view", "logs.view"},
    "tech_admin": {"system.configure", "ai.configure", "logs.view", "analytics.view"},
    "content_moderator": {"content.moderate", "report.resolve", "user.warn"},
    "moderator": {"content.moderate", "report.resolve", "user.warn", "ranking.manage"},
    "verification_admin": {"verification.review", "verification.approve"},
    "bizadmin": {"verification.review", "verification.approve", "business.manage_any"},
    "ranking_admin": {"ranking.manage", "hidden_gems.override", "fraud.audit"},
    "finance_admin": {"finance.manage", "subscription.configure", "refund.issue"},
    "finance": {"finance.manage", "subscription.configure", "refund.issue"},
    "customer_support": {"support.manage", "user.view_limited"},
    "analytics_admin": {"analytics.view", "reports.export"},
}

ADMIN_ROLE_NAMES = {
    "super_admin", "sysadmin", "infra_admin", "tech_admin",
    "content_moderator", "moderator", "verification_admin", "bizadmin",
    "ranking_admin", "finance_admin", "finance", "customer_support", "analytics_admin",
}


def get_user_role_names(user: UserAccount, db: Session) -> Set[str]:
    names: Set[str] = set()
    if user.role and user.role.role_name:
        names.add(user.role.role_name.lower())
    extra_roles = (
        db.query(Role.role_name)
        .join(UserRole, UserRole.role_id == Role.role_id)
        .filter(UserRole.user_id == user.user_id)
        .all()
    )
    for (role_name,) in extra_roles:
        if role_name:
            names.add(role_name.lower())
    return names


def get_user_permissions(user: Optional[UserAccount], db: Session) -> Set[str]:
    if not user:
        return set(ROLE_PERMISSION_MAP["guest"])
    role_names = get_user_role_names(user, db)
    perms: Set[str] = set()
    for rname in role_names:
        if rname in ROLE_PERMISSION_MAP:
            perms |= ROLE_PERMISSION_MAP[rname]
    return perms


def _session_user(
    credentials: Optional[HTTPAuthorizationCredentials],
    db: Session,
) -> Optional[UserAccount]:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        return None
    try:
        user_id = UUID(str(payload["sub"]))
        session_id = UUID(str(payload["sid"]))
    except (KeyError, TypeError, ValueError):
        return None

    now = datetime.now(timezone.utc)
    session = (
        db.query(UserSession)
        .filter(
            UserSession.session_id == session_id,
            UserSession.user_id == user_id,
            UserSession.is_revoked.is_(False),
            UserSession.expires_at > now,
        )
        .first()
    )
    if not session:
        return None
    return db.query(UserAccount).filter(UserAccount.user_id == user_id).first()


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[UserAccount]:
    user = _session_user(credentials, db)
    if not user or user.status != "active" or not user.is_verified:
        return None
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> UserAccount:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )
    user = _session_user(credentials, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated or suspended.",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification is required before accessing this resource.",
        )
    return user


def require_permission(permission: str):
    def checker(
        current_user: UserAccount = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> UserAccount:
        perms = get_user_permissions(current_user, db)
        if "*" in perms or permission in perms:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: missing '{permission}'.",
        )

    return checker


def require_role(allowed_roles: List[str]):
    allowed = {r.lower() for r in allowed_roles}

    def role_checker(
        current_user: UserAccount = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> UserAccount:
        user_roles = get_user_role_names(current_user, db)
        if "super_admin" in user_roles or "sysadmin" in user_roles:
            return current_user
        if user_roles & allowed:
            return current_user
        if "admin" in allowed and user_roles & ADMIN_ROLE_NAMES:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Required role in {allowed_roles}.",
        )

    return role_checker


def require_admin(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserAccount:
    user_roles = get_user_role_names(current_user, db)
    if user_roles & ADMIN_ROLE_NAMES:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Administrative access required.",
    )


def ensure_owner_or_permission(
    user: UserAccount,
    owner_id: UUID,
    override_permission: str,
    db: Session,
) -> None:
    if user.user_id == owner_id:
        return
    perms = get_user_permissions(user, db)
    if "*" in perms or override_permission in perms:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to modify or delete another user's resource.",
    )


def rate_limit(scope: str, limit: int, window_seconds: int = 60):
    def limiter(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        key = f"rl:{scope}:{client_ip}"
        count = cache.incr_with_ttl(key, ttl_seconds=window_seconds)
        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please wait before retrying.",
            )

    return limiter
