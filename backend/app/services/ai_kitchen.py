import json
import logging
from typing import List, Tuple
import httpx

from app.core.config import settings
from app.schemas.ai import (
    AIKitchenGenerateRequest,
    AIKitchenRecipeResponse,
    IngredientInput,
    NutritionInfo,
    StepInput,
    SubstitutionItem,
)
from app.services.nutrition import calculate_recipe_nutrition

logger = logging.getLogger(__name__)

COMMON_ALLERGENS = {
    "peanuts": ["peanut", "groundnut", "peanut butter", "arachis"],
    "dairy": ["milk", "butter", "cheese", "paneer", "cream", "yogurt", "curd", "ghee", "whey"],
    "gluten": ["wheat", "atta", "maida", "flour", "bread", "pasta", "semolina", "sooji", "barley", "rye"],
    "eggs": ["egg", "eggs", "albumin", "egg yolk", "egg white"],
    "soy": ["soy", "soya", "tofu", "soy sauce", "edamame"],
    "tree nuts": ["almond", "cashew", "walnut", "pistachio", "pecan", "hazelnut"],
    "shellfish": ["prawn", "prawns", "shrimp", "crab", "lobster"],
    "fish": ["fish", "salmon", "tuna", "cod", "anchovy"],
    "sesame": ["sesame", "til", "tahini"],
    "mustard": ["mustard", "sarson", "rai"],
}

SAFE_SUBSTITUTIONS = {
    "milk": {"substitute": "oat milk or coconut milk", "notes": "Dairy-free plant alternative"},
    "butter": {"substitute": "cold-pressed olive oil or coconut oil", "notes": "Lactose-free cooking fat"},
    "ghee": {"substitute": "cold-pressed sesame or olive oil", "notes": "Dairy-free aromatic fat"},
    "paneer": {"substitute": "firm tofu (or chickpea tofu if soy-free)", "notes": "Plant protein alternative"},
    "wheat flour": {"substitute": "rice flour or besan (chickpea flour)", "notes": "Gluten-free binder"},
    "pasta": {"substitute": "brown rice pasta or zucchini ribbons", "notes": "Gluten-free swap"},
    "peanut": {"substitute": "roasted pumpkin seeds or sunflower seeds", "notes": "Nut-allergy safe crunch"},
    "soy sauce": {"substitute": "coconut aminos", "notes": "Soy-free umami seasoning"},
    "egg": {"substitute": "flaxseed meal + warm water (1:3)", "notes": "Eggless binder"},
    "cashew": {"substitute": "sunflower seed cream or melon seeds (magaj)", "notes": "Tree-nut free creamy base"},
}


def validate_and_sanitize_allergens(
    ingredients: List[IngredientInput], declared_allergies: List[str]
) -> Tuple[List[IngredientInput], List[str], List[str], List[SubstitutionItem]]:
    """Strips or substitutes any declared allergen so unsafe ingredients are never silently served."""
    warnings: List[str] = []
    cross_contamination: List[str] = []
    auto_subs: List[SubstitutionItem] = []
    normalized_allergies = [a.lower().strip() for a in declared_allergies if a.strip()]

    sanitized: List[IngredientInput] = []
    for ing in ingredients:
        ing_lower = ing.name.lower()
        conflicted_allergen = None
        for allergen in normalized_allergies:
            keywords = COMMON_ALLERGENS.get(allergen, [allergen])
            if any(k in ing_lower for k in keywords):
                conflicted_allergen = allergen
                break

        if conflicted_allergen:
            # Find safe swap
            replacement = "Allergen-Safe Culinary Substitute"
            swap_notes = f"Auto-replaced '{ing.name}' due to declared '{conflicted_allergen}' allergy."
            for key, sub in SAFE_SUBSTITUTIONS.items():
                if key in ing_lower:
                    replacement = sub["substitute"]
                    swap_notes = sub["notes"]
                    break
            warnings.append(
                f"Removed '{ing.name}' (conflicts with declared allergen '{conflicted_allergen}') and substituted '{replacement}'."
            )
            cross_contamination.append(
                f"Verify kitchenware, spice blends, and factory labels are free of '{conflicted_allergen}' cross-contact."
            )
            auto_subs.append(SubstitutionItem(original=ing.name, substitute=replacement, notes=swap_notes))
            sanitized.append(
                IngredientInput(
                    name=replacement,
                    quantity=ing.quantity,
                    unit=ing.unit,
                    notes=swap_notes,
                    is_optional=ing.is_optional,
                )
            )
        else:
            sanitized.append(ing)
            for key, sub in SAFE_SUBSTITUTIONS.items():
                if key in ing_lower:
                    auto_subs.append(SubstitutionItem(original=ing.name, substitute=sub["substitute"], notes=sub["notes"]))

    if not cross_contamination and normalized_allergies:
        cross_contamination.append(
            f"Clean prep boards and utensils thoroughly to avoid trace exposure to: {', '.join(normalized_allergies)}."
        )

    return sanitized, warnings, cross_contamination, auto_subs


