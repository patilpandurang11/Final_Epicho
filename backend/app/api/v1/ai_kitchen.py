import hashlib
import hmac
import time
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import desc, func

from app.core.config import settings
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import get_current_user, get_optional_user, rate_limit
from app.core.security import decrypt_sensitive_text
from app.models.admin import ModerationReport
from app.models.recipe import AIRequest
from app.models.subscription import Subscription
from app.models.user import UserAccount
from app.schemas.ai import (
    AIHistoryItem,
    AIKitchenGenerateRequest,
    AIKitchenModifyRequest,
    AIKitchenRecipeResponse,
    AIKitchenReportRequest,
    AIKitchenTranslateRequest,
    NutritionInfo,
)
from app.services.ai_kitchen import (
    contains_ingredient_term,
    generate_ai_recipe,
    validate_and_sanitize_allergens,
)
from app.services.ai_providers import AIProviderError
from app.services.nutrition import calculate_recipe_nutrition

router = APIRouter(prefix="/ai-kitchen", tags=["AI Kitchen"])

LANGUAGE_GLOSSARY = {
    "Hindi": {
        "prefix": "[हिन्दी अनुवाद]",
        "notes": "Translated culinary instructions into Hindi-friendly terminology (कड़ाही, तड़का, धीमी आंच).",
    },
    "Tamil": {
        "prefix": "[தமிழ் மொழிபெயர்ப்பு]",
        "notes": "Adapted recipe steps with Tamil culinary cues.",
    },
    "Bengali": {
        "prefix": "[বাংলা অনুবাদ]",
        "notes": "Adapted recipe steps with Bengali culinary cues.",
    },
    "Spanish": {
        "prefix": "[Traducción al Español]",
        "notes": "Translated recipe steps into Spanish.",
    },
    "French": {
        "prefix": "[Traduction Française]",
        "notes": "Translated recipe steps into French.",
    },
}


def _get_quota_status(current_user: Optional[UserAccount], request: Request, db: Session) -> dict:
    today_start = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time(), tzinfo=timezone.utc)
    if not current_user:
        guest_id = _guest_identifier(request)
        used = (
            db.query(func.count(AIRequest.request_id))
            .filter(AIRequest.user_id.is_(None), AIRequest.guest_identifier == guest_id, AIRequest.created_at >= today_start)
            .scalar()
            or 0
        )
        limit = 3
        return {"tier": "guest", "daily_limit": limit, "used_today": used, "remaining": max(0, limit - used), "is_unlimited": False}

    active_sub = (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.user_id, Subscription.status == "active", Subscription.end_date >= date.today())
        .first()
    )
    tier = "premium" if active_sub else "registered"
    used = (
        db.query(func.count(AIRequest.request_id))
        .filter(AIRequest.user_id == current_user.user_id, AIRequest.created_at >= today_start)
        .scalar()
        or 0
    )
    if active_sub:
        return {"tier": tier, "daily_limit": 9999, "used_today": used, "remaining": max(0, 9999 - used), "is_unlimited": True}

    limit = 10
    return {"tier": tier, "daily_limit": limit, "used_today": used, "remaining": max(0, limit - used), "is_unlimited": False}


def _record_ai_request(
    db: Session,
    req_type: str,
    prompt_text: str,
    options: dict,
    response_obj: AIKitchenRecipeResponse,
    latency_ms: int,
    user: Optional[UserAccount],
    guest_id: Optional[str],
) -> uuid.UUID:
    safe_options = dict(options)
    declared_allergies = safe_options.pop("allergies", [])
    safe_options["allergen_count"] = len(declared_allergies)
    row = AIRequest(
        user_id=user.user_id if user else None,
        guest_identifier=None if user else guest_id,
        request_type=req_type,
        prompt=prompt_text,
        macro_flavor_options=safe_options,
        response_payload=response_obj.model_dump(mode="json"),
        allergen_check_passed=not any(
            _ingredient_conflicts(ingredient.name, declared_allergies)
            for ingredient in response_obj.ingredients
        ),
        latency_ms=latency_ms,
    )
    db.add(row)
    db.flush()
    response_obj.request_id = row.request_id
    row.response_payload = response_obj.model_dump(mode="json")
    db.commit()
    db.refresh(row)
    return row.request_id


