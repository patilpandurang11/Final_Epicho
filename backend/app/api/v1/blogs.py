import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import (
    ensure_owner_or_permission,
    get_current_user,
    get_optional_user,
    require_permission,
)
from app.models.discovery import BlogPost
from app.models.user import UserAccount
from app.schemas.social import BlogCreate, BlogResponse, BlogUpdate

router = APIRouter(prefix="/blogs", tags=["Blogs & Culinary Articles"])


def _slugify(title: str) -> str:
    s = re.sub(r"[^\w\s-]", "", title.lower()).strip()
    return f"{re.sub(r'[-\\s]+', '-', s) or 'article'}-{str(uuid.uuid4())[:6]}"


SEED_BLOGS = [
    {
        "title": "The Science of Tempering Whole Spices (Tadka) in Indian Kitchens",
        "excerpt": "Why blooming cumin, mustard seeds, and curry leaves in warm fat unlocks fat-soluble flavor compounds.",
        "category": "Culinary Science",
        "tags": ["Tadka", "Spices", "Technique"],
        "cover_image_url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80",
        "content_markdown": "Tempering, known regionally as tadka, baghar, or chaunk, is the aromatic backbone of Indian home cooking. Heating whole spices in ghee or cold-pressed oil at 140-165°C releases essential oils without scorching delicate volatile compounds.",
    },
    {
        "title": "Preserving Grandmother's Hand-Written Recipes for the Next Generation",
        "excerpt": "How colloquial measures like chutki and katori carry regional memory—and how to standardize them without losing soul.",
        "category": "Heritage & Culture",
        "tags": ["Heritage", "FamilyRecipes", "Tradition"],
        "cover_image_url": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
        "content_markdown": "Every family heirloom recipe holds more than ingredient ratios: it holds climate, cookware, and dialect. In EpiCho Heritage, we preserve original vernacular text alongside estimated metric equivalents.",
    },
    {
        "title": "Balanced Plant-Forward Macros: Pairing Legumes with Millets",
        "excerpt": "Complete amino-acid profiles, slow-release fiber, and practical weeknight bowls using ragi, jowar, and lentils.",
        "category": "Nutrition & Wellness",
        "tags": ["Millets", "Nutrition", "PlantForward"],
        "cover_image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
        "content_markdown": "Combining traditional Indian millets with soaked lentils creates a complementary amino-acid profile while keeping glycemic load steady.",
    },
]


def ensure_seed_blogs(db: Session):
    if db.query(BlogPost).count() == 0:
        author = db.query(UserAccount).first()
        if author:
            for b in SEED_BLOGS:
                db.add(
                    BlogPost(
                        author_id=author.user_id,
                        title=b["title"],
                        slug=_slugify(b["title"]),
                        excerpt=b["excerpt"],
                        category=b["category"],
                        cover_image_url=b["cover_image_url"],
                        content_markdown=b["content_markdown"],
                        tags=b["tags"],
                        is_draft=False,
                        moderation_status="approved",
                        published_at=datetime.now(timezone.utc),
                    )
                )
            db.commit()


def _serialize_blog(b: BlogPost) -> BlogResponse:
    return BlogResponse(
        blog_id=b.blog_id,
        author_id=b.author_id,
        author_name=b.author.full_name if b.author else "EpiCho Editor",
        author_username=b.author.username if b.author else None,
        title=b.title,
        slug=b.slug,
        excerpt=b.excerpt or b.content_markdown[:180],
        category=b.category,
        cover_image_url=b.cover_image_url,
        content_markdown=b.content_markdown,
        tags=b.tags or [],
        embedded_recipe_ids=b.embedded_recipe_ids or [],
        is_draft=b.is_draft,
        published_at=b.published_at,
        created_at=b.created_at,
    )


@router.get("", response_model=List[BlogResponse])
def list_blogs(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    include_drafts: bool = False,
    limit: int = Query(20, le=50),
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    ensure_seed_blogs(db)
    query = db.query(BlogPost).filter(BlogPost.moderation_status == "approved")
    if include_drafts and current_user:
        query = query.filter(
            or_(BlogPost.is_draft.is_(False), BlogPost.author_id == current_user.user_id)
        )
    else:
        query = query.filter(BlogPost.is_draft.is_(False))

    if category:
        query = query.filter(BlogPost.category.ilike(f"%{category}%"))
    if tag:
        query = query.filter(BlogPost.tags.any(tag))
    if search:
        query = query.filter(or_(BlogPost.title.ilike(f"%{search}%"), BlogPost.content_markdown.ilike(f"%{search}%")))

    rows = query.order_by(desc(BlogPost.created_at)).limit(limit).all()
    return [_serialize_blog(b) for b in rows]


@router.get("/{slug_or_id}", response_model=BlogResponse)
def get_blog(slug_or_id: str, db: Session = Depends(get_db)):
    blog = None
    try:
        bid = uuid.UUID(slug_or_id)
        blog = db.query(BlogPost).filter(BlogPost.blog_id == bid).first()
    except ValueError:
        blog = db.query(BlogPost).filter(BlogPost.slug == slug_or_id).first()

    if not blog or blog.moderation_status == "removed":
        raise HTTPException(status_code=404, detail="Blog article not found.")
    return _serialize_blog(blog)


@router.post("", response_model=BlogResponse)
def create_blog(
    req: BlogCreate,
    current_user: UserAccount = Depends(require_permission("blog.create")),
    db: Session = Depends(get_db),
):
    blog = BlogPost(
        author_id=current_user.user_id,
        title=req.title,
        slug=_slugify(req.title),
        excerpt=req.excerpt or req.content_markdown[:180],
        category=req.category,
        cover_image_url=req.cover_image_url
        or "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
        content_markdown=req.content_markdown,
        tags=req.tags,
        embedded_recipe_ids=req.embedded_recipe_ids,
        is_draft=req.is_draft,
        moderation_status="approved",
        published_at=None if req.is_draft else datetime.now(timezone.utc),
    )
    db.add(blog)
    db.commit()
    db.refresh(blog)
    return _serialize_blog(blog)


@router.put("/{blog_id}", response_model=BlogResponse)
def update_blog(
    blog_id: uuid.UUID,
    req: BlogUpdate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    blog = db.query(BlogPost).filter(BlogPost.blog_id == blog_id).first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog article not found.")
    ensure_owner_or_permission(current_user, blog.author_id, "content.moderate", db)

    if req.title is not None:
        blog.title = req.title
    if req.excerpt is not None:
        blog.excerpt = req.excerpt
    if req.category is not None:
        blog.category = req.category
    if req.cover_image_url is not None:
        blog.cover_image_url = req.cover_image_url
    if req.content_markdown is not None:
        blog.content_markdown = req.content_markdown
    if req.tags is not None:
        blog.tags = req.tags
    if req.embedded_recipe_ids is not None:
        blog.embedded_recipe_ids = req.embedded_recipe_ids
    if req.is_draft is not None:
        blog.is_draft = req.is_draft
        if not req.is_draft and not blog.published_at:
            blog.published_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(blog)
    return _serialize_blog(blog)


@router.delete("/{blog_id}")
def delete_blog(
    blog_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    blog = db.query(BlogPost).filter(BlogPost.blog_id == blog_id).first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog article not found.")
    ensure_owner_or_permission(current_user, blog.author_id, "content.moderate", db)
    db.delete(blog)
    db.commit()
    return {"message": "Blog article deleted."}
