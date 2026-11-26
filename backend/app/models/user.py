import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import AccountTierEnum, DietTypeEnum, UserStatusEnum


class AuthUser(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    encrypted_password = Column(String, nullable=True)
    raw_user_meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = {"schema": "public"}

    role_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_name = Column(String, nullable=False, unique=True)
    tier = Column(AccountTierEnum, nullable=False, default="registered")
    description = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AdminPermission(Base):
    __tablename__ = "admin_permissions"
    __table_args__ = {"schema": "public"}

    permission_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    permission_key = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=False)
    is_high_risk = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = {"schema": "public"}

    role_id = Column(UUID(as_uuid=True), ForeignKey("public.roles.role_id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("public.admin_permissions.permission_id", ondelete="CASCADE"), primary_key=True)


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = {"schema": "public"}

    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("public.roles.role_id", ondelete="CASCADE"), primary_key=True)


class UserAccount(Base):
    __tablename__ = "user_accounts"
    __table_args__ = {"schema": "public"}

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("public.roles.role_id"), nullable=False)
    account_tier = Column(AccountTierEnum, nullable=False, default="registered")
    status = Column(UserStatusEnum, nullable=False, default="active")
    is_verified = Column(Boolean, default=False, nullable=False)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_secret = Column(Text, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    role = relationship("Role", foreign_keys=[role_id])
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    recipes = relationship("Recipe", back_populates="author", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"
    __table_args__ = {"schema": "public"}

    profile_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False, unique=True)
    bio = Column(Text, nullable=True)
    diet_preference = Column(DietTypeEnum, nullable=True, default="veg")
    dietary_restrictions = Column(ARRAY(String), default=[], nullable=False)
    allergies_encrypted = Column(Text, nullable=True)
    health_conditions_encrypted = Column(Text, nullable=True)
    dislikes = Column(ARRAY(String), default=[], nullable=False)
    available_equipment = Column(ARRAY(String), default=[], nullable=False)
    city = Column(String, nullable=True, default="Mumbai")
    preferred_language = Column(String, nullable=True, default="en")
    phone = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    health_data_consent = Column(Boolean, default=False, nullable=False)
    consent_updated_at = Column(DateTime(timezone=True), nullable=True)
    notification_preferences = Column(JSON, default={"likes": True, "comments": True, "follows": True, "meal_reminders": True, "hidden_gems": True}, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("UserAccount", back_populates="profile")


class UserSession(Base):
    __tablename__ = "sessions"
    __table_args__ = {"schema": "public"}

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    refresh_token_hash = Column(Text, nullable=False)
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    is_revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AdminInvitation(Base):
    __tablename__ = "admin_invitations"
    __table_args__ = {"schema": "public"}

    invitation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False)
    target_role_id = Column(UUID(as_uuid=True), ForeignKey("public.roles.role_id", ondelete="CASCADE"), nullable=False)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
