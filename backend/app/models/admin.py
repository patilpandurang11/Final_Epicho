import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import NotificationTypeEnum, ReportTargetTypeEnum


class ModerationReport(Base):
    __tablename__ = "moderation_reports"
    __table_args__ = {"schema": "public"}

    report_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), nullable=True)
    moderator_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="SET NULL"), nullable=True)
    target_type = Column(ReportTargetTypeEnum, default="recipe", nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=True)
    reason = Column(Text, nullable=False)
    action = Column(Text, nullable=True)
    status = Column(String, default="open", nullable=False)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    reporter = relationship("UserAccount", foreign_keys=[reporter_id])
    moderator = relationship("UserAccount", foreign_keys=[moderator_id])


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = {"schema": "public"}

    audit_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="RESTRICT"), nullable=False)
    actor_role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    target_table = Column(String, nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=True)
    metadata_ = Column("metadata", JSON, default={}, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    actor = relationship("UserAccount")


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {"schema": "public"}

    notification_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    type = Column(NotificationTypeEnum, nullable=False)
    title = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    action_url = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("UserAccount")


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = {"schema": "public"}

    ticket_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    subject = Column(String, nullable=False)
    category = Column(String, default="general", nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default="open", nullable=False)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="SET NULL"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("UserAccount", foreign_keys=[user_id])


class SystemConfig(Base):
    __tablename__ = "system_config"
    __table_args__ = {"schema": "public"}

    config_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_key = Column(String(100), unique=True, nullable=False)
    config_value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
