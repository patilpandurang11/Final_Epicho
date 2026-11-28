from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class RecipeIngredientSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ingredient_name: str
    quantity: float
    unit: str
    substitution_notes: Optional[str] = None


class RecipeIngredientCreate(BaseModel):
    ingredient_name: str = Field(min_length=1, max_length=120)
    quantity: float = Field(gt=0, le=10000)
    unit: str = Field(min_length=1, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=500)


class RecipeStepSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    step_number: int = Field(ge=1, le=50)
    instruction: str = Field(min_length=1, max_length=2000)
    timer_seconds: Optional[int] = Field(default=None, ge=0, le=86400)
    tip: Optional[str] = Field(default=None, max_length=500)
    common_mistake: Optional[str] = Field(default=None, max_length=500)


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
    title: str = Field(min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=4000)
    cuisine_type: str = Field(default="Indian", min_length=1, max_length=80)
    category: str = Field(default="Main Course", min_length=1, max_length=80)
    allergen_tags: List[str] = Field(default_factory=list, max_length=30)
    diet_type: Literal["veg", "non_veg", "vegan", "eggetarian", "jain"] = "veg"
    prep_time_mins: int = Field(default=15, ge=0, le=1440)
    cook_time_mins: int = Field(default=20, ge=0, le=1440)
    difficulty_level: Literal["easy", "medium", "hard"] = "medium"
    servings: int = Field(default=2, ge=1, le=30)
    equipment_required: List[str] = Field(default_factory=list, max_length=20)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    is_ai_generated: bool = False
    is_premium: bool = False
    is_published: bool = True
    ingredients: List[RecipeIngredientCreate] = Field(min_length=1, max_length=100)
    steps: List[RecipeStepSchema] = Field(min_length=1, max_length=50)
    nutrition: Optional[RecipeNutritionSchema] = None


class RecipeUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=4000)
    cuisine_type: Optional[str] = Field(default=None, min_length=1, max_length=80)
    category: Optional[str] = Field(default=None, min_length=1, max_length=80)
    allergen_tags: Optional[List[str]] = Field(default=None, max_length=30)
    is_published: Optional[bool] = None
    diet_type: Optional[Literal["veg", "non_veg", "vegan", "eggetarian", "jain"]] = None
    prep_time_mins: Optional[int] = Field(default=None, ge=0, le=1440)
    cook_time_mins: Optional[int] = Field(default=None, ge=0, le=1440)
    difficulty_level: Optional[Literal["easy", "medium", "hard"]] = None
    servings: Optional[int] = Field(default=None, ge=1, le=30)
    equipment_required: Optional[List[str]] = Field(default=None, max_length=20)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    change_summary: Optional[str] = Field(default="Updated recipe details", max_length=500)
    ingredients: Optional[List[RecipeIngredientCreate]] = Field(default=None, min_length=1, max_length=100)
    steps: Optional[List[RecipeStepSchema]] = Field(default=None, min_length=1, max_length=50)


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
    category: str = "Main Course"
    allergen_tags: List[str] = []
    is_published: bool = True
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
    average_rating: float = 0.0
    review_count: int = 0
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
    rating: int = Field(ge=1, le=5)
    review_text: Optional[str] = Field(default=None, max_length=2000)
    cooked_image_url: Optional[str] = Field(default=None, max_length=2048)
