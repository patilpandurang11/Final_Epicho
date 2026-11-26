import re
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import (
    ensure_owner_or_permission,
    get_current_user,
    require_permission,
)
from app.models.admin import ModerationReport
from app.models.planning import Ingredient
from app.models.recipe import (
    Recipe,
    RecipeIngredient,
    RecipeNutrition,
    RecipeReview,
    RecipeStep,
    RecipeVersion,
)
from app.models.social import Save
from app.models.user import UserAccount
from app.schemas.recipe import (
    RecipeCreate,
    RecipeDetailResponse,
    RecipeRemixRequest,
    RecipeReviewCreate,
    RecipeUpdate,
    RecipeVersionResponse,
)

router = APIRouter(prefix="/recipes", tags=["Recipes"])


def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"[-\s]+", "-", text) or "recipe"


def _snapshot_recipe(recipe: Recipe) -> dict:
    return {
        "title": recipe.title,
        "description": recipe.description,
        "cuisine_type": recipe.cuisine_type,
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


@router.get("", response_model=List[RecipeDetailResponse])
def get_recipes(
    cuisine: Optional[str] = None,
    diet: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(Recipe).filter(Recipe.moderation_status == "approved")
    if cuisine:
        query = query.filter(Recipe.cuisine_type.ilike(f"%{cuisine}%"))
    if diet:
        query = query.filter(Recipe.diet_type == diet)
    if difficulty:
        query = query.filter(Recipe.difficulty_level == difficulty)
    if search:
        query = query.filter(
            or_(
                Recipe.title.ilike(f"%{search}%"),
                Recipe.description.ilike(f"%{search}%"),
                Recipe.cuisine_type.ilike(f"%{search}%"),
            )
        )
    return query.order_by(desc(Recipe.created_at)).offset(offset).limit(limit).all()


@router.get("/saved", response_model=List[RecipeDetailResponse])
def get_saved_recipes(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipes = (
        db.query(Recipe)
        .join(Save, Save.recipe_id == Recipe.recipe_id)
        .filter(Save.user_id == current_user.user_id)
        .order_by(desc(Save.created_at))
        .all()
    )
    return recipes


@router.get("/{slug_or_id}", response_model=RecipeDetailResponse)
def get_recipe(slug_or_id: str, db: Session = Depends(get_db)):
    recipe = None
    try:
        recipe_uuid = uuid.UUID(slug_or_id)
        recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_uuid).first()
    except ValueError:
        recipe = db.query(Recipe).filter(Recipe.slug == slug_or_id).first()

    if not recipe or recipe.moderation_status == "removed":
        raise HTTPException(status_code=404, detail="Recipe not found.")

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
        diet_type=req.diet_type,
        prep_time_mins=req.prep_time_mins,
        cook_time_mins=req.cook_time_mins,
        difficulty_level=req.difficulty_level,
        recipe_source="ai" if req.is_ai_generated else "user",
        servings=req.servings,
        equipment_required=req.equipment_required,
        is_ai_generated=req.is_ai_generated,
        is_premium=req.is_premium,
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
def get_recipe_versions(recipe_id: uuid.UUID, db: Session = Depends(get_db)):
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
    existing = db.query(Save).filter(Save.user_id == current_user.user_id, Save.recipe_id == recipe_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"saved": False}

    db.add(Save(user_id=current_user.user_id, recipe_id=recipe_id))
    db.commit()
    return {"saved": True}


@router.get("/{recipe_id}/reviews")
def get_recipe_reviews(recipe_id: uuid.UUID, db: Session = Depends(get_db)):
    reviews = (
        db.query(RecipeReview)
        .filter(RecipeReview.recipe_id == recipe_id)
        .order_by(desc(RecipeReview.created_at))
        .all()
    )
    return [
        {
            "review_id": str(r.review_id),
            "user_id": str(r.user_id),
            "author_name": r.user.full_name if r.user else "Home Cook",
            "rating": r.rating,
            "comment": r.comment,
            "verified_cooked": r.verified_cooked,
            "created_at": r.created_at,
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
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    if req.rating < 1 or req.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")

    review = RecipeReview(
        recipe_id=recipe_id,
        user_id=current_user.user_id,
        rating=req.rating,
        comment=req.review_text,
        verified_cooked=bool(req.cooked_image_url),
    )
    db.add(review)
    db.commit()
    return {"message": "Review submitted successfully.", "review_id": str(review.review_id)}


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
