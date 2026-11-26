import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import ModerationStatusEnum


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = {"schema": "public"}

    post_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="SET NULL"), nullable=True)
    caption = Column(Text, nullable=True)
    hashtags = Column(ARRAY(String), default=[], nullable=False)
    is_cooked_this = Column(Boolean, default=False, nullable=False)
    moderation_status = Column(ModerationStatusEnum, default="approved", nullable=False)
    dish_name = Column(String, nullable=True)
    technique = Column(String, nullable=True)
    restaurant_tag = Column(String, nullable=True)
    ingredient_tags = Column(ARRAY(String), default=[], nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    author = relationship("UserAccount", back_populates="posts")
    recipe = relationship("Recipe")
    media = relationship("PostMedia", back_populates="post", cascade="all, delete-orphan", order_by="PostMedia.sort_order")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")


class PostMedia(Base):
    __tablename__ = "post_media"
    __table_args__ = {"schema": "public"}

    media_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("public.posts.post_id", ondelete="CASCADE"), nullable=False)
    media_url = Column(Text, nullable=False)
    media_type = Column(String, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    post = relationship("Post", back_populates="media")


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = {"schema": "public"}

    comment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey("public.posts.post_id", ondelete="CASCADE"), nullable=True)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), nullable=True)
    parent_comment_id = Column(UUID(as_uuid=True), ForeignKey("public.comments.comment_id", ondelete="CASCADE"), nullable=True)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("UserAccount")
    post = relationship("Post", back_populates="comments")
    recipe = relationship("Recipe")

    @property
    def content(self) -> str:
        return self.body


class Like(Base):
    __tablename__ = "likes"
    __table_args__ = {"schema": "public"}

    like_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey("public.posts.post_id", ondelete="CASCADE"), nullable=True)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    post = relationship("Post", back_populates="likes")


class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = {"schema": "public"}

    follower_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), primary_key=True)
    following_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Save(Base):
    __tablename__ = "saves"
    __table_args__ = {"schema": "public"}

    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), primary_key=True)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
