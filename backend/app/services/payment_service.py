import hashlib
import hmac
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.admin import Notification
from app.models.subscription import Invoice, Payment, Subscription, SubscriptionHistory, SubscriptionPlan
from app.models.user import UserAccount


def is_sandbox_payment_allowed() -> bool:
    return (
        settings.ENVIRONMENT != "production"
        and settings.ALLOW_SANDBOX_PAYMENTS
        and not settings.RAZORPAY_KEY_SECRET
    )


def create_razorpay_order(amount_inr: float, plan_id: str, user_id: str, billing_cycle: str = "monthly") -> Dict[str, Any]:
    amount_paise = int(round(amount_inr * 100))
    order_id = f"order_epicho_{int(datetime.now().timestamp())}_{str(user_id)[:8]}"
    return {
        "order_id": order_id,
        "amount_paise": amount_paise,
        "currency": "INR",
        "billing_cycle": billing_cycle,
        "key_id": settings.RAZORPAY_KEY_ID or "rzp_test_configure_in_env",
        "sandbox_mode": is_sandbox_payment_allowed(),
    }


def verify_razorpay_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
    if settings.RAZORPAY_KEY_SECRET:
        payload = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, razorpay_signature)

    # Only allow sandbox verification explicitly when no live key secret is configured and not in production
    if is_sandbox_payment_allowed() and razorpay_signature.startswith("demo_sig_"):
        return True
    return False


def verify_razorpay_webhook_signature(raw_body: bytes, signature_header: str) -> bool:
    secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not secret:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header or "")


def activate_user_subscription(
    db: Session,
    user: UserAccount,
    plan: SubscriptionPlan,
    payment_id_str: str,
    order_id_str: str = "",
    billing_cycle: str = "monthly",
    event_type: str = "activated",
) -> tuple[Subscription, Invoice]:
    start = date.today()
    days = 365 if billing_cycle == "yearly" else plan.duration_days
    end = start + timedelta(days=days)

    # Cancel prior active subscriptions when switching
    db.query(Subscription).filter(
        Subscription.user_id == user.user_id, Subscription.status == "active"
    ).update({"status": "cancelled"})

    subscription = Subscription(
        user_id=user.user_id,
        plan_id=plan.plan_id,
        start_date=start,
        end_date=end,
        billing_cycle=billing_cycle,
        status="active",
    )
    db.add(subscription)
    db.flush()

    total_amount = float(plan.yearly_price or (float(plan.price) * 10)) if billing_cycle == "yearly" else float(plan.price)
    base_amount = round(total_amount / 1.18, 2) if total_amount > 0 else 0.0
    gst_amount = round(total_amount - base_amount, 2) if total_amount > 0 else 0.0

    payment = Payment(
        subscription_id=subscription.subscription_id,
        amount=total_amount,
        method="Razorpay",
        gateway_order_id=order_id_str or None,
        gateway_payment_id=payment_id_str or None,
        status="paid",
        paid_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    db.flush()

    invoice = Invoice(
        invoice_number=f"INV-EPICHO-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
        user_id=user.user_id,
        subscription_id=subscription.subscription_id,
        payment_id=payment.payment_id,
        amount_inr=base_amount,
        gst_inr=gst_amount,
        total_inr=total_amount,
        status="paid",
    )
    db.add(invoice)

    db.add(
        SubscriptionHistory(
            user_id=user.user_id,
            subscription_id=subscription.subscription_id,
            event_type=event_type,
            notes=f"{plan.name} ({billing_cycle}) activated via Razorpay ({payment_id_str}).",
        )
    )

    # Do not overwrite admin tier
    if user.account_tier != "admin":
        if "creator" in plan.name.lower():
            user.account_tier = "creator"
        elif "business" in plan.name.lower():
            user.account_tier = "business"
        elif float(plan.price) > 0:
            user.account_tier = "premium"

    db.add(
        Notification(
            user_id=user.user_id,
            type="subscription",
            title=f"{plan.name} Active",
            body=f"Your {plan.name} ({billing_cycle}) subscription is active through {end.isoformat()}. Invoice: {invoice.invoice_number}.",
            action_url="/subscriptions",
        )
    )

    db.commit()
    db.refresh(subscription)
    db.refresh(invoice)
    return subscription, invoice
