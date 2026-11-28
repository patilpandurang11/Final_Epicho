import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import (
    ensure_owner_or_permission,
    get_current_user,
    get_optional_user,
    require_permission,
)
from app.models.admin import ModerationReport, Notification
from app.models.planning import Ingredient
from app.models.recipe import (
    Recipe,
    RecipeIngredient,
    RecipeNutrition,
    RecipeReview,
    ReviewFeedback,
    RecipeStep,
    RecipeVersion,
)
from app.models.social import Comment, Follow, Post, Save
from app.models.user import UserAccount, UserProfile
from app.schemas.recipe import (
    RecipeCreate,
    RecipeDetailResponse,
    RecipeRemixRequest,
    RecipeReviewCreate,
    RecipeUpdate,
    RecipeVersionResponse,
)
from app.schemas.social import CommentCreate, CommentResponse

router = APIRouter(prefix="/recipes", tags=["Recipes"])


def _serialize_recipe_comment(comment: Comment) -> CommentResponse:
    return CommentResponse(
        comment_id=comment.comment_id,
        user_id=comment.user_id,
        parent_comment_id=comment.parent_comment_id,
        content=comment.body,
        created_at=comment.created_at,
        author_name=comment.user.full_name if comment.user else "Home Cook",
        avatar_url=comment.user.avatar_url if comment.user else None,
    )


def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"[-\s]+", "-", text) or "recipe"


def _snapshot_recipe(recipe: Recipe) -> dict:
    return {
        "title": recipe.title,
        "description": recipe.description,
        "cuisine_type": recipe.cuisine_type,
        "category": recipe.category,
        "allergen_tags": recipe.allergen_tags or [],
        "diet_type": recipe.diet_type,
        "prep_time_mins": recipe.prep_time_mins,
        "cook_time_mins": recipe.cook_time_mins,
        "servings": recipe.servings,
        "ingredients": [
            {"name": i.ingredient_name, "quantity": float(i.quantity), "unit": i.unit}
            for i in recipe.ingredients
        ],
        "steps": [
            {"step_number": s.step_number, "instruction": s.instruction}
            for s in recipe.steps
        ],
    }


def _ensure_recipe_visible(
    db: Session, recipe: Recipe, viewer: Optional[UserAccount]
) -> None:
    if not recipe.is_published and (
        not viewer or recipe.author_id != viewer.user_id
    ):
        raise HTTPException(status_code=404, detail="Recipe not found.")
    if recipe.moderation_status != "approved" and (
        not viewer or (recipe.author_id != viewer.user_id and viewer.account_tier != "admin")
    ):
        raise HTTPException(status_code=404, detail="Recipe not found.")
    profile = db.query(UserProfile).filter(UserProfile.user_id == recipe.author_id).first()
    if profile and profile.is_private and (not viewer or viewer.user_id != recipe.author_id):
        follows_author = viewer and db.query(Follow).filter(
            Follow.follower_id == viewer.user_id,
            Follow.following_id == recipe.author_id,
            Follow.status == "accepted",
        ).first()
        if not follows_author:
            raise HTTPException(status_code=404, detail="Recipe not found.")