def culinary_fallback_generator(request: AIKitchenGenerateRequest) -> AIKitchenRecipeResponse:
    main_ings = request.ingredients if request.ingredients else ["Vegetables", "Spices", "Rice"]
    primary_ing = main_ings[0].title()
    cuisine = request.cuisine_preference or "Indian"
    taste = request.taste_preference or "balanced savory"
    is_veg = request.diet_preference in ["veg", "vegan", "jain"]

    if request.fusion_cuisine and request.fusion_cuisine.lower() != cuisine.lower():
        title = f"{cuisine}-{request.fusion_cuisine} Fusion {primary_ing} Skillet"
        description = (
            f"An artisanal {taste} fusion combining {cuisine} whole-spice tempering "
            f"with {request.fusion_cuisine} technique at fusion intensity {request.fusion_intensity}/10."
        )
    else:
        title = f"Chef-Crafted {cuisine} {primary_ing} with {taste.title()} Glaze"
        description = (
            f"A balanced {cuisine} recipe featuring {', '.join(main_ings[:4])}, tailored for "
            f"{request.servings} servings in {request.cooking_time_mins} mins ({request.diet_preference})."
        )

    parsed_ingredients: List[IngredientInput] = []
    for idx, item in enumerate(main_ings):
        parsed_ingredients.append(
            IngredientInput(
                name=item.title(),
                quantity=1.0 if idx < 2 else 0.5,
                unit="cup" if idx < 2 else "tbsp",
                notes="Freshly prepped",
                is_optional=idx > 4,
            )
        )

    if is_veg:
        parsed_ingredients.append(IngredientInput(name="Cold-Pressed Olive Oil", quantity=1.5, unit="tbsp"))
        parsed_ingredients.append(IngredientInput(name="Cumin & Fresh Herbs", quantity=1.0, unit="tsp"))
    else:
        parsed_ingredients.append(IngredientInput(name="Olive Oil", quantity=1.5, unit="tbsp"))
        parsed_ingredients.append(IngredientInput(name="Cracked Pepper & Herbs", quantity=1.0, unit="tsp"))

    sanitized_ings, warnings, cross_risks, subs = validate_and_sanitize_allergens(
        parsed_ingredients, request.allergies
    )

    equip_str = ", ".join(request.cooking_equipment or ["Pan / Skillet"])
    steps = [
        StepInput(
            step_number=1,
            instruction=f"Prep and uniformly cut {', '.join(i.name for i in sanitized_ings[:2])} so every piece cooks evenly using {equip_str}.",
            timer_seconds=180,
            tip="Uniform sizing ensures consistent caramelization without overcooking.",
            common_mistake="Crowding the pan before it reaches medium heat.",
        ),
        StepInput(
            step_number=2,
            instruction="Warm oil over medium heat and bloom aromatics for 90 seconds until fragrant.",
            timer_seconds=90,
            tip="Keep heat at medium so garlic and spices release essential oils without scorching.",
            common_mistake="Using high flame on dry ground spices.",
        ),
        StepInput(
            step_number=3,
            instruction=f"Add {sanitized_ings[0].name} and sear 4-5 minutes until golden edges develop.",
            timer_seconds=240,
            tip="Let ingredients sit undisturbed for 60 seconds first to build flavor.",
        ),
        StepInput(
            step_number=4,
            instruction=f"Fold in remaining ingredients, season to achieve a {taste} finish, and simmer covered for 5 minutes.",
            timer_seconds=300,
            tip="Finish with fresh citrus or herbs off the flame to brighten the dish.",
            common_mistake="Over-salting early before sauce reduction concentrates flavors.",
        ),
    ]

    ing_dicts = [{"name": ing.name, "quantity": ing.quantity, "unit": ing.unit} for ing in sanitized_ings]
    nutri = calculate_recipe_nutrition(ing_dicts, servings=request.servings)

    return AIKitchenRecipeResponse(
        title=title,
        description=description,
        cuisine_type=cuisine,
        diet_type=request.diet_preference or "veg",
        prep_time_mins=10,
        cook_time_mins=max(10, request.cooking_time_mins - 10),
        servings=request.servings,
        difficulty_level="medium",
        equipment_required=request.cooking_equipment or ["Pan / Skillet", "Knife"],
        ingredients=sanitized_ings,
        steps=steps,
        nutrition=NutritionInfo(**nutri),
        allergen_warnings=warnings,
        cross_contamination_risks=cross_risks,
        substitutions=subs,
        cooking_tips=[
            "Toast whole spices gently before liquids for deeper aroma.",
            "Balance rich dishes with lemon juice or vinegar right before plating.",
        ],
        is_ai_generated=True,
        ai_provider="EpiCho Culinary Intelligence (Deterministic Fallback)",
    )


