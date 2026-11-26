import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import (
    ROLE_PERMISSION_MAP,
    get_current_user,
    require_admin,
    require_permission,
)
from app.models.admin import AuditLog, ModerationReport, Notification, SupportTicket, SystemConfig
from app.models.business import BusinessProfile, NutritionistProfile, VerificationRequest
from app.models.discovery import HiddenGem
from app.models.recipe import AIRequest, Recipe
from app.models.reels import Reel
from app.models.social import Post
from app.models.subscription import Payment, Subscription, SubscriptionPlan
from app.models.user import Role, UserAccount, UserRole
from app.schemas.business import VerificationSubmitRequest
from app.schemas.subscription import PlanPriceUpdateRequest
from app.services.hidden_gems import update_or_cycle_hidden_gems

router = APIRouter(prefix="/admin", tags=["Admin Dashboard & Staff Governance"])


class ModerationActionRequest(BaseModel):
    action: str  # dismiss, remove_content, warn_author
    resolution_notes: Optional[str] = "Reviewed by EpiCho Moderation Staff."


class VerificationReviewRequest(BaseModel):
    status: str  # verified, rejected
    notes: Optional[str] = "Reviewed by Verification Admin."


class UserStatusRequest(BaseModel):
    status: str  # active, suspended


class UserRoleAssignRequest(BaseModel):
    role_name: str


class HiddenGemOverrideRequest(BaseModel):
    entity_type: str  # recipe or restaurant
    entity_id: uuid.UUID
    days: int = 2


class SystemConfigUpdateRequest(BaseModel):
    configs: Dict[str, str]


class SupportTicketCreate(BaseModel):
    subject: str
    category: str = "general"
    description: str


class SupportTicketUpdate(BaseModel):
    status: str
    resolution_notes: Optional[str] = None


def _log_audit(db: Session, admin: UserAccount, action: str, target_table: str, target_id: Optional[uuid.UUID], meta: dict):
    db.add(
        AuditLog(
            actor_id=admin.user_id,
            actor_role=admin.account_tier,
            action=action,
            target_table=target_table,
            target_id=target_id,
            metadata_=meta,
        )
    )


