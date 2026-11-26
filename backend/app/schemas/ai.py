from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class IngredientInput(BaseModel):
    name: str
    quantity: float = 1.0
    unit: str = "cup"
    notes: Optional[str] = None
    is_optional: bool = False


class StepInput(BaseModel):
    step_number: int
    instruction: str
    timer_seconds: Optional[int] = None
    tip: Optional[str] = None
    common_mistake: Optional[str] = None


class NutritionInfo(BaseModel):
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float = 0.0
    sodium_mg: float = 0.0
    iron_mg: float = 1.8
    calcium_mg: float = 65.0
    vitamin_c_mg: float = 12.0
    health_score: float = 85.0
    data_source: str = "EpiCho Nutrition Lab & USDA DB"


class SubstitutionItem(BaseModel):
    original: str
    substitute: str
    notes: str


class AIKitchenGenerateRequest(BaseModel):
    ingredients: List[str] = Field(..., description="List of available ingredients")
    cuisine_preference: str = "Indian"
    taste_preference: str = "tangy & spicy"
    diet_preference: str = "veg"
    servings: int = 2
    cooking_time_mins: int = 30
    cooking_equipment: List[str] = ["Pan", "Knife", "Stove"]
    dietary_restrictions: List[str] = []
    allergies: List[str] = []
    fusion_cuisine: Optional[str] = None
    fusion_intensity: int = 5


class AIKitchenRecipeResponse(BaseModel):
    request_id: Optional[UUID] = None
    title: str
    description: str
    cuisine_type: str
    diet_type: str
    prep_time_mins: int
    cook_time_mins: int
    servings: int
    difficulty_level: str
    equipment_required: List[str]
    ingredients: List[IngredientInput]
    steps: List[StepInput]
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
    modification_prompt: str


class AIKitchenTranslateRequest(BaseModel):
    recipe: AIKitchenRecipeResponse
    target_language: str = "Hindi"


class AIKitchenReportRequest(BaseModel):
    reason: str


class AIHistoryItem(BaseModel):
    request_id: UUID
    request_type: str
    prompt: str
    allergen_check_passed: bool
    flagged_unsafe: bool
    created_at: datetime
    recipe: Optional[AIKitchenRecipeResponse] = None
