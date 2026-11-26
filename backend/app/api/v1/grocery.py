import urllib.parse
import uuid
from datetime import date, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import ensure_owner_or_permission, get_current_user, require_permission
from app.models.planning import GroceryList, GroceryListItem, Ingredient, MealPlan, PantryItem
from app.models.recipe import Recipe
from app.models.user import UserAccount
from app.schemas.planning import (
    GroceryItemResponse,
    GroceryListResponse,
    PantryItemCreate,
    PantryItemResponse,
    ShoppingLink,
)

router = APIRouter(prefix="/grocery", tags=["Smart Grocery & Pantry"])

PRICE_ESTIMATE_INR = {
    "Vegetables": 45.0,
    "Dairy": 85.0,
    "Spices": 35.0,
    "Grains": 65.0,
    "Protein": 110.0,
    "General": 50.0,
}


def _build_shopping_links(ingredient_name: str) -> List[ShoppingLink]:
    q = urllib.parse.quote_plus(ingredient_name)
    return [
        ShoppingLink(partner="Blinkit", url=f"https://blinkit.com/s/?q={q}"),
        ShoppingLink(partner="BigBasket", url=f"https://www.bigbasket.com/ps/?q={q}"),
        ShoppingLink(partner="Zepto", url=f"https://www.zeptonow.com/search?query={q}"),
    ]


def _estimate_cost(category: str, qty: float) -> float:
    base = PRICE_ESTIMATE_INR.get(category, 50.0)
    return round(max(15.0, min(450.0, base * max(0.5, qty / 2.0))), 2)


@router.post("/generate/{plan_id}", response_model=GroceryListResponse)
def generate_grocery_list(
    plan_id: uuid.UUID,
    subtract_pantry: bool = Query(True),
    current_user: UserAccount = Depends(require_permission("grocery.manage_own")),
    db: Session = Depends(get_db),
):
    plan = db.query(MealPlan).filter(MealPlan.plan_id == plan_id, MealPlan.user_id == current_user.user_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found.")

    grocery_list = db.query(GroceryList).filter(GroceryList.plan_id == plan_id).first()
    if not grocery_list:
        grocery_list = GroceryList(plan_id=plan_id, fulfillment_status="draft")
        db.add(grocery_list)
        db.flush()
    else:
        db.query(GroceryListItem).filter(GroceryListItem.list_id == grocery_list.list_id).delete()
        db.flush()

    pantry_map = {}
    if subtract_pantry:
        for p in db.query(PantryItem).filter(PantryItem.user_id == current_user.user_id).all():
            pantry_map[p.ingredient_id] = float(p.quantity)

    aggregated = {}
    for item in plan.items:
        recipe = item.recipe
        if not recipe:
            continue
        servings_mult = item.servings / max(recipe.servings or 2, 1)
        for rec_ing in recipe.ingredients:
            ing_id = rec_ing.ingredient_id
            qty = float(rec_ing.quantity) * servings_mult
            if ing_id not in aggregated:
                aggregated[ing_id] = {"quantity": qty, "unit": rec_ing.unit}
            else:
                aggregated[ing_id]["quantity"] += qty

    items_res = []
    total_cost = 0.0
    for ing_id, data in aggregated.items():
        needed = data["quantity"]
        pantry_avail = pantry_map.get(ing_id, 0.0)
        final_qty = max(0.0, needed - pantry_avail) if subtract_pantry else needed
        if final_qty <= 0:
            continue
        it = GroceryListItem(
            list_id=grocery_list.list_id,
            ingredient_id=ing_id,
            quantity=round(final_qty, 2),
            unit=data["unit"],
            purchased=False,
        )
        db.add(it)
        db.flush()
        ing = db.query(Ingredient).filter(Ingredient.ingredient_id == ing_id).first()
        ing_name = ing.name if ing else "Ingredient"
        cat = ing.category if ing else "General"
        est = _estimate_cost(cat, float(it.quantity))
        total_cost += est
        items_res.append(
            GroceryItemResponse(
                item_id=it.item_id,
                ingredient_name=ing_name,
                category=cat,
                quantity=float(it.quantity),
                unit=it.unit,
                purchased=False,
                in_pantry=pantry_avail > 0,
                estimated_cost_inr=est,
                shopping_links=_build_shopping_links(ing_name),
            )
        )

    db.commit()
    return GroceryListResponse(
        list_id=grocery_list.list_id,
        plan_id=plan.plan_id,
        fulfillment_status=grocery_list.fulfillment_status,
        total_estimated_cost_inr=round(total_cost, 2),
        items=items_res,
    )


@router.post("/from-recipe/{recipe_id}", response_model=GroceryListResponse)
def generate_grocery_from_recipe(
    recipe_id: uuid.UUID,
    servings: int = Query(2, ge=1),
    current_user: UserAccount = Depends(require_permission("grocery.manage_own")),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")

    today = date.today()
    plan = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == current_user.user_id, MealPlan.end_date >= today)
        .first()
    )
    if not plan:
        plan = MealPlan(
            user_id=current_user.user_id,
            plan_name="Quick Recipe Grocery Plan",
            week_start=today,
            start_date=today,
            end_date=today + timedelta(days=7),
        )
        db.add(plan)
        db.flush()

    grocery_list = db.query(GroceryList).filter(GroceryList.plan_id == plan.plan_id).first()
    if not grocery_list:
        grocery_list = GroceryList(plan_id=plan.plan_id, fulfillment_status="active")
        db.add(grocery_list)
        db.flush()

    mult = servings / max(recipe.servings or 2, 1)
    items_res = []
    total_cost = 0.0
    for rec_ing in recipe.ingredients:
        qty = round(float(rec_ing.quantity) * mult, 2)
        it = GroceryListItem(
            list_id=grocery_list.list_id,
            ingredient_id=rec_ing.ingredient_id,
            quantity=qty,
            unit=rec_ing.unit,
            purchased=False,
        )
        db.add(it)
        db.flush()
        ing_name = rec_ing.ingredient_name
        cat = rec_ing.ingredient.category if rec_ing.ingredient else "General"
        est = _estimate_cost(cat, qty)
        total_cost += est
        items_res.append(
            GroceryItemResponse(
                item_id=it.item_id,
                ingredient_name=ing_name,
                category=cat,
                quantity=qty,
                unit=it.unit,
                purchased=False,
                in_pantry=False,
                estimated_cost_inr=est,
                shopping_links=_build_shopping_links(ing_name),
            )
        )
    db.commit()
    return GroceryListResponse(
        list_id=grocery_list.list_id,
        plan_id=plan.plan_id,
        fulfillment_status=grocery_list.fulfillment_status,
        total_estimated_cost_inr=round(total_cost, 2),
        items=items_res,
    )


