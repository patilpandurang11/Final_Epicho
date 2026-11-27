import uuid
from datetime import date, datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import get_current_user
from app.models.recipe import AIRequest
from app.models.subscription import Invoice, Payment, Subscription, SubscriptionHistory, SubscriptionPlan
from app.models.user import UserAccount
from app.schemas.subscription import (
    CheckoutCreateRequest,
    CheckoutResponse,
    InvoiceResponse,
    PaymentHistoryResponse,
    PaymentVerifyRequest,
    PlanResponse,
    SubscriptionStatusResponse,
)
from app.services.payment_service import (
    activate_user_subscription,
    create_razorpay_order,
    verify_razorpay_signature,
    verify_razorpay_webhook_signature,
)

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions & Payments"])

CURATED_PLANS = [
    {
        "plan_id": uuid.UUID("50000000-0000-0000-0000-000000000000"),
        "name": "Free Plan",
        "price": 0.00,
        "yearly_price": 0.00,
        "duration_days": 30,
        "description": "Browse food content, upload posts & Reels, basic AI recipe generation (10/day), meal planner, and grocery lists.",
    },
    {
        "plan_id": uuid.UUID("50000000-0000-0000-0000-000000000001"),
        "name": "EpiCho Premium",
        "price": 149.00,
        "yearly_price": 1490.00,
        "duration_days": 30,
        "description": "Higher AI generation limits, cuisine & dish fusion, ingredient substitutions, personalized meal planning, nutrition summaries, ad-free.",
    },
    {
        "plan_id": uuid.UUID("50000000-0000-0000-0000-000000000002"),
        "name": "Creator Pro",
        "price": 299.00,
        "yearly_price": 2990.00,
        "duration_days": 30,
        "description": "All Premium features plus creator analytics, Reel performance reports, audience insights, and portfolio collections.",
    },
    {
        "plan_id": uuid.UUID("50000000-0000-0000-0000-000000000003"),
        "name": "Business Pro",
        "price": 599.00,
        "yearly_price": 5990.00,
        "duration_days": 30,
        "description": "Restaurant profile & menu management, business analytics, offers & promotions, and review engagement reports.",
    },
]


def ensure_plans(db: Session):
    for p in CURATED_PLANS:
        existing = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == p["plan_id"]).first()
        if not existing:
            db.add(
                SubscriptionPlan(
                    plan_id=p["plan_id"],
                    name=p["name"],
                    price=p["price"],
                    yearly_price=p["yearly_price"],
                    duration_days=p["duration_days"],
                    description=p["description"],
                )
            )
        else:
            if existing.yearly_price is None:
                existing.yearly_price = p["yearly_price"]
    db.commit()


@router.get("/plans", response_model=List[PlanResponse])
def get_plans(db: Session = Depends(get_db)):
    ensure_plans(db)
    return (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_active.is_(True))
        .order_by(SubscriptionPlan.price.asc())
        .all()
    )


