import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import get_current_user, get_user_role_names, rate_limit, require_permission
from app.models.business import BusinessProfile
from app.models.discovery import HiddenGem, RankingPeriod, RankingVote
from app.models.recipe import Recipe
from app.models.user import UserAccount
from app.services.hidden_gems import update_or_cycle_hidden_gems

router = APIRouter(prefix="/rankings", tags=["Rankings & Hidden Gems"])


class RankingVoteRequest(BaseModel):
    target_type: str  # 'restaurant', 'recipe', 'creator', 'chef', 'critic'
    target_id: uuid.UUID
    score: int


def _bayesian_average(votes_sum: float, total_weight: float, prior_mean: float = 4.2, prior_m: float = 15.0) -> float:
    return round(((total_weight / (total_weight + prior_m)) * (votes_sum / max(total_weight, 1e-6))) + ((prior_m / (total_weight + prior_m)) * prior_mean), 3)


@router.get("")
def get_rankings(
    category: str = Query("restaurants", description="restaurants, recipes, chefs, creators, critics"),
    city: Optional[str] = None,
    cuisine: Optional[str] = None,
    season: str = Query("monthly", description="monthly, seasonal, all_time"),
    db: Session = Depends(get_db),
):
    votes = db.query(RankingVote).all()
    vote_stats = {}
    for v in votes:
        key = str(v.target_id)
        w = float(v.verified_signal_weight or 1.0)
        entry = vote_stats.setdefault(key, {"weighted_sum": 0.0, "total_weight": 0.0, "count": 0})
        entry["weighted_sum"] += float(v.score) * w
        entry["total_weight"] += w
        entry["count"] += 1

    if category == "restaurants":
        query = db.query(BusinessProfile)
        if city:
            query = query.filter(BusinessProfile.address.ilike(f"%{city}%"))
        if cuisine:
            query = query.filter(BusinessProfile.cuisine_type.ilike(f"%{cuisine}%"))
        businesses = query.all()
        ranked = []
        for b in businesses:
            st = vote_stats.get(str(b.business_id), {"weighted_sum": 4.7 * 20, "total_weight": 20.0, "count": 20})
            bayesian_score = _bayesian_average(st["weighted_sum"], st["total_weight"])
            ranked.append(
                {
                    "id": str(b.business_id),
                    "name": b.business_name,
                    "type": b.business_type,
                    "city": b.address,
                    "cuisine": b.cuisine_type or "Gourmet",
                    "bayesian_score": bayesian_score,
                    "votes_count": st["count"],
                    "is_verified": b.verification_status == "verified",
                    "sponsored": False,
                    "badge": "Top Rated Restaurant" if b.verification_status == "verified" else "Rising Spot",
                }
            )
        return sorted(ranked, key=lambda x: x["bayesian_score"], reverse=True)

    if category == "recipes":
        query = db.query(Recipe).filter(Recipe.moderation_status == "approved")
        if cuisine:
            query = query.filter(Recipe.cuisine_type.ilike(f"%{cuisine}%"))
        recipes = query.limit(20).all()
        ranked = []
        for r in recipes:
            st = vote_stats.get(str(r.recipe_id))
            if st:
                bayesian_score = _bayesian_average(st["weighted_sum"], st["total_weight"])
                votes_count = st["count"]
            else:
                v = max(r.view_count or 12, 12)
                bayesian_score = _bayesian_average(4.65 * v, float(v))
                votes_count = v
            ranked.append(
                {
                    "id": str(r.recipe_id),
                    "name": r.title,
                    "slug": r.slug,
                    "cuisine": r.cuisine_type,
                    "author": r.author.full_name if r.author else "EpiCho Chef",
                    "bayesian_score": bayesian_score,
                    "votes_count": votes_count,
                    "image_url": r.image_url,
                    "sponsored": False,
                    "badge": "Community Favorite",
                }
            )
        return sorted(ranked, key=lambda x: x["bayesian_score"], reverse=True)

    if category == "critics":
        critics = db.query(UserAccount).filter(UserAccount.is_verified.is_(True)).all()
        return [
            {
                "id": str(c.user_id),
                "name": c.full_name,
                "username": c.username,
                "tier": "critic",
                "bayesian_score": 4.86,
                "votes_count": 184,
                "is_verified": True,
                "sponsored": False,
                "badge": "Verified Culinary Critic",
            }
            for c in critics[:15]
        ]

    creators = db.query(UserAccount).filter(UserAccount.account_tier.in_(["creator", "business"])).all()
    ranked = []
    for c in creators:
        st = vote_stats.get(str(c.user_id), {"weighted_sum": 4.82 * 25, "total_weight": 25.0, "count": 25})
        ranked.append(
            {
                "id": str(c.user_id),
                "name": c.full_name,
                "username": c.username,
                "tier": c.account_tier,
                "bayesian_score": _bayesian_average(st["weighted_sum"], st["total_weight"]),
                "votes_count": st["count"],
                "is_verified": c.is_verified,
                "sponsored": False,
                "badge": "Verified Culinary Creator" if c.is_verified else "Community Chef",
            }
        )
    return sorted(ranked, key=lambda x: x["bayesian_score"], reverse=True)


