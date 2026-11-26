import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base


class Reel(Base):
    __tablename__ = "reels"
    __table_args__ = {"schema": "public"}

    reel_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    caption = Column(Text, nullable=True)
    video_url = Column(Text, nullable=False)
    thumbnail_url = Column(Text, nullable=True)
    duration_seconds = Column(Integer, default=30)
    category = Column(String, default="Street Food")
    hashtags = Column(ARRAY(String), default=[], nullable=False)
    location = Column(String, nullable=True)
    views_count = Column(Integer, default=0)
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    saves_count = Column(Integer, default=0)
    moderation_status = Column(String, default="approved")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    author = relationship("UserAccount")
    recipe = relationship("Recipe")


class ReelLike(Base):
    __tablename__ = "reel_likes"
    __table_args__ = {"schema": "public"}

    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), primary_key=True)
    reel_id = Column(UUID(as_uuid=True), ForeignKey("public.reels.reel_id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ReelSave(Base):
    __tablename__ = "reel_saves"
    __table_args__ = {"schema": "public"}

    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), primary_key=True)
    reel_id = Column(UUID(as_uuid=True), ForeignKey("public.reels.reel_id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ReelComment(Base):
    __tablename__ = "reel_comments"
    __table_args__ = {"schema": "public"}

    comment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reel_id = Column(UUID(as_uuid=True), ForeignKey("public.reels.reel_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("UserAccount")


class ReelView(Base):
    __tablename__ = "reel_views"
    __table_args__ = {"schema": "public"}

    view_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reel_id = Column(UUID(as_uuid=True), ForeignKey("public.reels.reel_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="SET NULL"), nullable=True)
    watch_seconds = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
