from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CommentCreate(BaseModel):
    content: str
    post_id: Optional[UUID] = None
    recipe_id: Optional[UUID] = None
    parent_comment_id: Optional[UUID] = None


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    comment_id: UUID
    user_id: UUID
    parent_comment_id: Optional[UUID] = None
    content: str
    created_at: datetime
    author_name: Optional[str] = None
    avatar_url: Optional[str] = None


class PostMediaSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    media_url: str
    media_type: str = "image"
    sort_order: int = 0


class PostCreate(BaseModel):
    caption: Optional[str] = None
    recipe_id: Optional[UUID] = None
    dish_name: Optional[str] = None
    technique: Optional[str] = None
    restaurant_tag: Optional[str] = None
    ingredient_tags: List[str] = []
    hashtags: List[str] = []
    is_cooked_this: bool = False
    media: List[PostMediaSchema] = []


class PostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    post_id: UUID
    author_id: UUID
    author_name: str
    author_username: Optional[str] = None
    author_avatar: Optional[str] = None
    author_tier: str
    is_verified: bool = False
    caption: Optional[str] = None
    recipe_id: Optional[UUID] = None
    recipe_title: Optional[str] = None
    dish_name: Optional[str] = None
    technique: Optional[str] = None
    restaurant_tag: Optional[str] = None
    ingredient_tags: List[str] = []
    hashtags: List[str] = []
    is_cooked_this: bool = False
    likes_count: int = 0
    comments_count: int = 0
    has_liked: bool = False
    has_saved: bool = False
    media: List[PostMediaSchema] = []
    created_at: datetime


class BlogCreate(BaseModel):
    title: str
    excerpt: Optional[str] = None
    category: str = "Culinary Stories"
    cover_image_url: Optional[str] = None
    content_markdown: str
    tags: List[str] = []
    embedded_recipe_ids: List[UUID] = []
    is_draft: bool = False


class BlogUpdate(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    category: Optional[str] = None
    cover_image_url: Optional[str] = None
    content_markdown: Optional[str] = None
    tags: Optional[List[str]] = None
    embedded_recipe_ids: Optional[List[UUID]] = None
    is_draft: Optional[bool] = None


class BlogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    blog_id: UUID
    author_id: UUID
    author_name: str
    author_username: Optional[str] = None
    title: str
    slug: str
    excerpt: Optional[str] = None
    category: str
    cover_image_url: Optional[str] = None
    content_markdown: str
    tags: List[str] = []
    embedded_recipe_ids: List[UUID] = []
    is_draft: bool
    published_at: Optional[datetime] = None
    created_at: datetime


class ReportCreate(BaseModel):
    target_type: str
    target_id: UUID
    reason: str
