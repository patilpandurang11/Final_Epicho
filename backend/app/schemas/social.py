from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    post_id: Optional[UUID] = None
    recipe_id: Optional[UUID] = None
    parent_comment_id: Optional[UUID] = None


class CommentUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


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

    media_url: str = Field(min_length=1, max_length=2048)
    media_type: Literal["image", "video"] = "image"
    sort_order: int = Field(default=0, ge=0, le=10)


class PostCreate(BaseModel):
    caption: Optional[str] = Field(default=None, max_length=2000)
    recipe_id: Optional[UUID] = None
    dish_name: Optional[str] = Field(default=None, max_length=120)
    technique: Optional[str] = Field(default=None, max_length=120)
    restaurant_tag: Optional[str] = Field(default=None, max_length=120)
    ingredient_tags: List[str] = Field(default_factory=list, max_length=30)
    hashtags: List[str] = Field(default_factory=list, max_length=30)
    is_cooked_this: bool = False
    media: List[PostMediaSchema] = Field(default_factory=list, max_length=10)


class PostUpdate(BaseModel):
    caption: Optional[str] = Field(default=None, max_length=2000)
    dish_name: Optional[str] = Field(default=None, max_length=120)
    technique: Optional[str] = Field(default=None, max_length=120)
    restaurant_tag: Optional[str] = Field(default=None, max_length=120)
    ingredient_tags: Optional[List[str]] = Field(default=None, max_length=30)
    hashtags: Optional[List[str]] = Field(default=None, max_length=30)
    is_cooked_this: Optional[bool] = None


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
    shares_count: int = 0
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
    target_type: Literal["recipe", "post", "comment", "user", "ai_output", "reel", "blog", "restaurant"]
    target_id: UUID
    reason: str = Field(min_length=5, max_length=2000)