@router.get("/stats")
def get_admin_stats(
    admin: UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_users = db.query(UserAccount).count()
    active_creators = db.query(UserAccount).filter(UserAccount.account_tier == "creator").count()
    total_businesses = db.query(BusinessProfile).count()
    total_recipes = db.query(Recipe).count()
    total_reels = db.query(Reel).count()
    total_posts = db.query(Post).count()
    total_ai_requests = db.query(AIRequest).count()
    open_reports = db.query(ModerationReport).filter(ModerationReport.status == "open").count()
    pending_verifications = (
        db.query(BusinessProfile).filter(BusinessProfile.verification_status == "pending").count()
        + db.query(VerificationRequest).filter(VerificationRequest.status == "pending").count()
    )
    active_subscriptions = db.query(Subscription).filter(Subscription.status == "active").count()

    payments = db.query(Payment).filter(Payment.status == "paid").all()
    total_revenue_inr = sum(float(p.amount) for p in payments) if payments else 0.0

    return {
        "total_users": total_users,
        "active_creators": active_creators,
        "total_businesses": total_businesses,
        "total_recipes": total_recipes,
        "total_reels": total_reels,
        "total_posts": total_posts,
        "total_ai_requests": total_ai_requests,
        "active_subscriptions": active_subscriptions,
        "open_reports": open_reports,
        "pending_verifications": pending_verifications,
        "total_revenue_inr": total_revenue_inr,
        "system_health": {
            "api_status": "Healthy (FastAPI)",
            "database_status": "Connected (PostgreSQL 16)",
            "redis_status": "Connected" if cache.is_redis_connected else "In-Memory Fallback Active",
            "ai_engine": "Gemini 2.5 Flash Configured" if settings.GEMINI_API_KEY else "Deterministic Fallback Mode",
            "payment_gateway": "Razorpay Live" if settings.RAZORPAY_KEY_SECRET else "Sandbox Test Mode",
        },
    }


@router.get("/users")
def list_users(
    search: Optional[str] = None,
    limit: int = Query(50, le=200),
    admin: UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(UserAccount)
    if search:
        q = q.filter(UserAccount.email.ilike(f"%{search}%") | UserAccount.full_name.ilike(f"%{search}%"))
    users = q.order_by(desc(UserAccount.created_at)).limit(limit).all()
    return [
        {
            "user_id": str(u.user_id),
            "full_name": u.full_name,
            "username": u.username,
            "email": u.email,
            "account_tier": u.account_tier,
            "role_name": u.role.role_name if u.role else u.account_tier,
            "status": u.status,
            "is_verified": u.is_verified,
            "mfa_enabled": u.mfa_enabled,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: uuid.UUID,
    req: UserStatusRequest,
    admin: UserAccount = Depends(require_permission("user.manage")),
    db: Session = Depends(get_db),
):
    u = db.query(UserAccount).filter(UserAccount.user_id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    u.status = req.status
    _log_audit(db, admin, f"user.status.{req.status}", "user_accounts", user_id, {})
    db.commit()
    return {"message": f"User status updated to {req.status}."}


@router.post("/users/{user_id}/roles")
def assign_user_role(
    user_id: uuid.UUID,
    req: UserRoleAssignRequest,
    admin: UserAccount = Depends(require_permission("user.manage")),
    db: Session = Depends(get_db),
):
    u = db.query(UserAccount).filter(UserAccount.user_id == user_id).first()
    role = db.query(Role).filter(Role.role_name == req.role_name).first()
    if not u or not role:
        raise HTTPException(status_code=404, detail="User or role not found.")
    existing = db.query(UserRole).filter(UserRole.user_id == user_id, UserRole.role_id == role.role_id).first()
    if not existing:
        db.add(UserRole(user_id=user_id, role_id=role.role_id))
    _log_audit(db, admin, "user.role.assigned", "user_roles", user_id, {"role_name": req.role_name})
    db.commit()
    return {"message": f"Role '{req.role_name}' granted to {u.email}."}


@router.get("/moderation")
def get_moderation_queue(
    status_filter: str = Query("open"),
    admin: UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    reports = (
        db.query(ModerationReport)
        .filter(ModerationReport.status == status_filter)
        .order_by(desc(ModerationReport.created_at))
        .all()
    )
    return [
        {
            "report_id": str(r.report_id),
            "target_type": r.target_type,
            "target_id": str(r.target_id) if r.target_id else None,
            "reason": r.reason,
            "status": r.status,
            "reporter_name": r.reporter.full_name if r.reporter else "Community Member",
            "created_at": r.created_at,
        }
        for r in reports
    ]


@router.post("/moderation/{report_id}/action")
def act_on_moderation_report(
    report_id: uuid.UUID,
    req: ModerationActionRequest,
    admin: UserAccount = Depends(require_permission("content.moderate")),
    db: Session = Depends(get_db),
):
    rep = db.query(ModerationReport).filter(ModerationReport.report_id == report_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Moderation report not found.")
    rep.status = "resolved" if req.action != "dismiss" else "dismissed"
    rep.moderator_id = admin.user_id
    rep.action = req.action

    if req.action == "remove_content":
        if rep.recipe_id:
            rec = db.query(Recipe).filter(Recipe.recipe_id == rep.recipe_id).first()
            if rec:
                rec.moderation_status = "removed"
        elif rep.target_type == "reel" and rep.target_id:
            rl = db.query(Reel).filter(Reel.reel_id == rep.target_id).first()
            if rl:
                rl.moderation_status = "removed"
        elif rep.target_type == "post" and rep.target_id:
            ps = db.query(Post).filter(Post.post_id == rep.target_id).first()
            if ps:
                ps.moderation_status = "removed"

    _log_audit(db, admin, f"moderation.{req.action}", "moderation_reports", report_id, {"notes": req.resolution_notes})
    db.commit()
    return {"message": f"Moderation action '{req.action}' completed."}


@router.post("/verifications/submit")
def submit_verification_request(
    req: VerificationSubmitRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vr = VerificationRequest(
        user_id=current_user.user_id,
        target_role=req.target_role,
        document_reference=req.document_reference,
        portfolio_url=req.portfolio_url,
        notes=req.notes,
        status="pending",
    )
    db.add(vr)
    db.commit()
    db.refresh(vr)
    return {"message": "Verification application submitted.", "request_id": str(vr.request_id)}


@router.get("/verifications")
def get_pending_verifications(
    admin: UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    businesses = db.query(BusinessProfile).all()
    nutritionists = db.query(NutritionistProfile).all()
    role_reqs = db.query(VerificationRequest).order_by(desc(VerificationRequest.created_at)).all()
    return {
        "businesses": [
            {
                "id": str(b.business_id),
                "name": b.business_name,
                "type": b.business_type,
                "fssai_license_no": b.fssai_license_no,
                "status": b.verification_status,
                "address": b.address,
            }
            for b in businesses
        ],
        "nutritionists": [
            {
                "id": str(n.nutritionist_id),
                "name": n.user.full_name if n.user else "Nutritionist",
                "credentials": n.credentials,
                "status": n.verification_status,
            }
            for n in nutritionists
        ],
        "requests": [
            {
                "id": str(r.request_id),
                "user_id": str(r.user_id),
                "user_name": r.user.full_name if r.user else "Applicant",
                "target_role": r.target_role,
                "document_reference": r.document_reference,
                "portfolio_url": r.portfolio_url,
                "status": r.status,
                "created_at": r.created_at,
            }
            for r in role_reqs
        ],
    }


@router.post("/verifications/{target_id}/review")
def review_verification(
    target_id: uuid.UUID,
    req: VerificationReviewRequest,
    entity_type: str = Query("business", description="business, nutritionist, or request"),
    admin: UserAccount = Depends(require_permission("verification.approve")),
    db: Session = Depends(get_db),
):
    if entity_type == "business":
        biz = db.query(BusinessProfile).filter(BusinessProfile.business_id == target_id).first()
        if not biz:
            raise HTTPException(status_code=404, detail="Business not found.")
        biz.verification_status = req.status
        if req.status == "verified" and biz.owner:
            biz.owner.is_verified = True
    elif entity_type == "nutritionist":
        nut = db.query(NutritionistProfile).filter(NutritionistProfile.nutritionist_id == target_id).first()
        if not nut:
            raise HTTPException(status_code=404, detail="Nutritionist not found.")
        nut.verification_status = req.status
        if req.status == "verified" and nut.user:
            nut.user.is_verified = True
    else:
        vr = db.query(VerificationRequest).filter(VerificationRequest.request_id == target_id).first()
        if not vr:
            raise HTTPException(status_code=404, detail="Verification request not found.")
        vr.status = req.status
        vr.reviewed_by = admin.user_id
        if req.status == "verified" and vr.user:
            vr.user.is_verified = True
            role = db.query(Role).filter(Role.role_name.ilike(vr.target_role)).first()
            if role:
                exists = db.query(UserRole).filter(UserRole.user_id == vr.user_id, UserRole.role_id == role.role_id).first()
                if not exists:
                    db.add(UserRole(user_id=vr.user_id, role_id=role.role_id))
            db.add(
                Notification(
                    user_id=vr.user_id,
                    type="system",
                    title="Verification Approved",
                    body=f"Your {vr.target_role} verification has been approved!",
                    action_url="/profile",
                )
            )

    _log_audit(db, admin, f"verification.{req.status}", entity_type, target_id, {"notes": req.notes})
    db.commit()
    return {"message": f"Verification updated to '{req.status}'."}


@router.get("/finance")
def get_finance_overview(
    admin: UserAccount = Depends(require_permission("finance.manage")),
    db: Session = Depends(get_db),
):
    payments = db.query(Payment).order_by(desc(Payment.created_at)).limit(50).all()
    plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.price.asc()).all()
    total_paid = sum(float(p.amount) for p in payments if p.status == "paid")
    total_refunded = sum(float(p.amount) for p in payments if p.status == "refunded")
    return {
        "total_revenue_inr": total_paid,
        "total_refunded_inr": total_refunded,
        "payments": [
            {
                "payment_id": str(p.payment_id),
                "amount": float(p.amount),
                "method": p.method,
                "status": p.status,
                "paid_at": p.paid_at,
                "user_email": p.subscription.user.email if (p.subscription and p.subscription.user) else "N/A",
                "plan_name": p.subscription.plan.name if (p.subscription and p.subscription.plan) else "Plan",
            }
            for p in payments
        ],
        "plans": [
            {
                "plan_id": str(pl.plan_id),
                "name": pl.name,
                "price": float(pl.price),
                "yearly_price": float(pl.yearly_price or 0),
                "duration_days": pl.duration_days,
            }
            for pl in plans
        ],
    }


@router.patch("/plans/{plan_id}")
def update_plan_pricing(
    plan_id: uuid.UUID,
    req: PlanPriceUpdateRequest,
    admin: UserAccount = Depends(require_permission("subscription.configure")),
    db: Session = Depends(get_db),
):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    plan.price = req.price
    if req.yearly_price is not None:
        plan.yearly_price = req.yearly_price
    if req.description is not None:
        plan.description = req.description
    _log_audit(db, admin, "plan.pricing.updated", "subscription_plans", plan_id, {"price": req.price})
    db.commit()
    return {"message": "Plan pricing updated."}


@router.post("/payments/{payment_id}/refund")
def refund_payment(
    payment_id: uuid.UUID,
    admin: UserAccount = Depends(require_permission("refund.issue")),
    db: Session = Depends(get_db),
):
    p = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found.")
    p.status = "refunded"
    if p.subscription:
        p.subscription.status = "cancelled"
    _log_audit(db, admin, "payment.refunded", "payments", payment_id, {"amount": float(p.amount)})
    db.commit()
    return {"message": "Payment marked as refunded."}


@router.get("/technical")
def get_technical_dashboard(
    admin: UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    configs = db.query(SystemConfig).all()
    recent_ai = db.query(AIRequest).order_by(desc(AIRequest.created_at)).limit(15).all()
    return {
        "environment": settings.ENVIRONMENT,
        "redis_connected": cache.is_redis_connected,
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "razorpay_configured": bool(settings.RAZORPAY_KEY_SECRET),
        "storage_type": settings.STORAGE_TYPE,
        "configs": {c.config_key: c.config_value for c in configs},
        "recent_ai_latency": [
            {
                "request_id": str(a.request_id),
                "type": a.request_type,
                "latency_ms": a.latency_ms,
                "allergen_check_passed": a.allergen_check_passed,
                "flagged_unsafe": a.flagged_unsafe,
                "created_at": a.created_at,
            }
            for a in recent_ai
        ],
    }


@router.put("/config")
def update_system_config(
    req: SystemConfigUpdateRequest,
    admin: UserAccount = Depends(require_permission("system.configure")),
    db: Session = Depends(get_db),
):
    for key, val in req.configs.items():
        cfg = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
        if cfg:
            cfg.config_value = val
        else:
            db.add(SystemConfig(config_key=key, config_value=val))
    _log_audit(db, admin, "system.config.updated", "system_config", None, req.configs)
    db.commit()
    return {"message": "System configuration updated."}


@router.post("/hidden-gems/override")
def override_hidden_gem(
    req: HiddenGemOverrideRequest,
    admin: UserAccount = Depends(require_permission("hidden_gems.override")),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    gem = HiddenGem(
        entity_type=req.entity_type,
        entity_id=req.entity_id,
        gem_score=99.9,
        featured_from=now,
        featured_until=now + timedelta(days=max(1, req.days)),
        is_manual_override=True,
        overridden_by=admin.user_id,
    )
    db.add(gem)
    _log_audit(db, admin, "hidden_gems.override", "hidden_gems", req.entity_id, {"entity_type": req.entity_type})
    db.commit()
    return {"message": "Hidden Gem override applied.", "gem_id": str(gem.gem_id)}


@router.post("/hidden-gems/cycle")
def trigger_hidden_gems_cycle(
    admin: UserAccount = Depends(require_permission("ranking.manage")),
    db: Session = Depends(get_db),
):
    gems = update_or_cycle_hidden_gems(db, force_cycle=True)
    _log_audit(db, admin, "hidden_gems.force_cycle", "hidden_gems", None, {"count": len(gems)})
    db.commit()
    return {"message": f"Selected {len(gems)} Hidden Gems for new cycle."}


@router.get("/roles")
def get_roles_and_permissions(
    admin: UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    roles = db.query(Role).all()
    return {
        "roles": [
            {
                "role_id": str(r.role_id),
                "role_name": r.role_name,
                "tier": r.tier,
                "description": r.description,
                "permissions": sorted(ROLE_PERMISSION_MAP.get(r.role_name.lower(), set())),
            }
            for r in roles
        ]
    }


@router.get("/audit-logs")
def get_audit_logs(
    limit: int = Query(50, le=200),
    admin: UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    logs = db.query(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit).all()
    return [
        {
            "audit_id": str(l.audit_id),
            "actor_email": l.actor.email if l.actor else "System",
            "actor_role": l.actor_role,
            "action": l.action,
            "target_table": l.target_table,
            "target_id": str(l.target_id) if l.target_id else None,
            "metadata": l.metadata_,
            "created_at": l.created_at,
        }
        for l in logs
    ]


@router.get("/tickets")
def list_support_tickets(
    admin: UserAccount = Depends(require_permission("support.manage")),
    db: Session = Depends(get_db),
):
    tickets = db.query(SupportTicket).order_by(desc(SupportTicket.created_at)).all()
    return [
        {
            "ticket_id": str(t.ticket_id),
            "user_email": t.user.email if t.user else "User",
            "subject": t.subject,
            "category": t.category,
            "description": t.description,
            "status": t.status,
            "resolution_notes": t.resolution_notes,
            "created_at": t.created_at,
        }
        for t in tickets
    ]


@router.post("/tickets")
def create_support_ticket(
    req: SupportTicketCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = SupportTicket(
        user_id=current_user.user_id,
        subject=req.subject,
        category=req.category,
        description=req.description,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"message": "Support ticket submitted.", "ticket_id": str(t.ticket_id)}


@router.patch("/tickets/{ticket_id}")
def update_support_ticket(
    ticket_id: uuid.UUID,
    req: SupportTicketUpdate,
    admin: UserAccount = Depends(require_permission("support.manage")),
    db: Session = Depends(get_db),
):
    t = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Support ticket not found.")
    t.status = req.status
    t.assigned_to = admin.user_id
    if req.resolution_notes is not None:
        t.resolution_notes = req.resolution_notes
    _log_audit(db, admin, f"ticket.{req.status}", "support_tickets", ticket_id, {})
    db.commit()
    return {"message": "Ticket updated."}
