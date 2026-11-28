import json
from abc import ABC, abstractmethod
from typing import Optional

import httpx

from app.core.config import settings
from app.schemas.ai import (
    AIKitchenGenerateRequest,
    AIKitchenRecipeResponse,
    IngredientInput,
    NutritionInfo,
    StepInput,
)
from app.services.nutrition import calculate_recipe_nutrition


class AIProviderError(Exception):
    pass


class AIRecipeProvider(ABC):
    @abstractmethod
    async def generate(
        self, request: AIKitchenGenerateRequest
    ) -> AIKitchenRecipeResponse:
        raise NotImplementedError


class MockAIProvider(AIRecipeProvider):
    async def generate(
        self, request: AIKitchenGenerateRequest
    ) -> AIKitchenRecipeResponse:
        ingredients = [
            name for name in request.ingredients
            if not any(
                excluded.casefold() in name.casefold()
                for excluded in request.excluded_ingredients
            )
        ]
        if not ingredients:
            raise AIProviderError(
                "The mock provider requires at least one available, non-excluded ingredient."
            )
        ingredients = [
            IngredientInput(name=name, quantity=1.0, unit="cup")
            for name in ingredients[:]
        ]
        nutrition = calculate_recipe_nutrition(
            [{"name": item.name, "quantity": item.quantity, "unit": item.unit} for item in ingredients],
            servings=request.servings,
        )
        steps = [
            StepInput(
                step_number=1,
                instruction=(
                    f"Prepare {', '.join(item.name for item in ingredients[:4])} "
                    f"and cook with {', '.join(request.cooking_equipment or ['a pan'])}."
                ),
                timer_seconds=300,
            ),
            StepInput(
                step_number=2,
                instruction="Taste, adjust seasoning, and serve at the requested serving size.",
                timer_seconds=300,
            ),
        ]
        return AIKitchenRecipeResponse(
            title=f"{request.cuisine_preference} {request.dish_type} Bowl",
            description=f"Deterministic mock recipe for {request.dish_type.lower()}.",
            cuisine_type=request.cuisine_preference,
            category=request.dish_type,
            diet_type=request.diet_preference,
            prep_time_mins=10,
            cook_time_mins=min(request.cooking_time_mins, 30),
            servings=request.servings,
            difficulty_level="easy",
            equipment_required=request.cooking_equipment,
            ingredients=ingredients,
            steps=steps,
            nutrition=NutritionInfo(**nutrition),
            cooking_tips=["Mock provider output is for deterministic local testing."],
            is_ai_generated=True,
            ai_provider="EpiCho Mock Provider",
        )


class GeminiAIProvider(AIRecipeProvider):
    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise AIProviderError("Gemini AI provider is configured without an API key.")
        self.api_key = api_key

    async def generate(
        self, request: AIKitchenGenerateRequest
    ) -> AIKitchenRecipeResponse:
        prompt = (
            "You are EpiCho Master AI Chef. Return ONLY valid JSON matching the schema.\n"
            f"Ingredients: {', '.join(request.ingredients)}\n"
            f"Excluded ingredients: {', '.join(request.excluded_ingredients) or 'None'}\n"
            f"Dish type: {request.dish_type}\n"
            f"Cuisine: {request.cuisine_preference}\n"
            f"Taste: {request.taste_preference}\n"
            f"Diet: {request.diet_preference}\n"
            f"Servings: {request.servings}, Max Cook Time: {request.cooking_time_mins} mins\n"
            f"Equipment: {', '.join(request.cooking_equipment)}\n"
            f"STRICTLY EXCLUDE Allergens: {', '.join(request.allergies) or 'None'}\n"
            "JSON keys: title, description, cuisine_type, category, diet_type, prep_time_mins, "
            "cook_time_mins, servings, difficulty_level, equipment_required, ingredients "
            "(name, quantity, unit, notes, is_optional), steps "
            "(step_number, instruction, timer_seconds, tip, common_mistake), cooking_tips."
        )
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.5-flash:generateContent?key={self.api_key}"
        )
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                response = await client.post(
                    url,
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"response_mime_type": "application/json"},
                    },
                )
        except httpx.HTTPError as exc:
            raise AIProviderError("The configured Gemini provider could not be reached.") from exc
        if response.status_code != 200:
            raise AIProviderError(
                f"The configured Gemini provider returned HTTP {response.status_code}."
            )
        try:
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            ingredients = [IngredientInput(**item) for item in parsed.get("ingredients", [])]
            steps = [StepInput(**item) for item in parsed.get("steps", [])]
            nutrition_items = [
                {"name": item.name, "quantity": item.quantity, "unit": item.unit}
                for item in ingredients
            ]
            nutrition = calculate_recipe_nutrition(
                nutrition_items, servings=request.servings
            )
            parsed.update(
                {
                    "category": parsed.get("category", request.dish_type),
                    "servings": request.servings,
                    "ingredients": [item.model_dump() for item in ingredients],
                    "steps": [item.model_dump() for item in steps],
                    "nutrition": nutrition,
                    "equipment_required": parsed.get(
                        "equipment_required", request.cooking_equipment
                    ),
                    "cooking_tips": parsed.get("cooking_tips", []),
                    "is_ai_generated": True,
                    "ai_provider": "Google Gemini 2.5 Flash",
                }
            )
            return AIKitchenRecipeResponse.model_validate(parsed)
        except (KeyError, json.JSONDecodeError, TypeError, ValueError) as exc:
            raise AIProviderError(
                "The configured Gemini provider returned invalid structured output."
            ) from exc


def get_ai_provider(provider_name: Optional[str] = None) -> AIRecipeProvider:
    selected = (provider_name or settings.AI_PROVIDER).strip().lower()
    if selected == "gemini":
        if not settings.GEMINI_API_KEY:
            raise AIProviderError(
                "Gemini AI provider is selected, but GEMINI_API_KEY is not configured."
            )
        return GeminiAIProvider(settings.GEMINI_API_KEY)
    if selected == "mock":
        return MockAIProvider()
    raise AIProviderError(f"Unsupported AI provider: {selected}")