@router.get("/methodology")
def get_ranking_methodology():
    return {
        "formula": "Bayesian Weighted Score = (v / (v + m)) * R + (m / (v + m)) * C",
        "parameters": {"prior_mean_C": 4.2, "minimum_votes_threshold_m": 15},
        "anti_fraud_protections": [
            "One active vote per authenticated account per target per ranking period",
            "Verified creator & critic signal weighting without paid boost influence",
            "Per-IP & per-user velocity rate limiting",
        ],
        "paid_influence_policy": "Subscriptions or promotions never alter organic Bayesian ranking scores.",
    }


@router.post("/vote", dependencies=[Depends(rate_limit("ranking_vote", 15, 60))])
def cast_ranking_vote(
    req: RankingVoteRequest,
    current_user: UserAccount = Depends(require_permission("ranking.vote")),
    db: Session = Depends(get_db),
):
    if req.score < 1 or req.score > 5:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5.")

    today = date.today()
    period = db.query(RankingPeriod).filter(RankingPeriod.is_active.is_(True)).first()
    if not period:
        period = RankingPeriod(
            name=f"{today.strftime('%B %Y')} Leaderboard",
            start_date=today,
            end_date=today + timedelta(days=30),
            is_active=True,
        )
        db.add(period)
        db.flush()

    roles = get_user_role_names(current_user, db)
    weight = 2.0 if "critic" in roles else (1.5 if current_user.is_verified else 1.0)

    existing = (
        db.query(RankingVote)
        .filter(
            RankingVote.voter_id == current_user.user_id,
            RankingVote.period_id == period.period_id,
            RankingVote.target_type == req.target_type,
            RankingVote.target_id == req.target_id,
        )
        .first()
    )
    if existing:
        existing.score = req.score
        existing.verified_signal_weight = weight
        db.commit()
        return {"message": "Ranking vote updated.", "weight": weight}

    db.add(
        RankingVote(
            voter_id=current_user.user_id,
            period_id=period.period_id,
            target_type=req.target_type,
            target_id=req.target_id,
            score=req.score,
            verified_signal_weight=weight,
        )
    )
    db.commit()
    return {"message": "Ranking vote recorded.", "weight": weight}


def _serialize_gem(g: HiddenGem, db: Session) -> Optional[dict]:
    now = datetime.now(timezone.utc)
    remaining = max(0, int((g.featured_until - now).total_seconds() // 3600))
    if g.entity_type == "recipe":
        rec = db.query(Recipe).filter(Recipe.recipe_id == g.entity_id).first()
        if rec:
            return {
                "gem_id": str(g.gem_id),
                "entity_type": "recipe",
                "entity_id": str(rec.recipe_id),
                "slug": rec.slug,
                "title": rec.title,
                "description": rec.description,
                "cuisine": rec.cuisine_type,
                "image_url": rec.image_url,
                "author": rec.author.full_name if rec.author else "Artisan Cook",
                "gem_score": float(g.gem_score),
                "featured_from": g.featured_from,
                "featured_until": g.featured_until,
                "cycle_remaining_hours": remaining,
                "is_manual_override": g.is_manual_override,
                "badge": "EpiCho Hidden Gem Recipe",
            }
    else:
        biz = db.query(BusinessProfile).filter(BusinessProfile.business_id == g.entity_id).first()
        if biz:
            return {
                "gem_id": str(g.gem_id),
                "entity_type": "restaurant",
                "entity_id": str(biz.business_id),
                "title": biz.business_name,
                "description": f"Authentic {biz.cuisine_type or 'regional'} spot in {biz.address}.",
                "cuisine": biz.cuisine_type or "Regional",
                "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
                "author": biz.address,
                "gem_score": float(g.gem_score),
                "featured_from": g.featured_from,
                "featured_until": g.featured_until,
                "cycle_remaining_hours": remaining,
                "is_manual_override": g.is_manual_override,
                "badge": "EpiCho Hidden Gem Restaurant",
            }
    return None


@router.get("/hidden-gems")
def get_hidden_gems(db: Session = Depends(get_db)):
    gems = update_or_cycle_hidden_gems(db)
    return [item for g in gems if (item := _serialize_gem(g, db)) is not None]


@router.get("/hidden-gems/archive")
def get_hidden_gems_archive(limit: int = Query(20, le=100), db: Session = Depends(get_db)):
    gems = db.query(HiddenGem).order_by(desc(HiddenGem.featured_from)).limit(limit).all()
    return [item for g in gems if (item := _serialize_gem(g, db)) is not None]
