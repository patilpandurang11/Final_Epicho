from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ReelCreate(BaseModel):
    title: str
    caption: Optional[str] = None
    video_url: str
    thumbnail_url: Optional[str] = None
    duration_seconds: int = 30
    category: str = "Street Food"
    hashtags: List[str] = []
    location: Optional[str] = None
    recipe_id: Optional[UUID] = None


class ReelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reel_id: UUID
    author_id: UUID
    author_name: Optional[str] = None
    author_username: Optional[str] = None
    author_avatar: Optional[str] = None
    author_verified: bool = False
    recipe_id: Optional[UUID] = None
    recipe_title: Optional[str] = None
    recipe_slug: Optional[str] = None
    title: str
    caption: Optional[str] = None
    video_url: str
    thumbnail_url: Optional[str] = None
    duration_seconds: int
    category: str
    hashtags: List[str] = []
    location: Optional[str] = None
    views_count: int = 0
    likes_count: int = 0
    comments_count: int = 0
    saves_count: int = 0
    has_liked: bool = False
    has_saved: bool = False
    created_at: datetime


class ReelCommentCreate(BaseModel):
    body: str


class ReelCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    comment_id: UUID
    reel_id: UUID
    user_id: UUID
    author_name: str
    avatar_url: Optional[str] = None
    body: str
    created_at: datetime


class ReelExtractRecipeResponse(BaseModel):
    reel_id: UUID
    requires_confirmation: bool = True
    suggested_recipe: Dict[str, Any]
    disclaimer: str = "AI-extracted from reel metadata. Please confirm quantities and safety before publishing."
