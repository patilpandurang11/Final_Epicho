import uuid
from datetime import datetime, date, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, Numeric, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import ModerationStatusEnum, RankingTargetTypeEnum


class HiddenGem(Base):
    __tablename__ = "hidden_gems"
    __table_args__ = {"schema": "public"}

    gem_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String, nullable=False)  # 'recipe' or 'restaurant'
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    gem_score = Column(Numeric(10, 4), nullable=False)
    featured_from = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    featured_until = Column(DateTime(timezone=True), nullable=False)
    is_manual_override = Column(Boolean, default=False, nullable=False)
    overridden_by = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class RankingPeriod(Base):
    __tablename__ = "ranking_periods"
    __table_args__ = {"schema": "public"}

    period_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False, default=date.today)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class RankingVote(Base):
    __tablename__ = "ranking_votes"
    __table_args__ = {"schema": "public"}

    vote_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    voter_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    period_id = Column(UUID(as_uuid=True), ForeignKey("public.ranking_periods.period_id", ondelete="CASCADE"), nullable=False)
    target_type = Column(RankingTargetTypeEnum, nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=False)
    score = Column(Integer, nullable=False)
    verified_signal_weight = Column(Numeric(4, 2), default=1.00, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class BlogPost(Base):
    __tablename__ = "blog_posts"
    __table_args__ = {"schema": "public"}

    blog_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    excerpt = Column(Text, nullable=True)
    category = Column(String, default="Culinary Stories", nullable=False)
    cover_image_url = Column(Text, nullable=True)
    content_markdown = Column(Text, nullable=False)
    embedded_recipe_ids = Column(ARRAY(UUID(as_uuid=True)), default=[], nullable=False)
    tags = Column(ARRAY(String), default=[], nullable=False)
    is_draft = Column(Boolean, default=False, nullable=False)
    moderation_status = Column(ModerationStatusEnum, default="approved", nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    author = relationship("UserAccount")
