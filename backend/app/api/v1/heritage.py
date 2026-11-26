import uuid
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import get_current_user
from app.models.recipe import HeritageRecipe, Recipe
from app.models.user import UserAccount

router = APIRouter(prefix="/heritage", tags=["Grandmother's Recipes"])


class HeritageRecipeCreate(BaseModel):
    recipe_id: uuid.UUID
    family_name: str
    region: str
    original_language: str = "Hindi"
    story_original: str
    translations: Dict[str, str] = {}
    colloquial_measurements: List[Dict[str, str]] = [
        {"original": "1 chutki", "standardized": "1/8 tsp (Estimated)"},
        {"original": "1 katori", "standardized": "150 ml / ~2/3 cup (Estimated)"},
    ]
    story_media_url: Optional[str] = None
    festival_collection: Optional[str] = None


@router.get("")
def get_heritage_recipes(
    region: Optional[str] = None,
    festival: Optional[str] = None,
    language: Optional[str] = None,
    limit: int = Query(20, le=50),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(HeritageRecipe)
    if region:
        query = query.filter(HeritageRecipe.region.ilike(f"%{region}%"))
    if festival:
        query = query.filter(HeritageRecipe.festival_collection.ilike(f"%{festival}%"))
    if language:
        query = query.filter(HeritageRecipe.original_language.ilike(f"%{language}%"))

    heritage_list = query.order_by(desc(HeritageRecipe.created_at)).offset(offset).limit(limit).all()
    results = []
    for h in heritage_list:
        rec = h.recipe
        results.append(
            {
                "heritage_id": str(h.heritage_id),
                "recipe_id": str(h.recipe_id),
                "title": rec.title if rec else "Traditional Heirloom Recipe",
                "slug": rec.slug if rec else None,
                "family_origin": f"{h.family_name} • {h.region}",
                "family_name": h.family_name,
                "region": h.region,
                "original_language": h.original_language,
                "historical_story": h.story_original,
                "translations": h.translations or {},
                "original_measurements": h.colloquial_measurements or [],
                "verified_by_family": h.is_family_verified,
                "story_media_url": h.story_media_url,
                "festival_collection": h.festival_collection or "Family Heirloom",
                "old_photo_url": rec.image_url if rec else None,
                "created_at": h.created_at,
            }
        )
    return results


@router.post("")
def submit_heritage_recipe(
    req: HeritageRecipeCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.recipe_id == req.recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Underlying recipe not found.")

    translations = dict(req.translations or {})
    if "en" not in translations:
        translations["en"] = req.story_original

    new_heritage = HeritageRecipe(
        recipe_id=req.recipe_id,
        family_name=req.family_name,
        region=req.region,
        original_language=req.original_language,
        story_original=req.story_original,
        translations=translations,
        colloquial_measurements=req.colloquial_measurements,
        story_media_url=req.story_media_url,
        is_family_verified=True,
        festival_collection=req.festival_collection,
    )
    db.add(new_heritage)
    db.commit()
    db.refresh(new_heritage)
    return {
        "message": "Heritage recipe preserved with Verified by Family badge.",
        "heritage_id": str(new_heritage.heritage_id),
    }
