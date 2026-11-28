from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ReelCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    caption: Optional[str] = Field(default=None, max_length=2000)
    video_url: str = Field(min_length=1, max_length=2048)
    thumbnail_url: Optional[str] = None
    duration_seconds: int = Field(default=30, ge=1, le=600)
    category: str = Field(default="Street Food", min_length=1, max_length=80)
    hashtags: List[str] = []
    location: Optional[str] = None
    recipe_id: Optional[UUID] = None


class ReelUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=160)
    caption: Optional[str] = Field(default=None, max_length=2000)
    thumbnail_url: Optional[str] = Field(default=None, max_length=2048)
    category: Optional[str] = Field(default=None, min_length=1, max_length=80)
    hashtags: Optional[List[str]] = None
    location: Optional[str] = Field(default=None, max_length=120)


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
    body: str = Field(min_length=1, max_length=2000)


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
