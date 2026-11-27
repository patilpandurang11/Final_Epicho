import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import case, desc, func, literal
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import (
    ensure_owner_or_permission,
    get_current_user,
    get_optional_user,
    require_permission,
    rate_limit,
)
from app.models.admin import ModerationReport, Notification
from app.models.recipe import Recipe
from app.models.social import (
    CollectionItem,
    Comment,
    Follow,
    Like,
    Post,
    PostMedia,
    PostSave,
    PostShare,
    SavedCollection,
    Save,
)
from app.models.user import UserAccount
from app.schemas.social import (
    CommentCreate,
    CommentResponse,
    CommentUpdate,
    PostCreate,
    PostMediaSchema,
    PostResponse,
    ReportCreate,
    PostUpdate,
)

router = APIRouter(prefix="/posts", tags=["Social Feed"])

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_VIDEO_EXT = {".mp4", ".webm", ".mov"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)


class CollectionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)


class CollectionItemRequest(BaseModel):
    recipe_id: Optional[uuid.UUID] = None
    post_id: Optional[uuid.UUID] = None


def _create_notification(db: Session, user_id: uuid.UUID, ntype: str, title: str, body: str, url: str):
    db.add(Notification(user_id=user_id, type=ntype, title=title, body=body, action_url=url))


def _likes_count(db: Session, post_id: uuid.UUID) -> int:
    return db.query(func.count(func.distinct(Like.user_id))).filter(Like.post_id == post_id).scalar() or 0


def _shares_count(db: Session, post_id: uuid.UUID) -> int:
    return db.query(func.count(PostShare.share_id)).filter(PostShare.post_id == post_id).scalar() or 0


def _can_view_profile(db: Session, profile, viewer: Optional[UserAccount]) -> bool:
    if not profile or not profile.is_private or (viewer and viewer.user_id == profile.user_id):
        return True
    if not viewer:
        return False
    return db.query(Follow).filter(
        Follow.follower_id == viewer.user_id,
        Follow.following_id == profile.user_id,
        Follow.status == "accepted",
    ).first() is not None


def _require_post_visibility(db: Session, post: Post, viewer: Optional[UserAccount]) -> None:
    if not post.author or not _can_view_profile(db, post.author.profile, viewer):
        raise HTTPException(status_code=404, detail="Post not found.")