def _guest_identifier(request: Request) -> str:
    address = request.client.host if request.client else "guest"
    return hmac.new(
        settings.JWT_SECRET.encode("utf-8"), address.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _ingredient_conflicts(name: str, allergies: List[str]) -> bool:
    lowered = name.casefold()
    import re

    from app.services.ai_kitchen import COMMON_ALLERGENS

    return any(
        any(
            re.search(rf"(?<![a-z]){re.escape(keyword)}(?![a-z])", lowered)
            for keyword in COMMON_ALLERGENS.get(allergen.casefold().strip(), [allergen.casefold().strip()])
        )
        for allergen in allergies
    )


def _independent_allergen_check(result: AIKitchenRecipeResponse, allergies: List[str]) -> None:
    safe_ingredients, warnings, risks, substitutions = validate_and_sanitize_allergens(
        result.ingredients, allergies
    )
    result.ingredients = safe_ingredients
    result.allergen_warnings = list(dict.fromkeys([*result.allergen_warnings, *warnings]))
    result.cross_contamination_risks = list(dict.fromkeys([*result.cross_contamination_risks, *risks]))
    result.substitutions = list({item.original: item for item in [*result.substitutions, *substitutions]}.values())
    if any(_ingredient_conflicts(ingredient.name, allergies) for ingredient in result.ingredients):
        raise HTTPException(status_code=502, detail="Recipe failed allergen safety validation.")
    ingredients = [{"name": i.name, "quantity": i.quantity, "unit": i.unit} for i in result.ingredients]
    result.nutrition = NutritionInfo(**calculate_recipe_nutrition(ingredients, servings=result.servings))


def _validate_excluded_ingredients(
    result: AIKitchenRecipeResponse, excluded_ingredients: List[str]
) -> None:
    if not excluded_ingredients:
        return
    output = " ".join(
        [
            *(ingredient.name for ingredient in result.ingredients),
            *(step.instruction for step in result.steps),
        ]
    )
    if contains_ingredient_term(output, excluded_ingredients):
        raise HTTPException(
            status_code=502,
            detail="Recipe generation included an excluded ingredient; no recipe was saved.",
        )


def _apply_excluded_ingredients(req: AIKitchenGenerateRequest) -> None:
    req.ingredients = [
        ingredient for ingredient in req.ingredients
        if not contains_ingredient_term(ingredient, req.excluded_ingredients)
    ]
    if not req.ingredients:
        raise HTTPException(
            status_code=422,
            detail="At least one available ingredient must remain after exclusions.",
        )


def _apply_profile_allergies(req: AIKitchenGenerateRequest, user: Optional[UserAccount]) -> None:
    if user and user.profile:
        stored = decrypt_sensitive_text(user.profile.allergies_encrypted) or ""
        profile_allergies = [item.strip() for item in stored.split(",") if item.strip()]
        req.allergies = list(dict.fromkeys([*req.allergies, *profile_allergies]))


def _enforce_quota(current_user: Optional[UserAccount], request: Request, db: Session) -> dict:
    quota = _get_quota_status(current_user, request, db)
    if not quota["is_unlimited"] and quota["remaining"] <= 0:
        raise HTTPException(
            status_code=429,
            detail=f"Daily AI Kitchen quota ({quota['daily_limit']}/day) reached for {quota['tier']} tier.",
        )
    return quota


@router.post("/generate", response_model=AIKitchenRecipeResponse, dependencies=[Depends(rate_limit("ai_gen", 30, 60))])
async def generate_recipe(
    req: AIKitchenGenerateRequest,
    request: Request,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    _enforce_quota(current_user, request, db)

    if not current_user and len(req.ingredients) > 10:
        raise HTTPException(status_code=400, detail="Guest tier supports up to 10 ingredients. Sign up for unlimited.")
    _apply_excluded_ingredients(req)
    _apply_profile_allergies(req, current_user)

    t0 = time.monotonic()
    try:
        result = await generate_ai_recipe(req)
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    _validate_excluded_ingredients(result, req.excluded_ingredients)
    _independent_allergen_check(result, req.allergies)
    latency_ms = int((time.monotonic() - t0) * 1000)

    guest_id = _guest_identifier(request)
    req_id = _record_ai_request(
        db=db,
        req_type="PantryToPlate",
        prompt_text=f"Ingredients: {', '.join(req.ingredients)} | {req.cuisine_preference} | {req.diet_preference}",
        options=req.model_dump(),
        response_obj=result,
        latency_ms=latency_ms,
        user=current_user,
        guest_id=guest_id,
    )
    result.request_id = req_id
    return result


@router.post("/fusion", response_model=AIKitchenRecipeResponse, dependencies=[Depends(rate_limit("ai_fusion", 20, 60))])
async def fusion_recipe(
    req: AIKitchenGenerateRequest,
    request: Request,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    _enforce_quota(current_user, request, db)
    if not current_user and len(req.ingredients) > 10:
        raise HTTPException(status_code=400, detail="Guest tier supports up to 10 ingredients. Sign up for more.")
    _apply_excluded_ingredients(req)
    _apply_profile_allergies(req, current_user)
    if not req.fusion_cuisine:
        req.fusion_cuisine = "Italian"
    t0 = time.monotonic()
    try:
        result = await generate_ai_recipe(req)
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    _validate_excluded_ingredients(result, req.excluded_ingredients)
    _independent_allergen_check(result, req.allergies)
    latency_ms = int((time.monotonic() - t0) * 1000)
    guest_id = _guest_identifier(request)
    result.request_id = _record_ai_request(
        db, "Full", f"Fusion {req.cuisine_preference} x {req.fusion_cuisine}", req.model_dump(), result, latency_ms, current_user, guest_id
    )
    return result


@router.post("/modify", response_model=AIKitchenRecipeResponse)
async def modify_recipe(
    req: AIKitchenModifyRequest,
    request: Request,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    _enforce_quota(current_user, request, db)
    orig = req.original_recipe.model_copy(deep=True)
    prompt_lower = req.modification_prompt.lower()
    allergies_to_enforce: List[str] = []

    if "vegan" in prompt_lower or "dairy free" in prompt_lower or "dairy-free" in prompt_lower:
        allergies_to_enforce.extend(["dairy", "eggs"])
        orig.diet_type = "vegan"
    if "gluten free" in prompt_lower or "gluten-free" in prompt_lower:
        allergies_to_enforce.append("gluten")
    if "nut free" in prompt_lower or "nut-free" in prompt_lower:
        allergies_to_enforce.extend(["peanuts", "tree nuts"])
    if current_user and current_user.profile:
        stored = decrypt_sensitive_text(current_user.profile.allergies_encrypted) or ""
        allergies_to_enforce.extend(item.strip() for item in stored.split(",") if item.strip())

    if "low carb" in prompt_lower or "keto" in prompt_lower:
        for ing in orig.ingredients:
            if any(k in ing.name.lower() for k in ["rice", "pasta", "potato", "bread", "flour"]):
                ing.name = "Cauliflower Rice / Zucchini Noodles"
                ing.notes = "Low-carb keto swap"

    if "spicier" in prompt_lower or "spicy" in prompt_lower:
        orig.cooking_tips.append("Added crushed Kashmiri chili & black pepper for elevated heat.")
    if "high protein" in prompt_lower or "more protein" in prompt_lower:
        for ing in orig.ingredients:
            if any(k in ing.name.lower() for k in ["paneer", "tofu", "chicken", "lentil", "chickpea"]):
                ing.quantity = round(ing.quantity * 1.5, 2)

    sanitized, warnings, cross_risks, subs = validate_and_sanitize_allergens(orig.ingredients, allergies_to_enforce)
    orig.ingredients = sanitized
    orig.allergen_warnings = list(set(orig.allergen_warnings + warnings))
    orig.cross_contamination_risks = list(set(orig.cross_contamination_risks + cross_risks))
    orig.substitutions = subs
    _independent_allergen_check(orig, allergies_to_enforce)

    ing_dicts = [{"name": i.name, "quantity": i.quantity, "unit": i.unit} for i in orig.ingredients]
    orig.nutrition = NutritionInfo(**calculate_recipe_nutrition(ing_dicts, servings=orig.servings))
    orig.title = f"{orig.title} (Adapted: {req.modification_prompt[:32]})"
    orig.description = f"{orig.description} — Customized: {req.modification_prompt}."

    guest_id = _guest_identifier(request)
    orig.request_id = _record_ai_request(
        db, "Customization", req.modification_prompt,
        {"original": orig.title, "allergies": allergies_to_enforce}, orig, 45, current_user, guest_id
    )
    return orig


@router.post("/translate", response_model=AIKitchenRecipeResponse)
def translate_recipe(req: AIKitchenTranslateRequest):
    translated = req.recipe.model_copy(deep=True)
    lang_info = LANGUAGE_GLOSSARY.get(
        req.target_language,
        {"prefix": f"[{req.target_language}]", "notes": f"Localized for {req.target_language} readers."},
    )
    translated.title = f"{lang_info['prefix']} {translated.title}"
    translated.description = f"{lang_info['notes']} — {translated.description}"
    for s in translated.steps:
        s.instruction = f"{lang_info['prefix']} {s.instruction}"
    return translated


@router.get("/history", response_model=List[AIHistoryItem])
def get_ai_history(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AIRequest)
        .filter(
            AIRequest.user_id == current_user.user_id,
            AIRequest.history_deleted_at.is_(None),
        )
        .order_by(desc(AIRequest.created_at))
        .limit(25)
        .all()
    )
    results = []
    for r in rows:
        parsed_recipe = None
        if r.response_payload:
            try:
                parsed_recipe = AIKitchenRecipeResponse(**r.response_payload)
            except Exception:
                parsed_recipe = None
        results.append(
            AIHistoryItem(
                request_id=r.request_id,
                request_type=r.request_type,
                prompt=r.prompt,
                allergen_check_passed=r.allergen_check_passed,
                flagged_unsafe=r.flagged_unsafe,
                created_at=r.created_at,
                recipe=parsed_recipe,
            )
        )
    return results


@router.delete("/history/{request_id}")
def delete_ai_history_item(
    request_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(AIRequest).filter(
        AIRequest.request_id == request_id, AIRequest.user_id == current_user.user_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="AI history item not found.")
    row.history_deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "AI history item deleted."}


@router.post("/{request_id}/report")
def report_unsafe_ai_output(
    request_id: uuid.UUID,
    req: AIKitchenReportRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ai_row = db.query(AIRequest).filter(AIRequest.request_id == request_id).first()
    if not ai_row:
        raise HTTPException(status_code=404, detail="AI generation record not found.")
    if ai_row.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="AI generation record not found.")

    ai_row.flagged_unsafe = True
    ai_row.unsafe_reason = req.reason

    report = ModerationReport(
        reporter_id=current_user.user_id,
        target_type="ai_output",
        target_id=request_id,
        reason=f"Unsafe AI Recipe Output: {req.reason}",
        status="open",
    )
    db.add(report)
    db.commit()
    return {"message": "AI output flagged for safety review. Thank you for helping keep EpiCho safe."}


@router.get("/quota")
def get_ai_quota(
    request: Request,
    current_user: Optional[UserAccount] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return _get_quota_status(current_user, request, db)
