import os
import shutil
import subprocess
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import (
    ensure_owner_or_permission,
    get_current_user,
    get_optional_user,
    require_permission,
)
from app.models.admin import ModerationReport, Notification
from app.models.recipe import Recipe
from app.models.reels import Reel, ReelComment, ReelLike, ReelSave, ReelView
from app.models.user import UserAccount
from app.schemas.ai import AIKitchenGenerateRequest
from app.schemas.reels import (
    ReelCommentCreate,
    ReelCommentResponse,
    ReelCreate,
    ReelExtractRecipeResponse,
    ReelResponse,
)
from app.services.ai_kitchen import generate_ai_recipe

router = APIRouter(prefix="/reels", tags=["Reels"])

ALLOWED_VIDEO_EXT = {".mp4", ".webm", ".mov"}
MAX_REEL_BYTES = 100 * 1024 * 1024  # 100 MB

SEED_REELS = [
    {
        "title": "Authentic Mumbai Pav Bhaji on Street Tawa",
        "caption": "Watching the butter melt on spiced mashed veggies is pure culinary therapy! #StreetFood #MumbaiEats",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-frying-diced-vegetables-in-a-pan-43257-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=600&q=80",
        "duration_seconds": 38,
        "category": "Street Food",
        "hashtags": ["StreetFood", "MumbaiEats", "PavBhaji"],
        "location": "Juhu Beach, Mumbai",
        "likes_count": 1420,
        "comments_count": 89,
        "views_count": 12800,
    },
    {
        "title": "60-Second Creamy Paneer Butter Masala",
        "caption": "Velvety tomato gravy balanced with toasted kasuri methi and fresh cream. #HomeCooking #Paneer",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-cooking-a-delicious-sauce-in-a-pan-43248-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80",
        "duration_seconds": 45,
        "category": "Home Cooking",
        "hashtags": ["HomeCooking", "Paneer", "NorthIndian"],
        "location": "New Delhi",
        "likes_count": 2150,
        "comments_count": 142,
        "views_count": 19400,
    },
    {
        "title": "Artisan Sourdough & Garlic Herb Butter Melt",
        "caption": "Hear that golden crust crackle! Fresh rosemary roasted garlic compound butter. #TrendingFoodReels #ArtisanBread",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-spreading-butter-on-a-slice-of-bread-43264-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
        "duration_seconds": 28,
        "category": "Trending Food Reels",
        "hashtags": ["Sourdough", "Baking", "TrendingFoodReels"],
        "location": "Bengaluru",
        "likes_count": 3240,
        "comments_count": 215,
        "views_count": 31000,
    },
    {
        "title": "High-Protein Quinoa Avocado Power Bowl",
        "caption": "15-minute clean nutrition with roasted chickpeas, lemon tahini dressing, and microgreens. #HealthyFood #CleanEating",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-pouring-salad-dressing-over-fresh-vegetables-43252-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
        "duration_seconds": 32,
        "category": "Healthy Food",
        "hashtags": ["HealthyFood", "HighProtein", "PowerBowl"],
        "location": "Pune",
        "likes_count": 980,
        "comments_count": 47,
        "views_count": 8500,
    },
]


def ensure_seed_reels(db: Session):
    if db.query(Reel).count() == 0:
        author = db.query(UserAccount).first()
        recipe = db.query(Recipe).first()
        if author:
            for item in SEED_REELS:
                db.add(
                    Reel(
                        author_id=author.user_id,
                        recipe_id=recipe.recipe_id if recipe else None,
                        title=item["title"],
                        caption=item["caption"],
                        video_url=item["video_url"],
                        thumbnail_url=item["thumbnail_url"],
                        duration_seconds=item["duration_seconds"],
                        category=item["category"],
                        hashtags=item["hashtags"],
                        location=item["location"],
                        likes_count=item["likes_count"],
                        comments_count=item["comments_count"],
                        views_count=item["views_count"],
                    )
                )
            db.commit()


def _serialize_reel(r: Reel, current_user: Optional[UserAccount], db: Session) -> ReelResponse:
    has_liked = False
    has_saved = False
    if current_user:
        has_liked = db.query(ReelLike).filter(ReelLike.reel_id == r.reel_id, ReelLike.user_id == current_user.user_id).first() is not None
        has_saved = db.query(ReelSave).filter(ReelSave.reel_id == r.reel_id, ReelSave.user_id == current_user.user_id).first() is not None

    return ReelResponse(
        reel_id=r.reel_id,
        author_id=r.author_id,
        author_name=r.author.full_name if r.author else "EpiCho Creator",
        author_username=r.author.username if r.author else "creator",
        author_avatar=r.author.avatar_url if r.author else None,
        author_verified=r.author.is_verified if r.author else False,
        recipe_id=r.recipe_id,
        recipe_title=r.recipe.title if r.recipe else None,
        recipe_slug=r.recipe.slug if r.recipe else None,
        title=r.title,
        caption=r.caption,
        video_url=r.video_url,
        thumbnail_url=r.thumbnail_url,
        duration_seconds=r.duration_seconds or 30,
        category=r.category or "Street Food",
        hashtags=r.hashtags or [],
        location=r.location,
        views_count=r.views_count or 0,
        likes_count=r.likes_count or 0,
        comments_count=r.comments_count or 0,
        saves_count=r.saves_count or 0,
        has_liked=has_liked,
        has_saved=has_saved,
        created_at=r.created_at,
    )