@router.get("/profile/{username_or_id}")
def public_profile_route(
    username_or_id: str,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return _get_public_profile(username_or_id, current_user, db)


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
    search: Optional[str] = Query(default=None, max_length=120),
    sort: str = Query("recent", pattern="^(recent|popular|recommended)$"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    query = db.query(Post).join(UserAccount, Post.author_id == UserAccount.user_id).filter(
        Post.moderation_status == "approved"
    )
    if current_user:
        followed = db.query(Follow.following_id).filter(
            Follow.follower_id == current_user.user_id, Follow.status == "accepted"
        )
        query = query.filter(
            (UserAccount.user_id == current_user.user_id)
            | (UserAccount.user_id.in_(followed))
            | (UserAccount.user_id.notin_(
                db.query(UserAccount.user_id)
                .join(UserAccount.profile)
                .filter(UserAccount.profile.has(is_private=True))
            ))
        )
    else:
        query = query.filter(
            UserAccount.user_id.notin_(
                db.query(UserAccount.user_id)
                .join(UserAccount.profile)
                .filter(UserAccount.profile.has(is_private=True))
            )
        )
    if cooked_only:
        query = query.filter(Post.is_cooked_this.is_(True))
    if hashtag:
        query = query.filter(Post.hashtags.any(hashtag))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Post.caption.ilike(term))
            | (Post.dish_name.ilike(term))
            | (Post.hashtags.any(search.strip()))
        )

    if sort == "popular":
        popularity = db.query(
            Like.post_id.label("post_id"), func.count(Like.user_id).label("total")
        ).filter(Like.post_id.isnot(None)).group_by(Like.post_id).subquery()
        query = query.outerjoin(popularity, popularity.c.post_id == Post.post_id).order_by(
            desc(func.coalesce(popularity.c.total, 0)), desc(Post.created_at)
        )
    elif sort == "recent":
        query = query.order_by(desc(Post.created_at))
    elif sort == "recommended":
        if current_user:
            followed_ids = db.query(Follow.following_id).filter(
                Follow.follower_id == current_user.user_id,
                Follow.status == "accepted",
            )
            interactions = (
                db.query(Like.post_id)
                .filter(Like.user_id == current_user.user_id, Like.post_id.isnot(None))
                .union(
                    db.query(PostSave.post_id).filter(PostSave.user_id == current_user.user_id)
                )
            )
            interests = []
            if current_user.profile:
                interests = [
                    *(current_user.profile.cuisine_interests or []),
                    *(current_user.profile.dietary_restrictions or []),
                ]
            interest_terms = [term.strip().casefold() for term in interests if term.strip()]
            score_cases = []
            for term in interest_terms[:12]:
                score_cases.append(
                    case(
                        (
                            func.array_to_string(Post.ingredient_tags, ",").ilike(
                                f"%{term}%"
                            )
                            | func.array_to_string(Post.hashtags, ",").ilike(
                                f"%{term}%"
                            )
                            | func.coalesce(Post.dish_name, "").ilike(f"%{term}%")
                            | func.coalesce(Post.technique, "").ilike(f"%{term}%"),
                            1,
                        ),
                        else_=0,
                    )
                )
            interest_score_expr = (
                sum(score_cases, start=literal(0)) if score_cases else literal(0)
            )
            query = query.order_by(
                desc(case((Post.author_id.in_(followed_ids), 1), else_=0)),
                desc(case((Post.post_id.in_(interactions), 1), else_=0)),
                desc(interest_score_expr),
                desc(Post.created_at),
                desc(Post.post_id),
            )
        else:
            query = query.order_by(desc(Post.created_at))
    posts = query.offset(offset).limit(limit).all()

    results = []
    for p in posts:
        author = p.author
        likes_count = _likes_count(db, p.post_id)
        comments_count = db.query(Comment).filter(Comment.post_id == p.post_id).count()

        has_liked = False
        has_saved = False
        if current_user:
            has_liked = db.query(Like).filter(Like.post_id == p.post_id, Like.user_id == current_user.user_id).first() is not None
            has_saved = db.query(PostSave).filter(
                PostSave.post_id == p.post_id, PostSave.user_id == current_user.user_id
            ).first() is not None
            if p.recipe_id:
                has_saved = has_saved or db.query(Save).filter(
                    Save.recipe_id == p.recipe_id, Save.user_id == current_user.user_id
                ).first() is not None

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
                shares_count=_shares_count(db, p.post_id),
                has_liked=has_liked,
                has_saved=has_saved,
                media=media_items,
                created_at=p.created_at,
            )
        )
    return results


