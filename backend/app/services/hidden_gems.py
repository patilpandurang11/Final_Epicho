import math
from datetime import datetime, timedelta, timezone
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.admin import Notification, SystemConfig
from app.models.business import BusinessProfile
from app.models.discovery import HiddenGem
from app.models.recipe import Recipe


def _get_cycle_days(db: Session) -> int:
    cfg = db.query(SystemConfig).filter(SystemConfig.config_key == "hidden_gems_cycle_days").first()
    if cfg and cfg.config_value and cfg.config_value.isdigit():
        return max(1, int(cfg.config_value))
    return 2


def compute_recipe_gem_score(recipe: Recipe) -> float:
    views = max(recipe.view_count or 1, 1)
    reviews_count = len(recipe.reviews) if recipe.reviews else 0
    avg_rating = (
        sum(r.rating for r in recipe.reviews) / reviews_count if reviews_count > 0 else 4.5
    )
    quality_signal = (avg_rating * 12.0) + (reviews_count * 4.0) + 10.0
    exposure_penalty = math.log10(views + 15)
    return round(quality_signal / exposure_penalty, 4)


def compute_business_gem_score(biz: BusinessProfile) -> float:
    menu_bonus = min(len(biz.menu_items) * 2.5, 20.0) if biz.menu_items else 5.0
    verified_bonus = 15.0 if biz.verification_status == "verified" else 5.0
    return round(55.0 + menu_bonus + verified_bonus, 4)


def update_or_cycle_hidden_gems(db: Session, force_cycle: bool = False):
    now = datetime.now(timezone.utc)
    active_gems = (
        db.query(HiddenGem)
        .filter(HiddenGem.featured_from <= now, HiddenGem.featured_until >= now)
        .order_by(desc(HiddenGem.created_at))
        .all()
    )

    if not force_cycle and len(active_gems) >= 2:
        return active_gems

    cycle_days = _get_cycle_days(db)
    cooldown_cutoff = now - timedelta(days=30)
    recent_ids = {
        g.entity_id
        for g in db.query(HiddenGem).filter(HiddenGem.featured_from >= cooldown_cutoff).all()
    }

    chosen_gems = list(active_gems) if not force_cycle else []
    has_recipe = any(g.entity_type == "recipe" for g in chosen_gems)
    has_restaurant = any(g.entity_type == "restaurant" for g in chosen_gems)

    if not has_recipe:
        candidates = db.query(Recipe).filter(Recipe.moderation_status == "approved").all()
        eligible = [r for r in candidates if r.recipe_id not in recent_ids] or candidates
        if eligible:
            chosen_recipe = max(eligible, key=compute_recipe_gem_score)
            gem_r = HiddenGem(
                entity_type="recipe",
                entity_id=chosen_recipe.recipe_id,
                gem_score=compute_recipe_gem_score(chosen_recipe),
                featured_from=now,
                featured_until=now + timedelta(days=cycle_days),
                is_manual_override=False,
            )
            db.add(gem_r)
            db.add(
                Notification(
                    user_id=chosen_recipe.author_id,
                    type="hidden_gem",
                    title="Your recipe is an EpiCho Hidden Gem!",
                    body=f"'{chosen_recipe.title}' was selected for the {cycle_days}-day Hidden Gems showcase.",
                    action_url="/hidden-gems",
                )
            )
            chosen_gems.append(gem_r)

    if not has_restaurant:
        biz_candidates = db.query(BusinessProfile).all()
        eligible_biz = [b for b in biz_candidates if b.business_id not in recent_ids] or biz_candidates
        if eligible_biz:
            chosen_biz = max(eligible_biz, key=compute_business_gem_score)
            gem_b = HiddenGem(
                entity_type="restaurant",
                entity_id=chosen_biz.business_id,
                gem_score=compute_business_gem_score(chosen_biz),
                featured_from=now,
                featured_until=now + timedelta(days=cycle_days),
                is_manual_override=False,
            )
            db.add(gem_b)
            db.add(
                Notification(
                    user_id=chosen_biz.owner_user_id,
                    type="hidden_gem",
                    title="Your restaurant is an EpiCho Hidden Gem!",
                    body=f"'{chosen_biz.business_name}' was selected for the Hidden Gems spotlight.",
                    action_url="/hidden-gems",
                )
            )
            chosen_gems.append(gem_b)

    db.commit()
    for g in chosen_gems:
        db.refresh(g)
    return chosen_gems