@router.get("", response_model=List[ReelResponse])
def get_reels(
    category: Optional[str] = None,
    limit: int = Query(20, le=50),
    offset: int = 0,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    ensure_seed_reels(db)
    query = db.query(Reel).filter(Reel.moderation_status == "approved")
    if category and category != "All":
        query = query.filter(Reel.category == category)
    reels = query.order_by(desc(Reel.created_at)).offset(offset).limit(limit).all()
    return [_serialize_reel(r, current_user, db) for r in reels]


@router.post("/upload", response_model=ReelResponse)
async def upload_reel_video(
    title: str = Form(...),
    caption: str = Form(""),
    category: str = Form("Home Cooking"),
    hashtags: str = Form(""),
    location: str = Form(""),
    duration_seconds: int = Form(30),
    recipe_id: Optional[str] = Form(None),
    video: UploadFile = File(...),
    thumbnail: Optional[UploadFile] = File(None),
    current_user: UserAccount = Depends(require_permission("reel.upload")),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(video.filename or "")[1].lower()
    if ext not in ALLOWED_VIDEO_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported video format '{ext}'. Allowed: mp4, webm, mov.")

    reels_dir = os.path.join(settings.STORAGE_PATH, "reels")
    thumbs_dir = os.path.join(settings.STORAGE_PATH, "thumbnails")
    os.makedirs(reels_dir, exist_ok=True)
    os.makedirs(thumbs_dir, exist_ok=True)

    file_id = str(uuid.uuid4())
    video_filename = f"{file_id}{ext}"
    video_path = os.path.join(reels_dir, video_filename)

    total = 0
    with open(video_path, "wb") as out:
        while chunk := await video.read(1024 * 512):
            total += len(chunk)
            if total > MAX_REEL_BYTES:
                out.close()
                os.remove(video_path)
                raise HTTPException(status_code=413, detail="Video exceeds 100 MB limit.")
            out.write(chunk)

    thumb_url = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80"
    if thumbnail and thumbnail.filename:
        t_ext = os.path.splitext(thumbnail.filename)[1].lower() or ".jpg"
        t_name = f"{file_id}{t_ext}"
        t_path = os.path.join(thumbs_dir, t_name)
        with open(t_path, "wb") as tf:
            shutil.copyfileobj(thumbnail.file, tf)
        thumb_url = f"{settings.CDN_BASE_URL}/thumbnails/{t_name}"
    elif shutil.which("ffmpeg"):
        t_name = f"{file_id}.jpg"
        t_path = os.path.join(thumbs_dir, t_name)
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", video_path, "-ss", "00:00:01", "-vframes", "1", t_path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
                check=True,
            )
            thumb_url = f"{settings.CDN_BASE_URL}/thumbnails/{t_name}"
        except Exception:
            pass

    parsed_tags = [t.strip().lstrip("#") for t in hashtags.split(",") if t.strip()] if hashtags else []
    linked_recipe_uuid = None
    if recipe_id:
        try:
            linked_recipe_uuid = uuid.UUID(recipe_id)
        except ValueError:
            linked_recipe_uuid = None

    new_reel = Reel(
        author_id=current_user.user_id,
        recipe_id=linked_recipe_uuid,
        title=title,
        caption=caption,
        video_url=f"{settings.CDN_BASE_URL}/reels/{video_filename}",
        thumbnail_url=thumb_url,
        duration_seconds=duration_seconds,
        category=category,
        hashtags=parsed_tags,
        location=location or None,
        moderation_status="approved",
    )
    db.add(new_reel)
    db.commit()
    db.refresh(new_reel)
    return _serialize_reel(new_reel, current_user, db)


@router.post("", response_model=ReelResponse)
def create_reel(
    req: ReelCreate,
    current_user: UserAccount = Depends(require_permission("reel.upload")),
    db: Session = Depends(get_db),
):
    new_reel = Reel(
        author_id=current_user.user_id,
        recipe_id=req.recipe_id,
        title=req.title,
        caption=req.caption,
        video_url=req.video_url,
        thumbnail_url=req.thumbnail_url,
        duration_seconds=req.duration_seconds,
        category=req.category,
        hashtags=req.hashtags,
        location=req.location,
        moderation_status="approved",
    )
    db.add(new_reel)
    db.commit()
    db.refresh(new_reel)
    return _serialize_reel(new_reel, current_user, db)


@router.delete("/{reel_id}")
def delete_reel(
    reel_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reel = db.query(Reel).filter(Reel.reel_id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found.")
    ensure_owner_or_permission(current_user, reel.author_id, "content.moderate", db)
    db.delete(reel)
    db.commit()
    return {"message": "Reel deleted."}


@router.post("/{reel_id}/like")
def like_reel(
    reel_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reel = db.query(Reel).filter(Reel.reel_id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found.")
    existing = db.query(ReelLike).filter(ReelLike.reel_id == reel_id, ReelLike.user_id == current_user.user_id).first()
    if existing:
        db.delete(existing)
        reel.likes_count = max(0, (reel.likes_count or 1) - 1)
        db.commit()
        return {"liked": False, "likes_count": reel.likes_count}

    db.add(ReelLike(reel_id=reel_id, user_id=current_user.user_id))
    reel.likes_count = (reel.likes_count or 0) + 1
    if reel.author_id != current_user.user_id:
        db.add(
            Notification(
                user_id=reel.author_id,
                type="social",
                title="Reel liked",
                body=f"{current_user.full_name} liked your reel '{reel.title}'.",
                action_url="/reels",
            )
        )
    db.commit()
    return {"liked": True, "likes_count": reel.likes_count}


@router.post("/{reel_id}/save")
def save_reel(
    reel_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reel = db.query(Reel).filter(Reel.reel_id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found.")
    existing = db.query(ReelSave).filter(ReelSave.reel_id == reel_id, ReelSave.user_id == current_user.user_id).first()
    if existing:
        db.delete(existing)
        reel.saves_count = max(0, (reel.saves_count or 1) - 1)
        db.commit()
        return {"saved": False, "saves_count": reel.saves_count}

    db.add(ReelSave(reel_id=reel_id, user_id=current_user.user_id))
    reel.saves_count = (reel.saves_count or 0) + 1
    db.commit()
    return {"saved": True, "saves_count": reel.saves_count}


@router.post("/{reel_id}/view")
def record_reel_view(
    reel_id: uuid.UUID,
    watch_seconds: int = Query(5, ge=0),
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    reel = db.query(Reel).filter(Reel.reel_id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found.")
    db.add(ReelView(reel_id=reel_id, user_id=current_user.user_id if current_user else None, watch_seconds=watch_seconds))
    reel.views_count = (reel.views_count or 0) + 1
    db.commit()
    return {"views_count": reel.views_count}


@router.get("/{reel_id}/comments", response_model=List[ReelCommentResponse])
def get_reel_comments(reel_id: uuid.UUID, db: Session = Depends(get_db)):
    rows = db.query(ReelComment).filter(ReelComment.reel_id == reel_id).order_by(ReelComment.created_at.asc()).all()
    return [
        ReelCommentResponse(
            comment_id=c.comment_id,
            reel_id=c.reel_id,
            user_id=c.user_id,
            author_name=c.user.full_name if c.user else "Foodie",
            avatar_url=c.user.avatar_url if c.user else None,
            body=c.body,
            created_at=c.created_at,
        )
        for c in rows
    ]


@router.post("/{reel_id}/comment", response_model=ReelCommentResponse)
def add_reel_comment(
    reel_id: uuid.UUID,
    req: ReelCommentCreate,
    current_user: UserAccount = Depends(require_permission("post.comment")),
    db: Session = Depends(get_db),
):
    reel = db.query(Reel).filter(Reel.reel_id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found.")
    c = ReelComment(reel_id=reel_id, user_id=current_user.user_id, body=req.body)
    db.add(c)
    reel.comments_count = (reel.comments_count or 0) + 1
    db.commit()
    db.refresh(c)
    return ReelCommentResponse(
        comment_id=c.comment_id,
        reel_id=c.reel_id,
        user_id=c.user_id,
        author_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
        body=c.body,
        created_at=c.created_at,
    )


@router.post("/{reel_id}/report")
def report_reel(
    reel_id: uuid.UUID,
    reason: str = Query(..., min_length=5),
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.add(
        ModerationReport(
            reporter_id=current_user.user_id,
            target_type="reel",
            target_id=reel_id,
            reason=reason,
            status="open",
        )
    )
    db.commit()
    return {"message": "Reel reported for moderation."}


@router.post("/{reel_id}/extract-recipe", response_model=ReelExtractRecipeResponse)
async def extract_recipe_from_reel(
    reel_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reel = db.query(Reel).filter(Reel.reel_id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found.")

    keywords = [w.strip("#.,!") for w in (reel.title + " " + (reel.caption or "")).split() if len(w) > 4][:5]
    ai_req = AIKitchenGenerateRequest(
        ingredients=keywords or ["Seasonal Vegetables", "Spices", "Herbs"],
        cuisine_preference="Indian" if "mumbai" in (reel.title + (reel.location or "")).lower() else "Global",
        taste_preference="savory",
        diet_preference="veg",
        servings=2,
        cooking_time_mins=25,
    )
    extracted = await generate_ai_recipe(ai_req)
    extracted.title = f"{reel.title} (Reel Draft)"
    return ReelExtractRecipeResponse(
        reel_id=reel.reel_id,
        requires_confirmation=True,
        suggested_recipe=extracted.model_dump(mode="json"),
    )