async def generate_ai_recipe(request: AIKitchenGenerateRequest) -> AIKitchenRecipeResponse:
    if settings.GEMINI_API_KEY:
        try:
            prompt = (
                "You are EpiCho Master AI Chef. Return ONLY valid JSON matching the schema.\n"
                f"Ingredients: {', '.join(request.ingredients)}\n"
                f"Cuisine: {request.cuisine_preference}\n"
                f"Taste: {request.taste_preference}\n"
                f"Diet: {request.diet_preference}\n"
                f"Servings: {request.servings}, Max Cook Time: {request.cooking_time_mins} mins\n"
                f"Equipment: {', '.join(request.cooking_equipment)}\n"
                f"STRICTLY EXCLUDE Allergens: {', '.join(request.allergies) or 'None'}\n"
                f"Dietary Restrictions: {', '.join(request.dietary_restrictions) or 'None'}\n"
                f"Fusion Cuisine: {request.fusion_cuisine or 'None'} (Intensity {request.fusion_intensity}/10)\n"
                "JSON keys: title, description, cuisine_type, diet_type, prep_time_mins, cook_time_mins, servings, "
                "difficulty_level, equipment_required (list[str]), ingredients (list[{name, quantity, unit, notes, is_optional}]), "
                "steps (list[{step_number, instruction, timer_seconds, tip, common_mistake}]), cooking_tips (list[str])."
            )
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"response_mime_type": "application/json"},
            }
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    text_content = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(text_content)

                    raw_ings = [IngredientInput(**i) for i in parsed.get("ingredients", [])]
                    sanitized_ings, warnings, cross_risks, subs = validate_and_sanitize_allergens(
                        raw_ings, request.allergies
                    )
                    ing_dicts = [{"name": i.name, "quantity": i.quantity, "unit": i.unit} for i in sanitized_ings]
                    nutri = calculate_recipe_nutrition(ing_dicts, servings=request.servings)
                    step_objs = [StepInput(**s) for s in parsed.get("steps", [])]

                    return AIKitchenRecipeResponse(
                        title=parsed.get("title", "EpiCho AI Creation"),
                        description=parsed.get("description", ""),
                        cuisine_type=parsed.get("cuisine_type", request.cuisine_preference),
                        diet_type=parsed.get("diet_type", request.diet_preference),
                        prep_time_mins=int(parsed.get("prep_time_mins", 12)),
                        cook_time_mins=int(parsed.get("cook_time_mins", request.cooking_time_mins)),
                        servings=request.servings,
                        difficulty_level=parsed.get("difficulty_level", "medium"),
                        equipment_required=parsed.get("equipment_required", request.cooking_equipment),
                        ingredients=sanitized_ings,
                        steps=step_objs,
                        nutrition=NutritionInfo(**nutri),
                        allergen_warnings=warnings,
                        cross_contamination_risks=cross_risks,
                        substitutions=subs,
                        cooking_tips=parsed.get("cooking_tips", []),
                        is_ai_generated=True,
                        ai_provider="Google Gemini 2.5 Flash + EpiCho Nutrition Lab",
                    )
        except Exception as exc:
            logger.warning("Gemini API call failed, using deterministic culinary engine: %s", exc)

    return culinary_fallback_generator(request)
