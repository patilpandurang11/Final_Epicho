from datetime import date
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class MealPlanItemCreate(BaseModel):
    recipe_id: UUID
    meal_date: date
    meal_type: str
    servings: int = 2


class MealPlanItemUpdate(BaseModel):
    meal_date: Optional[date] = None
    meal_type: Optional[str] = None
    servings: Optional[int] = None


class MealPlanItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: UUID
    recipe_id: UUID
    recipe_title: Optional[str] = None
    recipe_image: Optional[str] = None
    calories: Optional[float] = 0.0
    protein_g: Optional[float] = 0.0
    meal_date: date
    meal_type: str
    servings: int


class MealPlanCreate(BaseModel):
    plan_name: str = "My Weekly Meal Plan"
    start_date: date
    end_date: date


class AIMealPlanGenerateRequest(BaseModel):
    start_date: date
    days: int = 7
    diet_preference: str = "veg"
    family_size: int = 2
    budget_tier: str = "moderate"
    daily_calorie_target: int = 2000


class MealPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plan_id: UUID
    plan_name: str
    start_date: date
    end_date: date
    items: List[MealPlanItemResponse] = []


class ShoppingLink(BaseModel):
    partner: str
    url: str


class GroceryItemResponse(BaseModel):
    item_id: UUID
    ingredient_name: str
    category: str
    quantity: float
    unit: str
    purchased: bool
    in_pantry: bool = False
    estimated_cost_inr: float = 0.0
    shopping_links: List[ShoppingLink] = []


class GroceryListResponse(BaseModel):
    list_id: UUID
    plan_id: UUID
    fulfillment_status: str
    total_estimated_cost_inr: float = 0.0
    items: List[GroceryItemResponse] = []


class PantryItemCreate(BaseModel):
    ingredient_name: str
    quantity: float
    unit: str = "g"
    expiry_date: Optional[date] = None


class PantryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pantry_id: UUID
    ingredient_name: str
    category: str
    quantity: float
    unit: str
    expiry_date: Optional[date] = None
