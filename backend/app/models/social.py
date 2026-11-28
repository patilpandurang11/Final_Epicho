import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
    Integer,
    String,
    Text,
    Boolean,
    text,
)
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
    __table_args__ = (
        CheckConstraint(
            "(post_id IS NOT NULL AND recipe_id IS NULL) OR (post_id IS NULL AND recipe_id IS NOT NULL)",
            name="ck_comments_single_target",
        ),
        {"schema": "public"},
    )

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
    __table_args__ = (
        CheckConstraint(
            "(post_id IS NOT NULL AND recipe_id IS NULL) OR (post_id IS NULL AND recipe_id IS NOT NULL)",
            name="ck_likes_single_target",
        ),
        Index(
            "uq_likes_user_post",
            "user_id",
            "post_id",
            unique=True,
            postgresql_where=text("post_id IS NOT NULL"),
        ),
        Index(
            "uq_likes_user_recipe",
            "user_id",
            "recipe_id",
            unique=True,
            postgresql_where=text("recipe_id IS NOT NULL"),
        ),
        {"schema": "public"},
    )

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
    status = Column(String, nullable=False, default="accepted")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Save(Base):
    __tablename__ = "saves"
    __table_args__ = {"schema": "public"}

    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), primary_key=True)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PostSave(Base):
    __tablename__ = "post_saves"
    __table_args__ = {"schema": "public"}

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    post_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.posts.post_id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PostShare(Base):
    __tablename__ = "post_shares"
    __table_args__ = {"schema": "public"}

    share_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.user_accounts.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    post_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.posts.post_id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SavedCollection(Base):
    __tablename__ = "saved_collections"
    __table_args__ = (
        UniqueConstraint("owner_id", "name", name="uq_saved_collections_owner_name"),
        {"schema": "public"},
    )

    collection_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CollectionItem(Base):
    __tablename__ = "collection_items"
    __table_args__ = (
        Index(
            "uq_collection_recipe",
            "collection_id",
            "recipe_id",
            unique=True,
            postgresql_where=text("recipe_id IS NOT NULL"),
        ),
        Index(
            "uq_collection_post",
            "collection_id",
            "post_id",
            unique=True,
            postgresql_where=text("post_id IS NOT NULL"),
        ),
        CheckConstraint(
            "(recipe_id IS NOT NULL AND post_id IS NULL)"
            " OR (recipe_id IS NULL AND post_id IS NOT NULL)",
            name="ck_collection_item_single_target",
        ),
        {"schema": "public"},
    )

    item_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.saved_collections.collection_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipe_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"),
        nullable=True,
    )
    post_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.posts.post_id", ondelete="CASCADE"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