@router.get("/saved", response_model=List[PostResponse])
def get_saved_posts(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    posts = (
        db.query(Post)
        .join(PostSave, PostSave.post_id == Post.post_id)
        .join(UserAccount, Post.author_id == UserAccount.user_id)
        .filter(
            PostSave.user_id == current_user.user_id,
            Post.moderation_status == "approved",
        )
        .order_by(desc(PostSave.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    visible_posts = []
    for post in posts:
        try:
            _require_post_visibility(db, post, current_user)
        except HTTPException as error:
            if error.status_code != 404:
                raise
            continue
        visible_posts.append(_serialize_post(db, post, current_user))
    return visible_posts


@router.get("/collections")
def list_collections(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    collections = db.query(SavedCollection).filter(
        SavedCollection.owner_id == current_user.user_id
    ).order_by(desc(SavedCollection.updated_at)).all()
    return [
        {
            "collection_id": str(collection.collection_id),
            "name": collection.name,
            "description": collection.description,
            "items_count": db.query(CollectionItem).filter(
                CollectionItem.collection_id == collection.collection_id
            ).count(),
            "created_at": collection.created_at,
            "updated_at": collection.updated_at,
        }
        for collection in collections
    ]


@router.post("/collections", status_code=201)
def create_collection(
    req: CollectionCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(SavedCollection).filter(
        SavedCollection.owner_id == current_user.user_id,
        func.lower(SavedCollection.name) == req.name.lower(),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A collection with this name already exists.")
    collection = SavedCollection(
        owner_id=current_user.user_id,
        name=req.name.strip(),
        description=req.description,
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return {
        "collection_id": str(collection.collection_id),
        "name": collection.name,
        "description": collection.description,
    }


@router.patch("/collections/{collection_id}")
def update_collection(
    collection_id: uuid.UUID,
    req: CollectionUpdate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    collection = db.query(SavedCollection).filter(
        SavedCollection.collection_id == collection_id,
        SavedCollection.owner_id == current_user.user_id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found.")
    if req.name is not None:
        duplicate = db.query(SavedCollection).filter(
            SavedCollection.owner_id == current_user.user_id,
            SavedCollection.collection_id != collection_id,
            func.lower(SavedCollection.name) == req.name.lower(),
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="A collection with this name already exists.")
        collection.name = req.name.strip()
    if req.description is not None:
        collection.description = req.description
    collection.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"collection_id": str(collection.collection_id), "name": collection.name, "description": collection.description}


@router.delete("/collections/{collection_id}")
def delete_collection(
    collection_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    collection = db.query(SavedCollection).filter(
        SavedCollection.collection_id == collection_id,
        SavedCollection.owner_id == current_user.user_id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found.")
    db.delete(collection)
    db.commit()
    return {"message": "Collection deleted."}


@router.get("/collections/{collection_id}/items")
def list_collection_items(
    collection_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    collection = db.query(SavedCollection).filter(
        SavedCollection.collection_id == collection_id,
        SavedCollection.owner_id == current_user.user_id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found.")
    items = db.query(CollectionItem).filter(
        CollectionItem.collection_id == collection_id
    ).order_by(desc(CollectionItem.created_at)).all()
    return [
        {
            "item_id": str(item.item_id),
            "recipe_id": str(item.recipe_id) if item.recipe_id else None,
            "post_id": str(item.post_id) if item.post_id else None,
        }
        for item in items
    ]


@router.post("/collections/{collection_id}/items")
def add_collection_item(
    collection_id: uuid.UUID,
    req: CollectionItemRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if bool(req.recipe_id) == bool(req.post_id):
        raise HTTPException(status_code=422, detail="Provide exactly one recipe or post.")
    collection = db.query(SavedCollection).filter(
        SavedCollection.collection_id == collection_id,
        SavedCollection.owner_id == current_user.user_id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found.")
    if req.recipe_id:
        recipe = db.query(Recipe).filter(Recipe.recipe_id == req.recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found.")
        _ensure_recipe_visible(db, recipe, current_user)
    if req.post_id:
        post = db.query(Post).filter(Post.post_id == req.post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found.")
        _require_post_visibility(db, post, current_user)
    existing = db.query(CollectionItem).filter(
        CollectionItem.collection_id == collection_id,
        CollectionItem.recipe_id == req.recipe_id,
        CollectionItem.post_id == req.post_id,
    ).first()
    if existing:
        return {"item_id": str(existing.item_id), "already_saved": True}
    item = CollectionItem(
        collection_id=collection_id,
        recipe_id=req.recipe_id,
        post_id=req.post_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"item_id": str(item.item_id), "already_saved": False}


@router.delete("/collections/{collection_id}/items/{item_id}")
def remove_collection_item(
    collection_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    collection = db.query(SavedCollection).filter(
        SavedCollection.collection_id == collection_id,
        SavedCollection.owner_id == current_user.user_id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found.")
    item = db.query(CollectionItem).filter(
        CollectionItem.collection_id == collection_id,
        CollectionItem.item_id == item_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Collection item not found.")
    db.delete(item)
    db.commit()
    return {"message": "Item removed from collection."}


@router.get("/followers/{user_id}")
def get_followers(
    user_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    target = db.query(UserAccount).filter(UserAccount.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found.")
    if not _can_view_profile(db, target.profile, current_user):
        raise HTTPException(status_code=403, detail="This profile is private.")
    rows = (
        db.query(Follow)
        .filter(Follow.following_id == user_id, Follow.status == "accepted")
        .order_by(desc(Follow.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "user_id": str(row.follower_id),
            "full_name": db.query(UserAccount.full_name).filter(UserAccount.user_id == row.follower_id).scalar(),
            "username": db.query(UserAccount.username).filter(UserAccount.user_id == row.follower_id).scalar(),
            "avatar_url": db.query(UserAccount.avatar_url).filter(UserAccount.user_id == row.follower_id).scalar(),
        }
        for row in rows
    ]


@router.get("/following/{user_id}")
def get_following(
    user_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    target = db.query(UserAccount).filter(UserAccount.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found.")
    if not _can_view_profile(db, target.profile, current_user):
        raise HTTPException(status_code=403, detail="This profile is private.")
    rows = (
        db.query(Follow)
        .filter(Follow.follower_id == user_id, Follow.status == "accepted")
        .order_by(desc(Follow.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "user_id": str(row.following_id),
            "full_name": db.query(UserAccount.full_name).filter(UserAccount.user_id == row.following_id).scalar(),
            "username": db.query(UserAccount.username).filter(UserAccount.user_id == row.following_id).scalar(),
            "avatar_url": db.query(UserAccount.avatar_url).filter(UserAccount.user_id == row.following_id).scalar(),
        }
        for row in rows
    ]


@router.get("/follow-requests")
def get_follow_requests(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requests = db.query(Follow).filter(
        Follow.following_id == current_user.user_id, Follow.status == "pending"
    ).order_by(desc(Follow.created_at)).all()
    return [
        {
            "user_id": str(item.follower_id),
            "full_name": db.query(UserAccount.full_name).filter(UserAccount.user_id == item.follower_id).scalar(),
            "username": db.query(UserAccount.username).filter(UserAccount.user_id == item.follower_id).scalar(),
            "created_at": item.created_at,
        }
        for item in requests
    ]


@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: uuid.UUID,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(
        Post.post_id == post_id, Post.moderation_status == "approved"
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    _require_post_visibility(db, post, current_user)
    return _serialize_post(db, post, current_user)


@router.post("", response_model=PostResponse)
def create_post(
    req: PostCreate,
    current_user: UserAccount = Depends(require_permission("post.create")),
    db: Session = Depends(get_db),
):
    if not any([req.caption and req.caption.strip(), req.dish_name, req.recipe_id, req.media]):
        raise HTTPException(status_code=400, detail="Add a caption, dish, linked recipe, or media before publishing.")
    if req.recipe_id:
        recipe = db.query(Recipe).filter(
            Recipe.recipe_id == req.recipe_id, Recipe.moderation_status == "approved"
        ).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found.")
        recipe_author = db.query(UserAccount).filter(UserAccount.user_id == recipe.author_id).first()
        if recipe_author and not _can_view_profile(db, recipe_author.profile, current_user):
            raise HTTPException(status_code=404, detail="Recipe not found.")
    if req.is_cooked_this and (not req.recipe_id or not req.media):
        raise HTTPException(
            status_code=400,
            detail="Cooked This posts require a linked recipe and at least one photo or video.",
        )
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


@router.patch("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: uuid.UUID,
    req: PostUpdate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.post_id == post_id, Post.moderation_status == "approved").first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    if post.author_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the author can edit this post.")
    if req.is_cooked_this is True and (not post.recipe_id or not post.media):
        raise HTTPException(
            status_code=400,
            detail="Cooked This posts require a linked recipe and at least one photo or video.",
        )
    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return _serialize_post(db, post, current_user)


def _serialize_post(db: Session, p: Post, current_user: Optional[UserAccount]) -> PostResponse:
    author = p.author
    return PostResponse(
        post_id=p.post_id, author_id=p.author_id,
        author_name=author.full_name if author else "Chef",
        author_username=author.username if author else None,
        author_avatar=author.avatar_url if author else None,
        author_tier=author.account_tier if author else "registered",
        is_verified=author.is_verified if author else False,
        caption=p.caption, recipe_id=p.recipe_id,
        recipe_title=p.recipe.title if p.recipe else None,
        dish_name=p.dish_name, technique=p.technique, restaurant_tag=p.restaurant_tag,
        ingredient_tags=p.ingredient_tags or [], hashtags=p.hashtags or [],
        is_cooked_this=p.is_cooked_this,
        likes_count=_likes_count(db, p.post_id),
        comments_count=db.query(Comment).filter(Comment.post_id == p.post_id).count(),
        shares_count=_shares_count(db, p.post_id),
        has_liked=bool(current_user and db.query(Like).filter(
            Like.post_id == p.post_id, Like.user_id == current_user.user_id
        ).first()),
        has_saved=bool(current_user and (
            db.query(PostSave).filter(
                PostSave.post_id == p.post_id, PostSave.user_id == current_user.user_id
            ).first()
            or (p.recipe_id and db.query(Save).filter(
                Save.recipe_id == p.recipe_id, Save.user_id == current_user.user_id
            ).first())
        )),
        media=[PostMediaSchema(media_url=m.media_url, media_type=m.media_type, sort_order=m.sort_order) for m in p.media],
        created_at=p.created_at,
    )


@router.post("/{post_id}/save")
def save_post(
    post_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(
        Post.post_id == post_id, Post.moderation_status == "approved"
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    _require_post_visibility(db, post, current_user)
    if not db.query(PostSave).filter(
        PostSave.user_id == current_user.user_id, PostSave.post_id == post_id
    ).first():
        db.add(PostSave(user_id=current_user.user_id, post_id=post_id))
        db.commit()
    return {"saved": True}


@router.delete("/{post_id}/save")
def unsave_post(
    post_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    _require_post_visibility(db, post, current_user)
    db.query(PostSave).filter(
        PostSave.user_id == current_user.user_id, PostSave.post_id == post_id
    ).delete()
    db.commit()
    return {"saved": False}


@router.post(
    "/{post_id}/share",
    dependencies=[Depends(rate_limit("post_share", 30, 60))],
)
def share_post(
    post_id: uuid.UUID,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(
        Post.post_id == post_id, Post.moderation_status == "approved"
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    _require_post_visibility(db, post, current_user)
    db.add(PostShare(user_id=current_user.user_id if current_user else None, post_id=post_id))
    db.commit()
    return {"shares_count": _shares_count(db, post_id), "share_url": f"/posts/{post_id}"}


@router.post("/{post_id}/like")
def toggle_like_post(
    post_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(
        Post.post_id == post_id, Post.moderation_status == "approved"
    ).with_for_update().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    _require_post_visibility(db, post, current_user)
    existing = db.query(Like).filter(
        Like.post_id == post_id, Like.user_id == current_user.user_id
    ).all()
    if existing:
        for like in existing:
            db.delete(like)
        db.commit()
        return {"liked": False, "likes_count": _likes_count(db, post_id)}

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
    return {"liked": True, "likes_count": _likes_count(db, post_id)}


@router.put("/{post_id}/like")
def like_post(
    post_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(
        Post.post_id == post_id, Post.moderation_status == "approved"
    ).with_for_update().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    _require_post_visibility(db, post, current_user)
    if not db.query(Like).filter(Like.post_id == post_id, Like.user_id == current_user.user_id).first():
        db.add(Like(post_id=post_id, user_id=current_user.user_id))
        db.commit()
    return {"liked": True, "likes_count": _likes_count(db, post_id)}


@router.delete("/{post_id}/like")
def unlike_post(
    post_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(
        Post.post_id == post_id, Post.moderation_status == "approved"
    ).with_for_update().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    _require_post_visibility(db, post, current_user)
    db.query(Like).filter(Like.post_id == post_id, Like.user_id == current_user.user_id).delete()
    db.commit()
    return {"liked": False, "likes_count": _likes_count(db, post_id)}


@router.get("/{post_id}/comments", response_model=List[CommentResponse])
def get_post_comments(
    post_id: uuid.UUID,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.post_id == post_id, Post.moderation_status == "approved").first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    _require_post_visibility(db, post, current_user)
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
    post = db.query(Post).filter(
        Post.post_id == post_id, Post.moderation_status == "approved"
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    _require_post_visibility(db, post, current_user)
    if req.parent_comment_id:
        parent = db.query(Comment).filter(
            Comment.comment_id == req.parent_comment_id, Comment.post_id == post_id
        ).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent comment must belong to this post.")

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


@router.post("/{post_id}/comments", response_model=CommentResponse, include_in_schema=False)
def comment_on_post_plural_alias(
    post_id: uuid.UUID,
    req: CommentCreate,
    current_user: UserAccount = Depends(require_permission("post.comment")),
    db: Session = Depends(get_db),
):
    return comment_on_post(post_id, req, current_user, db)


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(Comment.comment_id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")
    if comment.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the author can delete this comment.")
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted."}


@router.patch("/comments/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: uuid.UUID,
    req: CommentUpdate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(Comment.comment_id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")
    if comment.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the author can edit this comment.")
    comment.body = req.content
    comment.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(comment)
    return CommentResponse(
        comment_id=comment.comment_id,
        user_id=comment.user_id,
        parent_comment_id=comment.parent_comment_id,
        content=comment.body,
        created_at=comment.created_at,
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
    if not db.query(UserAccount).filter(UserAccount.user_id == target_user_id).first():
        raise HTTPException(status_code=404, detail="Creator profile not found.")

    existing = (
        db.query(Follow)
        .filter(Follow.follower_id == current_user.user_id, Follow.following_id == target_user_id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"following": False}

    target = db.query(UserAccount).filter(UserAccount.user_id == target_user_id).first()
    requires_approval = bool(target.profile and target.profile.is_private)
    db.add(Follow(
        follower_id=current_user.user_id,
        following_id=target_user_id,
        status="pending" if requires_approval else "accepted",
    ))
    _create_notification(
        db,
        target_user_id,
        "social",
        "Follow request" if requires_approval else "New follower",
        f"{current_user.full_name} requested to follow your kitchen." if requires_approval else f"{current_user.full_name} started following your kitchen.",
        f"/profile/{current_user.username or current_user.user_id}",
    )
    db.commit()
    return {"following": not requires_approval, "requested": requires_approval}


@router.post("/follow-requests/{follower_id}/accept")
def accept_follow_request(
    follower_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = db.query(Follow).filter(
        Follow.follower_id == follower_id,
        Follow.following_id == current_user.user_id,
        Follow.status == "pending",
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Follow request not found.")
    request.status = "accepted"
    db.commit()
    return {"following": True}


@router.delete("/follow-requests/{follower_id}")
def reject_follow_request(
    follower_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = db.query(Follow).filter(
        Follow.follower_id == follower_id,
        Follow.following_id == current_user.user_id,
        Follow.status == "pending",
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Follow request not found.")
    db.delete(request)
    db.commit()
    return {"message": "Follow request declined."}


@router.post("/report")
def report_content(
    req: ReportCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.target_type == "post":
        exists = db.query(Post.post_id).filter(Post.post_id == req.target_id).first()
    elif req.target_type == "comment":
        exists = db.query(Comment.comment_id).filter(Comment.comment_id == req.target_id).first()
    elif req.target_type == "user":
        exists = db.query(UserAccount.user_id).filter(UserAccount.user_id == req.target_id).first()
    elif req.target_type == "recipe":
        exists = db.query(Recipe.recipe_id).filter(Recipe.recipe_id == req.target_id).first()
    else:
        exists = True
    if not exists:
        raise HTTPException(status_code=404, detail="Content to report was not found.")
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


def _get_public_profile(
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
    is_following = False
    if current_user:
        is_following = db.query(Follow).filter(
            Follow.follower_id == current_user.user_id, Follow.following_id == target.user_id,
            Follow.status == "accepted",
        ).first() is not None
    is_follow_requested = bool(current_user and db.query(Follow).filter(
        Follow.follower_id == current_user.user_id, Follow.following_id == target.user_id,
        Follow.status == "pending",
    ).first())
    can_view = _can_view_profile(db, target.profile, current_user)

    followers_count = db.query(Follow).filter(
        Follow.following_id == target.user_id, Follow.status == "accepted"
    ).count()
    following_count = db.query(Follow).filter(
        Follow.follower_id == target.user_id, Follow.status == "accepted"
    ).count()

    recipes = (
        db.query(Recipe)
        .filter(
            Recipe.author_id == target.user_id,
            Recipe.moderation_status == "approved",
            Recipe.is_published.is_(True),
        )
        .order_by(desc(Recipe.created_at))
        .limit(12)
        .all()
    ) if can_view else []
    posts = db.query(Post).filter(
        Post.author_id == target.user_id, Post.moderation_status == "approved"
    ).order_by(desc(Post.created_at)).limit(12).all() if can_view else []
    return {
        "user_id": str(target.user_id),
        "full_name": target.full_name,
        "username": target.username,
        "account_tier": target.account_tier,
        "is_verified": target.is_verified,
        "avatar_url": target.avatar_url,
        "bio": (target.profile.bio if target.profile else None) if can_view else None,
        "cover_image_url": (
            target.profile.cover_image_url if can_view and target.profile else None
        ),
        "cuisine_interests": (
            (target.profile.cuisine_interests or []) if can_view and target.profile else []
        ),
        "website_url": (
            target.profile.website_url if can_view and target.profile else None
        ),
        "social_links": (
            (target.profile.social_links or {}) if can_view and target.profile else {}
        ),
        "is_private": bool(target.profile and target.profile.is_private),
        "can_view_content": can_view,
        "city": (
            target.profile.city if can_view and target.profile else None
        ),
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
        "follow_requested": is_follow_requested,
        "posts": [dict(_serialize_post(db, p, current_user).model_dump(mode="json")) for p in posts],
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