@router.patch("/items/{item_id}/toggle")
def toggle_grocery_item(
    item_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(GroceryListItem).filter(GroceryListItem.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    ensure_owner_or_permission(current_user, item.grocery_list.plan.user_id, "user.manage", db)
    item.purchased = not item.purchased
    db.commit()
    return {"purchased": item.purchased}


@router.get("/pantry", response_model=List[PantryItemResponse])
def get_pantry(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = db.query(PantryItem).filter(PantryItem.user_id == current_user.user_id).all()
    return [
        PantryItemResponse(
            pantry_id=p.pantry_id,
            ingredient_name=p.ingredient.name if p.ingredient else "Ingredient",
            category=p.ingredient.category if p.ingredient else "Pantry",
            quantity=float(p.quantity),
            unit=p.unit,
            expiry_date=p.expiry_date,
        )
        for p in items
    ]


@router.post("/pantry", response_model=PantryItemResponse)
def add_pantry_item(
    req: PantryItemCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ing = db.query(Ingredient).filter(Ingredient.name.ilike(req.ingredient_name)).first()
    if not ing:
        ing = Ingredient(name=req.ingredient_name, category="Pantry", calories_per_unit=50, standard_unit=req.unit)
        db.add(ing)
        db.flush()

    pantry_item = PantryItem(
        user_id=current_user.user_id,
        ingredient_id=ing.ingredient_id,
        quantity=req.quantity,
        unit=req.unit,
        expiry_date=req.expiry_date,
    )
    db.add(pantry_item)
    db.commit()
    db.refresh(pantry_item)
    return PantryItemResponse(
        pantry_id=pantry_item.pantry_id,
        ingredient_name=ing.name,
        category=ing.category,
        quantity=float(pantry_item.quantity),
        unit=pantry_item.unit,
        expiry_date=pantry_item.expiry_date,
    )


@router.delete("/pantry/{pantry_id}")
def delete_pantry_item(
    pantry_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(PantryItem).filter(PantryItem.pantry_id == pantry_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pantry item not found.")
    ensure_owner_or_permission(current_user, p.user_id, "user.manage", db)
    db.delete(p)
    db.commit()
    return {"message": "Removed from pantry."}
