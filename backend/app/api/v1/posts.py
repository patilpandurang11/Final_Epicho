import os
import shutil
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
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
from app.models.social import Comment, Follow, Like, Post, PostMedia, Save
from app.models.user import UserAccount
from app.schemas.social import (
    CommentCreate,
    CommentResponse,
    PostCreate,
    PostMediaSchema,
    PostResponse,
    ReportCreate,
)

router = APIRouter(prefix="/posts", tags=["Social Feed"])

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_VIDEO_EXT = {".mp4", ".webm", ".mov"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


def _create_notification(db: Session, user_id: uuid.UUID, ntype: str, title: str, body: str, url: str):
    db.add(Notification(user_id=user_id, type=ntype, title=title, body=body, action_url=url))


@router.post("/upload-media")
async def upload_media_file(
    file: UploadFile = File(...),
    current_user: UserAccount = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXT and ext not in ALLOWED_VIDEO_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported media file type '{ext}'.")

    media_type = "video" if ext in ALLOWED_VIDEO_EXT else "image"
    subdir = "videos" if media_type == "video" else "images"
    target_dir = os.path.join(settings.STORAGE_PATH, subdir)
    os.makedirs(target_dir, exist_ok=True)

    filename = f"{uuid.uuid4()}{ext}"
    dest_path = os.path.join(target_dir, filename)

    total = 0
    with open(dest_path, "wb") as out:
        while chunk := await file.read(1024 * 256):
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                out.close()
                os.remove(dest_path)
                raise HTTPException(status_code=413, detail="Uploaded file exceeds 50 MB limit.")
            out.write(chunk)

    return {
        "media_url": f"{settings.CDN_BASE_URL}/{subdir}/{filename}",
        "media_type": media_type,
        "size_bytes": total,
    }


@router.get("", response_model=List[PostResponse])
def get_posts(
    cooked_only: bool = False,
    hashtag: Optional[str] = None,
    limit: int = Query(20, le=50),
    offset: int = 0,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    query = db.query(Post).filter(Post.moderation_status == "approved")
    if cooked_only:
        query = query.filter(Post.is_cooked_this.is_(True))
    if hashtag:
        query = query.filter(Post.hashtags.any(hashtag))

    posts = query.order_by(desc(Post.created_at)).offset(offset).limit(limit).all()

    results = []
    for p in posts:
        author = p.author
        likes_count = db.query(Like).filter(Like.post_id == p.post_id).count()
        comments_count = db.query(Comment).filter(Comment.post_id == p.post_id).count()

        has_liked = False
        has_saved = False
        if current_user:
            has_liked = db.query(Like).filter(Like.post_id == p.post_id, Like.user_id == current_user.user_id).first() is not None
            if p.recipe_id:
                has_saved = db.query(Save).filter(Save.recipe_id == p.recipe_id, Save.user_id == current_user.user_id).first() is not None

        media_items = [
            PostMediaSchema(media_url=m.media_url, media_type=m.media_type, sort_order=m.sort_order)
            for m in p.media
        ]
        results.append(
            PostResponse(
                post_id=p.post_id,
                author_id=p.author_id,
                author_name=author.full_name if author else "Chef",
                author_username=author.username if author else "chef",
                author_avatar=author.avatar_url if author else None,
                author_tier=author.account_tier if author else "registered",
                is_verified=author.is_verified if author else False,
                caption=p.caption,
                recipe_id=p.recipe_id,
                recipe_title=p.recipe.title if p.recipe else None,
                dish_name=p.dish_name,
                technique=p.technique,
                restaurant_tag=p.restaurant_tag,
                ingredient_tags=p.ingredient_tags or [],
                hashtags=p.hashtags or [],
                is_cooked_this=p.is_cooked_this,
                likes_count=likes_count,
                comments_count=comments_count,
                has_liked=has_liked,
                has_saved=has_saved,
                media=media_items,
                created_at=p.created_at,
            )
        )
    return results


@router.post("", response_model=PostResponse)
def create_post(
    req: PostCreate,
    current_user: UserAccount = Depends(require_permission("post.create")),
    db: Session = Depends(get_db),
):
    new_post = Post(
        author_id=current_user.user_id,
        caption=req.caption,
        recipe_id=req.recipe_id,
        dish_name=req.dish_name,
        technique=req.technique,
        restaurant_tag=req.restaurant_tag,
        ingredient_tags=req.ingredient_tags,
        hashtags=req.hashtags,
        is_cooked_this=req.is_cooked_this,
        moderation_status="approved",
    )
    db.add(new_post)
    db.flush()

    for idx, m in enumerate(req.media):
        db.add(
            PostMedia(
                post_id=new_post.post_id,
                media_url=m.media_url,
                media_type=m.media_type,
                sort_order=idx,
            )
        )

    db.commit()
    db.refresh(new_post)
    return PostResponse(
        post_id=new_post.post_id,
        author_id=current_user.user_id,
        author_name=current_user.full_name,
        author_username=current_user.username,
        author_avatar=current_user.avatar_url,
        author_tier=current_user.account_tier,
        is_verified=current_user.is_verified,
        caption=new_post.caption,
        recipe_id=new_post.recipe_id,
        recipe_title=new_post.recipe.title if new_post.recipe else None,
        dish_name=new_post.dish_name,
        technique=new_post.technique,
        restaurant_tag=new_post.restaurant_tag,
        ingredient_tags=new_post.ingredient_tags or [],
        hashtags=new_post.hashtags or [],
        is_cooked_this=new_post.is_cooked_this,
        likes_count=0,
        comments_count=0,
        has_liked=False,
        has_saved=False,
        media=req.media,
        created_at=new_post.created_at,
    )


@router.delete("/{post_id}")
def delete_post(
    post_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    ensure_owner_or_permission(current_user, post.author_id, "content.moderate", db)
    db.delete(post)
    db.commit()
    return {"message": "Post deleted."}


@router.post("/{post_id}/like")
def toggle_like_post(
    post_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    existing = db.query(Like).filter(Like.post_id == post_id, Like.user_id == current_user.user_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"liked": False}

    db.add(Like(post_id=post_id, user_id=current_user.user_id))
    if post.author_id != current_user.user_id:
        _create_notification(
            db,
            post.author_id,
            "social",
            "New post like",
            f"{current_user.full_name} liked your culinary post.",
            "/feed",
        )
    db.commit()
    return {"liked": True}


@router.get("/{post_id}/comments", response_model=List[CommentResponse])
def get_post_comments(post_id: uuid.UUID, db: Session = Depends(get_db)):
    comments = db.query(Comment).filter(Comment.post_id == post_id).order_by(Comment.created_at.asc()).all()
    return [
        CommentResponse(
            comment_id=c.comment_id,
            user_id=c.user_id,
            parent_comment_id=c.parent_comment_id,
            content=c.body,
            created_at=c.created_at,
            author_name=c.user.full_name if c.user else "Foodie",
            avatar_url=c.user.avatar_url if c.user else None,
        )
        for c in comments
    ]


@router.post("/{post_id}/comment", response_model=CommentResponse)
def comment_on_post(
    post_id: uuid.UUID,
    req: CommentCreate,
    current_user: UserAccount = Depends(require_permission("post.comment")),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    c = Comment(
        post_id=post_id,
        user_id=current_user.user_id,
        parent_comment_id=req.parent_comment_id,
        body=req.content,
    )
    db.add(c)
    if post.author_id != current_user.user_id:
        _create_notification(
            db,
            post.author_id,
            "social",
            "New comment on your post",
            f"{current_user.full_name}: {req.content[:80]}",
            "/feed",
        )
    db.commit()
    db.refresh(c)
    return CommentResponse(
        comment_id=c.comment_id,
        user_id=c.user_id,
        parent_comment_id=c.parent_comment_id,
        content=c.body,
        created_at=c.created_at,
        author_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
    )


@router.post("/follow/{target_user_id}")
def toggle_follow(
    target_user_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if target_user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself.")

    existing = (
        db.query(Follow)
        .filter(Follow.follower_id == current_user.user_id, Follow.following_id == target_user_id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"following": False}

    db.add(Follow(follower_id=current_user.user_id, following_id=target_user_id))
    _create_notification(
        db,
        target_user_id,
        "social",
        "New follower",
        f"{current_user.full_name} started following your kitchen.",
        f"/profile/{current_user.username or current_user.user_id}",
    )
    db.commit()
    return {"following": True}


@router.post("/report")
def report_content(
    req: ReportCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.add(
        ModerationReport(
            reporter_id=current_user.user_id,
            target_type=req.target_type,
            target_id=req.target_id,
            reason=req.reason,
            status="open",
        )
    )
    db.commit()
    return {"message": "Report submitted for moderation review."}


@router.get("/profile/{username_or_id}")
def get_public_profile(
    username_or_id: str,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    target = None
    try:
        uid = uuid.UUID(username_or_id)
        target = db.query(UserAccount).filter(UserAccount.user_id == uid).first()
    except ValueError:
        target = db.query(UserAccount).filter(UserAccount.username == username_or_id.lower()).first()

    if not target:
        raise HTTPException(status_code=404, detail="Creator profile not found.")

    followers_count = db.query(Follow).filter(Follow.following_id == target.user_id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == target.user_id).count()
    is_following = False
    if current_user:
        is_following = (
            db.query(Follow)
            .filter(Follow.follower_id == current_user.user_id, Follow.following_id == target.user_id)
            .first()
            is not None
        )

    recipes = (
        db.query(Recipe)
        .filter(Recipe.author_id == target.user_id, Recipe.moderation_status == "approved")
        .order_by(desc(Recipe.created_at))
        .limit(12)
        .all()
    )
    return {
        "user_id": str(target.user_id),
        "full_name": target.full_name,
        "username": target.username,
        "account_tier": target.account_tier,
        "is_verified": target.is_verified,
        "avatar_url": target.avatar_url,
        "bio": target.profile.bio if target.profile else "Culinary creator on EpiCho",
        "city": target.profile.city if target.profile else "Mumbai",
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
        "recipes": [
            {
                "recipe_id": str(r.recipe_id),
                "title": r.title,
                "slug": r.slug,
                "cuisine_type": r.cuisine_type,
                "image_url": r.image_url,
                "cook_time_mins": r.cook_time_mins,
            }
            for r in recipes
        ],
    }