@router.get("", response_model=List[RecipeDetailResponse])
def get_recipes(
    cuisine: Optional[str] = None,
    diet: Optional[str] = None,
    difficulty: Optional[str] = None,
    category: Optional[str] = Query(default=None, max_length=80),
    ingredient: Optional[str] = Query(default=None, max_length=120),
    max_prep_time: Optional[int] = Query(default=None, ge=0, le=1440),
    max_cook_time: Optional[int] = Query(default=None, ge=0, le=1440),
    servings: Optional[int] = Query(default=None, ge=1, le=30),
    search: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("recent", pattern="^(recent|popular|rating)$"),
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    query = db.query(Recipe).outerjoin(UserProfile, UserProfile.user_id == Recipe.author_id).filter(
        Recipe.moderation_status == "approved",
        Recipe.is_published.is_(True) if not current_user else (
            (Recipe.is_published.is_(True)) | (Recipe.author_id == current_user.user_id)
        ),
    )
    if current_user:
        followed = db.query(Follow.following_id).filter(
            Follow.follower_id == current_user.user_id, Follow.status == "accepted"
        )
        query = query.filter(
            (UserProfile.is_private.is_(False))
            | (UserProfile.user_id.is_(None))
            | (Recipe.author_id == current_user.user_id)
            | (Recipe.author_id.in_(followed))
        )
    else:
        query = query.filter((UserProfile.is_private.is_(False)) | UserProfile.user_id.is_(None))
    if cuisine:
        query = query.filter(Recipe.cuisine_type.ilike(f"%{cuisine}%"))
    if diet:
        query = query.filter(Recipe.diet_type == diet)
    if difficulty:
        query = query.filter(Recipe.difficulty_level == difficulty)
    if category:
        query = query.filter(Recipe.category.ilike(f"%{category}%"))
    if max_prep_time is not None:
        query = query.filter(Recipe.prep_time_mins <= max_prep_time)
    if max_cook_time is not None:
        query = query.filter(Recipe.cook_time_mins <= max_cook_time)
    if servings is not None:
        query = query.filter(Recipe.servings == servings)
    ingredient_search = ingredient or search
    if ingredient_search:
        ingredient_query = db.query(RecipeIngredient.recipe_id).join(
            Ingredient, Ingredient.ingredient_id == RecipeIngredient.ingredient_id
        ).filter(Ingredient.name.ilike(f"%{ingredient_search}%"))
        query = query.filter(Recipe.recipe_id.in_(ingredient_query))
    if search:
        query = query.filter(
            or_(
                Recipe.title.ilike(f"%{search}%"),
                Recipe.description.ilike(f"%{search}%"),
                Recipe.cuisine_type.ilike(f"%{search}%"),
            )
        )
    if sort == "popular":
        query = query.order_by(desc(Recipe.view_count), desc(Recipe.created_at))
    elif sort == "rating":
        ratings = db.query(
            RecipeReview.recipe_id.label("recipe_id"),
            func.avg(RecipeReview.rating).label("rating"),
        ).group_by(RecipeReview.recipe_id).subquery()
        query = query.outerjoin(ratings, ratings.c.recipe_id == Recipe.recipe_id).order_by(
            func.coalesce(ratings.c.rating, 0).desc(), desc(Recipe.created_at)
        )
    else:
        query = query.order_by(desc(Recipe.created_at))
    return query.offset(offset).limit(limit).all()


@router.get("/saved", response_model=List[RecipeDetailResponse])
def get_saved_recipes(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    followed = db.query(Follow.following_id).filter(
        Follow.follower_id == current_user.user_id, Follow.status == "accepted"
    )
    recipes = (
        db.query(Recipe)
        .join(Save, Save.recipe_id == Recipe.recipe_id)
        .outerjoin(UserProfile, UserProfile.user_id == Recipe.author_id)
        .filter(Save.user_id == current_user.user_id)
        .filter(
            (UserProfile.is_private.is_(False)) | UserProfile.user_id.is_(None)
            | (Recipe.author_id == current_user.user_id) | (Recipe.author_id.in_(followed))
        )
        .order_by(desc(Save.created_at))
        .all()
    )
    return recipes


def _round_quantity(value: float) -> float:
    if abs(value - round(value)) < 0.005:
        return float(round(value))
    return round(value, 2)


@router.get("/{recipe_id}/adjust-servings")
def adjust_recipe_servings(
    recipe_id: uuid.UUID,
    servings: int = Query(..., ge=1, le=30),
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    _ensure_recipe_visible(db, recipe, current_user)
    multiplier = servings / max(recipe.servings or 1, 1)
    return {
        "recipe_id": str(recipe.recipe_id),
        "original_servings": recipe.servings,
        "adjusted_servings": servings,
        "quantity_disclaimer": "Estimated quantities; exact scaling may require culinary judgment.",
        "ingredients": [
            {
                "ingredient_name": item.ingredient_name,
                "original_quantity": float(item.quantity),
                "quantity": _round_quantity(float(item.quantity) * multiplier),
                "unit": item.unit,
            }
            for item in recipe.ingredients
        ],
    }


@router.get("/{slug_or_id}", response_model=RecipeDetailResponse)
def get_recipe(
    slug_or_id: str,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    recipe = None
    try:
        recipe_uuid = uuid.UUID(slug_or_id)
        recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_uuid).first()
    except ValueError:
        recipe = db.query(Recipe).filter(Recipe.slug == slug_or_id).first()

    if not recipe or recipe.moderation_status == "removed":
        raise HTTPException(status_code=404, detail="Recipe not found.")
    _ensure_recipe_visible(db, recipe, current_user)

    recipe.view_count = (recipe.view_count or 0) + 1
    db.commit()
    return recipe


@router.post("", response_model=RecipeDetailResponse)
def create_recipe(
    req: RecipeCreate,
    current_user: UserAccount = Depends(require_permission("recipe.create")),
    db: Session = Depends(get_db),
):
    unique_slug = f"{slugify(req.title)}-{str(uuid.uuid4())[:8]}"
    new_recipe = Recipe(
        author_id=current_user.user_id,
        title=req.title,
        slug=unique_slug,
        description=req.description,
        cuisine_type=req.cuisine_type,
        category=req.category,
        allergen_tags=req.allergen_tags,
        diet_type=req.diet_type,
        prep_time_mins=req.prep_time_mins,
        cook_time_mins=req.cook_time_mins,
        difficulty_level=req.difficulty_level,
        recipe_source="ai" if req.is_ai_generated else "user",
        servings=req.servings,
        equipment_required=req.equipment_required,
        is_ai_generated=req.is_ai_generated,
        is_premium=req.is_premium,
        is_published=req.is_published,
        image_url=req.image_url or "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80",
        moderation_status="approved",
    )
    db.add(new_recipe)
    db.flush()

    for step_in in req.steps:
        db.add(
            RecipeStep(
                recipe_id=new_recipe.recipe_id,
                step_number=step_in.step_number,
                instruction=step_in.instruction,
                timer_seconds=step_in.timer_seconds,
                visual_cue=step_in.tip,
                common_mistake=step_in.common_mistake,
            )
        )

    for ing_in in req.ingredients:
        ing_row = db.query(Ingredient).filter(Ingredient.name.ilike(ing_in.ingredient_name)).first()
        if not ing_row:
            ing_row = Ingredient(
                name=ing_in.ingredient_name,
                category="General",
                calories_per_unit=50,
                standard_unit=ing_in.unit or "g",
            )
            db.add(ing_row)
            db.flush()
        db.add(
            RecipeIngredient(
                recipe_id=new_recipe.recipe_id,
                ingredient_id=ing_row.ingredient_id,
                quantity=ing_in.quantity,
                unit=ing_in.unit,
                substitution_notes=ing_in.notes,
            )
        )

    if req.nutrition:
        db.add(
            RecipeNutrition(
                recipe_id=new_recipe.recipe_id,
                calories=req.nutrition.calories,
                protein_g=req.nutrition.protein_g,
                carbs_g=req.nutrition.carbs_g,
                fat_g=req.nutrition.fat_g,
                fiber_g=req.nutrition.fiber_g or 0,
                sodium_mg=req.nutrition.sodium_mg or 0,
                health_index=int(req.nutrition.health_score or 85),
            )
        )

    db.flush()
    db.refresh(new_recipe)
    db.add(
        RecipeVersion(
            recipe_id=new_recipe.recipe_id,
            version_number=1,
            edited_by=current_user.user_id,
            change_summary="Initial published version",
            snapshot=_snapshot_recipe(new_recipe),
        )
    )
    db.commit()
    db.refresh(new_recipe)
    return new_recipe


@router.put("/{recipe_id}", response_model=RecipeDetailResponse)
def update_recipe(
    recipe_id: uuid.UUID,
    req: RecipeUpdate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    ensure_owner_or_permission(current_user, recipe.author_id, "content.moderate", db)

    if req.title is not None:
        recipe.title = req.title
    if req.description is not None:
        recipe.description = req.description
    if req.cuisine_type is not None:
        recipe.cuisine_type = req.cuisine_type
    if req.category is not None:
        recipe.category = req.category
    if req.allergen_tags is not None:
        recipe.allergen_tags = req.allergen_tags
    if req.is_published is not None:
        recipe.is_published = req.is_published
    if req.diet_type is not None:
        recipe.diet_type = req.diet_type
    if req.prep_time_mins is not None:
        recipe.prep_time_mins = req.prep_time_mins
    if req.cook_time_mins is not None:
        recipe.cook_time_mins = req.cook_time_mins
    if req.difficulty_level is not None:
        recipe.difficulty_level = req.difficulty_level
    if req.servings is not None:
        recipe.servings = req.servings
    if req.equipment_required is not None:
        recipe.equipment_required = req.equipment_required
    if req.image_url is not None:
        recipe.image_url = req.image_url

    if req.steps is not None:
        db.query(RecipeStep).filter(RecipeStep.recipe_id == recipe_id).delete()
        for step_in in req.steps:
            db.add(
                RecipeStep(
                    recipe_id=recipe_id,
                    step_number=step_in.step_number,
                    instruction=step_in.instruction,
                    timer_seconds=step_in.timer_seconds,
                    visual_cue=step_in.tip,
                    common_mistake=step_in.common_mistake,
                )
            )

    if req.ingredients is not None:
        db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).delete()
        for ing_in in req.ingredients:
            ing_row = db.query(Ingredient).filter(Ingredient.name.ilike(ing_in.ingredient_name)).first()
            if not ing_row:
                ing_row = Ingredient(name=ing_in.ingredient_name, category="General", standard_unit=ing_in.unit or "g")
                db.add(ing_row)
                db.flush()
            db.add(
                RecipeIngredient(
                    recipe_id=recipe_id,
                    ingredient_id=ing_row.ingredient_id,
                    quantity=ing_in.quantity,
                    unit=ing_in.unit,
                    substitution_notes=ing_in.notes,
                )
            )

    db.flush()
    db.refresh(recipe)
    next_ver = (db.query(RecipeVersion).filter(RecipeVersion.recipe_id == recipe_id).count()) + 1
    db.add(
        RecipeVersion(
            recipe_id=recipe_id,
            version_number=next_ver,
            edited_by=current_user.user_id,
            change_summary=req.change_summary or "Recipe updated",
            snapshot=_snapshot_recipe(recipe),
        )
    )
    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}")
def delete_recipe(
    recipe_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    ensure_owner_or_permission(current_user, recipe.author_id, "content.moderate", db)
    db.delete(recipe)
    db.commit()
    return {"message": "Recipe deleted successfully."}


@router.get("/{recipe_id}/versions", response_model=List[RecipeVersionResponse])
def get_recipe_versions(
    recipe_id: uuid.UUID,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    _ensure_recipe_visible(db, recipe, current_user)
    return (
        db.query(RecipeVersion)
        .filter(RecipeVersion.recipe_id == recipe_id)
        .order_by(desc(RecipeVersion.version_number))
        .all()
    )


@router.post("/{recipe_id}/remix", response_model=RecipeDetailResponse)
def remix_recipe(
    recipe_id: uuid.UUID,
    req: RecipeRemixRequest,
    current_user: UserAccount = Depends(require_permission("recipe.create")),
    db: Session = Depends(get_db),
):
    orig = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Original recipe not found.")
    _ensure_recipe_visible(db, orig, current_user)

    remix_title = req.title or f"{orig.title} ({current_user.full_name.split()[0]}'s Remix)"
    remixed = Recipe(
        author_id=current_user.user_id,
        parent_recipe_id=orig.recipe_id,
        title=remix_title,
        slug=f"{slugify(remix_title)}-{str(uuid.uuid4())[:8]}",
        description=req.description or f"Remixed from '{orig.title}' by {orig.author.full_name if orig.author else 'Chef'}. Twist: {req.twist_notes}",
        cuisine_type=orig.cuisine_type,
        diet_type=orig.diet_type,
        prep_time_mins=orig.prep_time_mins,
        cook_time_mins=orig.cook_time_mins,
        difficulty_level=orig.difficulty_level,
        servings=orig.servings,
        equipment_required=orig.equipment_required,
        image_url=orig.image_url,
        moderation_status="approved",
    )
    db.add(remixed)
    db.flush()

    for ing in orig.ingredients:
        db.add(
            RecipeIngredient(
                recipe_id=remixed.recipe_id,
                ingredient_id=ing.ingredient_id,
                quantity=ing.quantity,
                unit=ing.unit,
                substitution_notes=ing.substitution_notes,
            )
        )
    for st in orig.steps:
        db.add(
            RecipeStep(
                recipe_id=remixed.recipe_id,
                step_number=st.step_number,
                instruction=st.instruction,
                timer_seconds=st.timer_seconds,
                visual_cue=st.visual_cue,
                common_mistake=st.common_mistake,
            )
        )

    db.commit()
    db.refresh(remixed)
    return remixed


@router.post("/{recipe_id}/save")
def toggle_save_recipe(
    recipe_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    _ensure_recipe_visible(db, recipe, current_user)
    existing = db.query(Save).filter(Save.user_id == current_user.user_id, Save.recipe_id == recipe_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"saved": False}

    db.add(Save(user_id=current_user.user_id, recipe_id=recipe_id))
    db.commit()
    return {"saved": True}


@router.get("/{recipe_id}/reviews")
def get_recipe_reviews(
    recipe_id: uuid.UUID,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    _ensure_recipe_visible(db, recipe, current_user)
    all_reviews = (
        db.query(RecipeReview)
        .filter(
            RecipeReview.recipe_id == recipe_id,
            RecipeReview.moderation_status == "approved",
        )
        .order_by(
            RecipeReview.updated_at.desc().nullslast(),
            RecipeReview.created_at.desc().nullslast(),
            RecipeReview.review_id.desc(),
        )
        .all()
    )
    reviews_by_user = {}
    for review in all_reviews:
        reviews_by_user.setdefault(review.user_id, review)
    reviews = list(reviews_by_user.values())
    return [
        {
            "review_id": str(r.review_id),
            "user_id": str(r.user_id),
            "author_name": r.user.full_name if r.user else "Home Cook",
            "rating": r.rating,
            "comment": r.comment,
            "verified_cooked": r.verified_cooked,
            "created_at": r.created_at,
            "helpful_count": db.query(ReviewFeedback).filter(
                ReviewFeedback.review_id == r.review_id,
                ReviewFeedback.helpful.is_(True),
            ).count(),
            "unhelpful_count": db.query(ReviewFeedback).filter(
                ReviewFeedback.review_id == r.review_id,
                ReviewFeedback.helpful.is_(False),
            ).count(),
        }
        for r in reviews
    ]


@router.post("/{recipe_id}/reviews")
def review_recipe(
    recipe_id: uuid.UUID,
    req: RecipeReviewCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).with_for_update().first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    _ensure_recipe_visible(db, recipe, current_user)
    if recipe.author_id == current_user.user_id:
        raise HTTPException(status_code=403, detail="You cannot review your own recipe.")
    if req.rating < 1 or req.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")

    review = RecipeReview(
        recipe_id=recipe_id,
        user_id=current_user.user_id,
        rating=req.rating,
        comment=req.review_text,
        verified_cooked=db.query(Post.post_id).filter(
            Post.recipe_id == recipe_id,
            Post.author_id == current_user.user_id,
            Post.is_cooked_this.is_(True),
            Post.moderation_status == "approved",
            Post.media.any(),
        ).first() is not None,
    )
    existing = db.query(RecipeReview).filter(
        RecipeReview.recipe_id == recipe_id, RecipeReview.user_id == current_user.user_id
    ).order_by(
        RecipeReview.updated_at.desc().nullslast(),
        RecipeReview.created_at.desc().nullslast(),
        RecipeReview.review_id.desc(),
    ).first()
    if existing:
        existing.rating = req.rating
        existing.comment = req.review_text
        existing.verified_cooked = review.verified_cooked
        existing.updated_at = datetime.now(timezone.utc)
        review = existing
    else:
        db.add(review)
    db.commit()
    return {"message": "Review submitted successfully.", "review_id": str(review.review_id)}


@router.delete("/{recipe_id}/reviews")
def delete_recipe_review(
    recipe_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(RecipeReview).filter(
        RecipeReview.recipe_id == recipe_id, RecipeReview.user_id == current_user.user_id
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    db.delete(review)
    db.commit()
    return {"message": "Review deleted."}


@router.post("/{recipe_id}/reviews/{review_id}/report")
def report_recipe_review(
    recipe_id: uuid.UUID,
    review_id: uuid.UUID,
    reason: str = Query(..., min_length=5, max_length=2000),
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(RecipeReview).filter(
        RecipeReview.review_id == review_id,
        RecipeReview.recipe_id == recipe_id,
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    db.add(ModerationReport(
        reporter_id=current_user.user_id,
        target_type="recipe",
        target_id=review_id,
        reason=f"Reported recipe review: {reason}",
        status="open",
    ))
    db.commit()
    return {"message": "Review report submitted."}


@router.post("/{recipe_id}/reviews/{review_id}/feedback")
def submit_review_feedback(
    recipe_id: uuid.UUID,
    review_id: uuid.UUID,
    helpful: bool = Query(...),
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(RecipeReview).filter(
        RecipeReview.review_id == review_id,
        RecipeReview.recipe_id == recipe_id,
        RecipeReview.moderation_status == "approved",
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    if review.user_id == current_user.user_id:
        raise HTTPException(status_code=403, detail="You cannot vote on your own review.")
    feedback = db.query(ReviewFeedback).filter(
        ReviewFeedback.review_id == review_id,
        ReviewFeedback.user_id == current_user.user_id,
    ).first()
    if feedback:
        if feedback.helpful == helpful:
            db.delete(feedback)
            db.commit()
            action = "removed"
        else:
            feedback.helpful = helpful
            db.commit()
            action = "changed"
    else:
        db.add(ReviewFeedback(
            review_id=review_id,
            user_id=current_user.user_id,
            helpful=helpful,
        ))
        db.commit()
        action = "added"
    helpful_count = db.query(ReviewFeedback).filter(
        ReviewFeedback.review_id == review_id,
        ReviewFeedback.helpful.is_(True),
    ).count()
    unhelpful_count = db.query(ReviewFeedback).filter(
        ReviewFeedback.review_id == review_id,
        ReviewFeedback.helpful.is_(False),
    ).count()
    return {
        "action": action,
        "helpful_count": helpful_count,
        "unhelpful_count": unhelpful_count,
    }


@router.get("/{recipe_id}/reviews/{review_id}/feedback")
def get_review_feedback(
    recipe_id: uuid.UUID,
    review_id: uuid.UUID,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    review = db.query(RecipeReview).filter(
        RecipeReview.review_id == review_id,
        RecipeReview.recipe_id == recipe_id,
        RecipeReview.moderation_status == "approved",
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    helpful_count = db.query(ReviewFeedback).filter(
        ReviewFeedback.review_id == review_id,
        ReviewFeedback.helpful.is_(True),
    ).count()
    unhelpful_count = db.query(ReviewFeedback).filter(
        ReviewFeedback.review_id == review_id,
        ReviewFeedback.helpful.is_(False),
    ).count()
    own_vote = None
    if current_user:
        feedback = db.query(ReviewFeedback).filter(
            ReviewFeedback.review_id == review_id,
            ReviewFeedback.user_id == current_user.user_id,
        ).first()
        own_vote = feedback.helpful if feedback else None
    return {
        "helpful_count": helpful_count,
        "unhelpful_count": unhelpful_count,
        "own_vote": own_vote,
    }


@router.get("/{recipe_id}/comments", response_model=List[CommentResponse])
def get_recipe_comments(
    recipe_id: uuid.UUID,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    _ensure_recipe_visible(db, recipe, current_user)
    comments = db.query(Comment).filter(
        Comment.recipe_id == recipe_id
    ).order_by(Comment.created_at.asc()).all()
    return [_serialize_recipe_comment(comment) for comment in comments]


@router.post("/{recipe_id}/comments", response_model=CommentResponse)
def comment_on_recipe(
    recipe_id: uuid.UUID,
    req: CommentCreate,
    current_user: UserAccount = Depends(require_permission("post.comment")),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    _ensure_recipe_visible(db, recipe, current_user)
    if req.parent_comment_id and not db.query(Comment).filter(
        Comment.comment_id == req.parent_comment_id,
        Comment.recipe_id == recipe_id,
    ).first():
        raise HTTPException(status_code=400, detail="Parent comment must belong to this recipe.")
    comment = Comment(
        recipe_id=recipe_id,
        user_id=current_user.user_id,
        parent_comment_id=req.parent_comment_id,
        body=req.content,
    )
    db.add(comment)
    if recipe.author_id != current_user.user_id:
        db.add(Notification(
            user_id=recipe.author_id,
            type="social",
            title="New comment on your recipe",
            body=f"{current_user.full_name}: {req.content[:80]}",
            action_url=f"/recipes/{recipe.slug}",
        ))
    db.commit()
    db.refresh(comment)
    return _serialize_recipe_comment(comment)


@router.post("/{recipe_id}/report")
def report_recipe(
    recipe_id: uuid.UUID,
    reason: str = Query(..., min_length=5),
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = ModerationReport(
        reporter_id=current_user.user_id,
        recipe_id=recipe_id,
        target_type="recipe",
        target_id=recipe_id,
        reason=reason,
        status="open",
    )
    db.add(report)
    db.commit()
    return {"message": "Recipe reported for moderation review."}