@router.get("/status", response_model=SubscriptionStatusResponse)
def get_subscription_status(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
    used_today = (
        db.query(func.count(AIRequest.request_id))
        .filter(AIRequest.user_id == current_user.user_id, AIRequest.created_at >= today_start)
        .scalar()
        or 0
    )

    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == current_user.user_id,
            Subscription.status == "active",
            Subscription.end_date >= today,
        )
        .order_by(desc(Subscription.created_at))
        .first()
    )

    if sub:
        plan = sub.plan
        return SubscriptionStatusResponse(
            has_active_subscription=True,
            subscription_id=sub.subscription_id,
            plan_name=plan.name if plan else "EpiCho Premium",
            tier="premium",
            billing_cycle=sub.billing_cycle or "monthly",
            end_date=sub.end_date,
            ai_limit_per_day=9999,
            ai_used_today=used_today,
            features=[
                "Unlimited AI Kitchen generations",
                "Advanced cuisine & dish fusion",
                "Personalized meal planning & pantry subtraction",
                "Ad-free experience & downloadable GST invoices",
            ],
        )

    return SubscriptionStatusResponse(
        has_active_subscription=False,
        plan_name="Free Plan",
        tier="registered",
        billing_cycle="monthly",
        end_date=None,
        ai_limit_per_day=10,
        ai_used_today=used_today,
        features=[
            "Browse all community recipes & Reels",
            "Upload posts & Cooked-This proof",
            "Basic AI Kitchen generations (10/day)",
            "Meal planner & grocery list generator",
        ],
    )


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    req: CheckoutCreateRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_plans(db)
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == req.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found.")

    amount_inr = (
        float(plan.yearly_price or (float(plan.price) * 10))
        if req.billing_cycle == "yearly"
        else float(plan.price)
    )
    order_info = create_razorpay_order(amount_inr, str(plan.plan_id), str(current_user.user_id), req.billing_cycle)

    return CheckoutResponse(
        order_id=order_info["order_id"],
        amount_inr=amount_inr,
        currency="INR",
        billing_cycle=req.billing_cycle,
        key_id=order_info["key_id"],
        plan_name=plan.name,
        prefill_email=current_user.email,
        prefill_name=current_user.full_name,
        sandbox_mode=order_info["sandbox_mode"],
    )


@router.post("/verify")
def verify_payment(
    req: PaymentVerifyRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_valid = verify_razorpay_signature(req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment signature verification failed. Configure Razorpay keys or use valid signature.",
        )

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == req.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")

    sub, inv = activate_user_subscription(
        db=db,
        user=current_user,
        plan=plan,
        payment_id_str=req.razorpay_payment_id,
        order_id_str=req.razorpay_order_id,
        billing_cycle=req.billing_cycle,
    )
    return {
        "message": f"Subscription '{plan.name}' activated successfully!",
        "subscription_id": str(sub.subscription_id),
        "invoice_id": str(inv.invoice_id),
        "invoice_number": inv.invoice_number,
        "end_date": sub.end_date,
    }


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(default=""),
    db: Session = Depends(get_db),
):
    raw_body = await request.body()
    if not verify_razorpay_webhook_signature(raw_body, x_razorpay_signature):
        raise HTTPException(status_code=401, detail="Invalid Razorpay webhook signature.")
    payload = await request.json()
    event = payload.get("event", "")
    return {"received": True, "event": event}


@router.post("/cancel")
def cancel_subscription(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.user_id, Subscription.status == "active")
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found.")
    sub.status = "cancelled"
    db.add(
        SubscriptionHistory(
            user_id=current_user.user_id,
            subscription_id=sub.subscription_id,
            event_type="cancelled",
            notes="Cancelled by user via subscription portal.",
        )
    )
    db.commit()
    return {"message": "Subscription cancelled. Account reverted to Free Plan."}


@router.get("/history", response_model=List[PaymentHistoryResponse])
def get_payment_history(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payments = (
        db.query(Payment)
        .join(Subscription, Subscription.subscription_id == Payment.subscription_id)
        .filter(Subscription.user_id == current_user.user_id)
        .order_by(desc(Payment.created_at))
        .all()
    )
    results = []
    for p in payments:
        inv = db.query(Invoice).filter(Invoice.payment_id == p.payment_id).first()
        results.append(
            PaymentHistoryResponse(
                payment_id=p.payment_id,
                amount=float(p.amount),
                method=p.method,
                status=p.status,
                paid_at=p.paid_at,
                plan_name=p.subscription.plan.name if (p.subscription and p.subscription.plan) else "EpiCho Plan",
                invoice_number=inv.invoice_number if inv else None,
                invoice_id=inv.invoice_id if inv else None,
            )
        )
    return results


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = (
        db.query(Invoice)
        .filter(Invoice.invoice_id == invoice_id, Invoice.user_id == current_user.user_id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    return inv
