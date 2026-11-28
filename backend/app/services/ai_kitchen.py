import re
from typing import List, Tuple
from app.schemas.ai import (
    AIKitchenGenerateRequest,
    AIKitchenRecipeResponse,
    IngredientInput,
    StepInput,
    SubstitutionItem,
)

from app.services.ai_providers import AIProviderError, get_ai_provider


def contains_ingredient_term(text: str, terms: List[str]) -> bool:
    return any(
        re.search(rf"(?<![a-z0-9]){re.escape(term.casefold())}(?![a-z0-9])", text.casefold())
        for term in terms
    )


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
            if any(
                re.search(rf"(?<![a-z]){re.escape(keyword)}(?![a-z])", ing_lower)
                for keyword in keywords
            ):
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


async def generate_ai_recipe(request: AIKitchenGenerateRequest) -> AIKitchenRecipeResponse:
    provider = get_ai_provider()
    return await provider.generate(request)
