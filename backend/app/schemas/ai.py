from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_validator


class IngredientInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    quantity: float = Field(default=1.0, gt=0, le=10000)
    unit: str = Field(default="cup", min_length=1, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=500)
    is_optional: bool = False


class StepInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    step_number: int = Field(ge=1, le=40)
    instruction: str = Field(min_length=1, max_length=2000)
    timer_seconds: Optional[int] = Field(default=None, ge=0, le=86400)
    tip: Optional[str] = Field(default=None, max_length=500)
    common_mistake: Optional[str] = Field(default=None, max_length=500)


class NutritionInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calories: float = Field(ge=0, le=100000)
    protein_g: float = Field(ge=0, le=10000)
    carbs_g: float = Field(ge=0, le=10000)
    fat_g: float = Field(ge=0, le=10000)
    fiber_g: float = Field(default=0.0, ge=0, le=10000)
    sodium_mg: float = Field(default=0.0, ge=0, le=1000000)
    iron_mg: float = Field(default=1.8, ge=0, le=10000)
    calcium_mg: float = Field(default=65.0, ge=0, le=100000)
    vitamin_c_mg: float = Field(default=12.0, ge=0, le=100000)
    health_score: float = Field(default=85.0, ge=0, le=100)
    data_source: str = "EpiCho Nutrition Lab & USDA DB"


class SubstitutionItem(BaseModel):
    original: str
    substitute: str
    notes: str


class AIKitchenGenerateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    ingredients: List[str] = Field(..., min_length=1, max_length=20, description="List of available ingredients")
    excluded_ingredients: List[str] = Field(default_factory=list, max_length=20)
    cuisine_preference: str = Field(default="Indian", min_length=1, max_length=80)
    dish_type: str = Field(default="Dinner", min_length=1, max_length=40)
    taste_preference: str = Field(default="tangy & spicy", min_length=1, max_length=80)
    diet_preference: str = Field(default="veg", min_length=1, max_length=30)
    servings: int = Field(default=2, ge=1, le=30)
    cooking_time_mins: int = Field(default=30, ge=1, le=480)
    cooking_equipment: List[str] = Field(default_factory=lambda: ["Pan", "Knife", "Stove"], max_length=20)
    dietary_restrictions: List[str] = Field(default_factory=list, max_length=30)
    allergies: List[str] = Field(default_factory=list, max_length=30)
    fusion_cuisine: Optional[str] = Field(default=None, max_length=80)
    fusion_intensity: int = Field(default=5, ge=1, le=10)

    @field_validator("ingredients")
    @classmethod
    def validate_ingredients(cls, values: List[str]) -> List[str]:
        normalized = [value.strip() for value in values]
        if any(not value or len(value) > 120 for value in normalized):
            raise ValueError("Ingredients must be between 1 and 120 characters.")
        if len({value.casefold() for value in normalized}) != len(normalized):
            raise ValueError("Ingredients must be unique.")
        return normalized

    @field_validator(
        "excluded_ingredients", "cooking_equipment", "dietary_restrictions", "allergies"
    )
    @classmethod
    def validate_text_lists(cls, values: List[str]) -> List[str]:
        normalized = [value.strip() for value in values]
        if any(not value or len(value) > 120 for value in normalized):
            raise ValueError("List values must be between 1 and 120 characters.")
        return normalized

class AIKitchenRecipeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: Optional[UUID] = None
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(max_length=4000)
    cuisine_type: str = Field(min_length=1, max_length=80)
    category: str = Field(default="Main Course", min_length=1, max_length=80)
    diet_type: str = Field(min_length=1, max_length=30)
    prep_time_mins: int = Field(ge=0, le=1440)
    cook_time_mins: int = Field(ge=0, le=1440)
    servings: int = Field(ge=1, le=30)
    difficulty_level: str = Field(min_length=1, max_length=30)
    equipment_required: List[str] = Field(max_length=20)
    ingredients: List[IngredientInput] = Field(min_length=1, max_length=40)
    steps: List[StepInput] = Field(min_length=1, max_length=40)
    nutrition: NutritionInfo
    allergen_warnings: List[str] = []
    cross_contamination_risks: List[str] = []
    substitutions: List[SubstitutionItem] = []
    cooking_tips: List[str] = []
    food_safety_guidance: str = "Cook proteins to safe internal temperatures and sanitize surfaces after handling raw items."
    medical_disclaimer: str = "Informational culinary & nutrition estimate only. Does not diagnose, cure, or treat medical conditions."
    is_ai_generated: bool = True
    ai_provider: str = "EpiCho Culinary Intelligence"


class AIKitchenModifyRequest(BaseModel):
    original_recipe: AIKitchenRecipeResponse
    modification_prompt: str = Field(min_length=1, max_length=1000)


class AIKitchenTranslateRequest(BaseModel):
    recipe: AIKitchenRecipeResponse
    target_language: str = Field(default="Hindi", min_length=1, max_length=40)


class AIKitchenReportRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=2000)


class AIHistoryItem(BaseModel):
    request_id: UUID
    request_type: str
    prompt: str
    allergen_check_passed: bool
    flagged_unsafe: bool
    created_at: datetime
    recipe: Optional[AIKitchenRecipeResponse] = None
