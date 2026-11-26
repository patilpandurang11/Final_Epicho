from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class RecipeIngredientSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ingredient_name: str
    quantity: float
    unit: str
    substitution_notes: Optional[str] = None


class RecipeIngredientCreate(BaseModel):
    ingredient_name: str
    quantity: float
    unit: str
    notes: Optional[str] = None


class RecipeStepSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    step_number: int
    instruction: str
    timer_seconds: Optional[int] = None
    tip: Optional[str] = None
    common_mistake: Optional[str] = None


class RecipeNutritionSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: Optional[float] = 0.0
    sodium_mg: Optional[float] = 0.0
    health_score: Optional[float] = 85.0
    data_source: str = "EpiCho Nutrition Lab & USDA DB"


class RecipeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    cuisine_type: str = "Indian"
    diet_type: str = "veg"
    prep_time_mins: int = 15
    cook_time_mins: int = 20
    difficulty_level: str = "medium"
    servings: int = 2
    equipment_required: List[str] = []
    image_url: Optional[str] = None
    is_ai_generated: bool = False
    is_premium: bool = False
    ingredients: List[RecipeIngredientCreate] = []
    steps: List[RecipeStepSchema] = []
    nutrition: Optional[RecipeNutritionSchema] = None


class RecipeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cuisine_type: Optional[str] = None
    diet_type: Optional[str] = None
    prep_time_mins: Optional[int] = None
    cook_time_mins: Optional[int] = None
    difficulty_level: Optional[str] = None
    servings: Optional[int] = None
    equipment_required: Optional[List[str]] = None
    image_url: Optional[str] = None
    change_summary: Optional[str] = "Updated recipe details"
    ingredients: Optional[List[RecipeIngredientCreate]] = None
    steps: Optional[List[RecipeStepSchema]] = None


class RecipeAuthorSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    full_name: str
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    is_verified: bool = False


class RecipeDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recipe_id: UUID
    author_id: UUID
    author: Optional[RecipeAuthorSchema] = None
    title: str
    slug: str
    description: Optional[str] = None
    cuisine_type: str
    diet_type: str
    prep_time_mins: int
    cook_time_mins: int
    difficulty_level: str
    servings: int
    equipment_required: List[str] = []
    image_url: Optional[str] = None
    is_ai_generated: bool
    is_premium: bool
    parent_recipe_id: Optional[UUID] = None
    view_count: int
    created_at: datetime
    ingredients: List[RecipeIngredientSchema] = []
    steps: List[RecipeStepSchema] = []
    nutrition: Optional[RecipeNutritionSchema] = None


class RecipeVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    version_id: UUID
    version_number: int
    change_summary: Optional[str] = None
    snapshot: Dict[str, Any] = {}
    created_at: datetime


class RecipeRemixRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    twist_notes: str = "Personal culinary remix"


class RecipeReviewCreate(BaseModel):
    rating: int
    review_text: Optional[str] = None
    cooked_image_url: Optional[str] = None
