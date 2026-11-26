import uuid
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import ensure_owner_or_permission, get_current_user, require_permission
from app.models.admin import Notification
from app.models.planning import MealPlan, MealPlanItem
from app.models.recipe import Recipe
from app.models.user import UserAccount
from app.schemas.planning import (
    AIMealPlanGenerateRequest,
    MealPlanItemCreate,
    MealPlanItemResponse,
    MealPlanItemUpdate,
    MealPlanResponse,
)

router = APIRouter(prefix="/meal-plans", tags=["Meal Planner"])


def _serialize_item(item: MealPlanItem) -> MealPlanItemResponse:
    r = item.recipe
    cal = float(r.nutrition.calories) if (r and r.nutrition) else 320.0
    prot = float(r.nutrition.protein_g) if (r and r.nutrition) else 14.0
    return MealPlanItemResponse(
        item_id=item.item_id,
        recipe_id=item.recipe_id,
        recipe_title=r.title if r else "Recipe",
        recipe_image=r.image_url if r else None,
        calories=cal,
        protein_g=prot,
        meal_date=item.meal_date,
        meal_type=item.meal_type,
        servings=item.servings,
    )


def _get_or_create_plan(user: UserAccount, db: Session, days: int = 7) -> MealPlan:
    today = date.today()
    plan = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user.user_id, MealPlan.end_date >= today)
        .order_by(MealPlan.start_date.desc())
        .first()
    )
    if not plan:
        plan = MealPlan(
            user_id=user.user_id,
            plan_name="Weekly Culinary Plan",
            week_start=today,
            start_date=today,
            end_date=today + timedelta(days=days),
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
    return plan


@router.get("/current", response_model=MealPlanResponse)
def get_current_meal_plan(
    view_mode: str = Query("weekly", description="daily, weekly, monthly"),
    current_user: UserAccount = Depends(require_permission("mealplan.manage_own")),
    db: Session = Depends(get_db),
):
    plan = _get_or_create_plan(current_user, db)
    today = date.today()
    items = plan.items
    if view_mode == "daily":
        items = [i for i in items if i.meal_date == today]
    elif view_mode == "weekly":
        items = [i for i in items if today - timedelta(days=1) <= i.meal_date <= today + timedelta(days=7)]

    return MealPlanResponse(
        plan_id=plan.plan_id,
        plan_name=plan.plan_name,
        start_date=plan.start_date,
        end_date=plan.end_date,
        items=[_serialize_item(i) for i in items],
    )


@router.post("/items", response_model=MealPlanItemResponse)
def add_meal_plan_item(
    req: MealPlanItemCreate,
    current_user: UserAccount = Depends(require_permission("mealplan.manage_own")),
    db: Session = Depends(get_db),
):
    plan = _get_or_create_plan(current_user, db)
    recipe = db.query(Recipe).filter(Recipe.recipe_id == req.recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")

    if req.meal_date > plan.end_date:
        plan.end_date = req.meal_date

    new_item = MealPlanItem(
        plan_id=plan.plan_id,
        recipe_id=req.recipe_id,
        meal_date=req.meal_date,
        meal_type=req.meal_type,
        servings=req.servings,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return _serialize_item(new_item)


@router.patch("/items/{item_id}", response_model=MealPlanItemResponse)
def update_meal_plan_item(
    item_id: uuid.UUID,
    req: MealPlanItemUpdate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(MealPlanItem).filter(MealPlanItem.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Meal item not found.")
    ensure_owner_or_permission(current_user, item.plan.user_id, "user.manage", db)

    if req.meal_date is not None:
        item.meal_date = req.meal_date
    if req.meal_type is not None:
        item.meal_type = req.meal_type
    if req.servings is not None:
        item.servings = req.servings
    db.commit()
    db.refresh(item)
    return _serialize_item(item)


@router.delete("/items/{item_id}")
def delete_meal_plan_item(
    item_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(MealPlanItem).filter(MealPlanItem.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Meal item not found.")
    ensure_owner_or_permission(current_user, item.plan.user_id, "user.manage", db)
    db.delete(item)
    db.commit()
    return {"message": "Meal plan item removed."}


@router.post("/ai-generate", response_model=MealPlanResponse)
def ai_generate_meal_plan(
    req: AIMealPlanGenerateRequest,
    current_user: UserAccount = Depends(require_permission("mealplan.manage_own")),
    db: Session = Depends(get_db),
):
    plan = _get_or_create_plan(current_user, db, days=req.days)
    recipes = db.query(Recipe).filter(Recipe.moderation_status == "approved").all()
    if req.diet_preference in {"veg", "vegan"}:
        filtered = [r for r in recipes if r.diet_type in {"veg", "vegan"}]
        if filtered:
            recipes = filtered
    if not recipes:
        raise HTTPException(status_code=400, detail="No approved recipes available to generate plan.")

    slots = ["breakfast", "lunch", "dinner"]
    idx = 0
    for d in range(min(req.days, 14)):
        target_date = req.start_date + timedelta(days=d)
        for slot in slots:
            r = recipes[idx % len(recipes)]
            idx += 1
            db.add(
                MealPlanItem(
                    plan_id=plan.plan_id,
                    recipe_id=r.recipe_id,
                    meal_date=target_date,
                    meal_type=slot,
                    servings=req.family_size,
                )
            )
    if req.start_date + timedelta(days=req.days) > plan.end_date:
        plan.end_date = req.start_date + timedelta(days=req.days)

    db.add(
        Notification(
            user_id=current_user.user_id,
            type="meal_reminder",
            title="AI Meal Plan Ready",
            body=f"Generated a {req.days}-day {req.diet_preference} plan for {req.family_size} servings ({req.budget_tier} budget).",
            action_url="/meal-planner",
        )
    )
    db.commit()
    db.refresh(plan)
    return MealPlanResponse(
        plan_id=plan.plan_id,
        plan_name=plan.plan_name,
        start_date=plan.start_date,
        end_date=plan.end_date,
        items=[_serialize_item(i) for i in plan.items],
    )
