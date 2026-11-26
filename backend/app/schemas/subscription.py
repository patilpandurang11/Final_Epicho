from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class PlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plan_id: UUID
    name: str
    price: float
    yearly_price: Optional[float] = None
    duration_days: int
    description: Optional[str] = None
    is_active: bool = True


class PlanPriceUpdateRequest(BaseModel):
    price: float
    yearly_price: Optional[float] = None
    description: Optional[str] = None


class CheckoutCreateRequest(BaseModel):
    plan_id: UUID
    billing_cycle: str = "monthly"  # monthly or yearly


class CheckoutResponse(BaseModel):
    order_id: str
    amount_inr: float
    currency: str = "INR"
    billing_cycle: str = "monthly"
    key_id: str
    plan_name: str
    prefill_email: str
    prefill_name: str
    sandbox_mode: bool = True


class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: UUID
    billing_cycle: str = "monthly"


class SubscriptionStatusResponse(BaseModel):
    has_active_subscription: bool
    subscription_id: Optional[UUID] = None
    plan_name: Optional[str] = "Free Plan"
    tier: str = "registered"
    billing_cycle: str = "monthly"
    end_date: Optional[date] = None
    ai_limit_per_day: int = 10
    ai_used_today: int = 0
    features: List[str] = []


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_id: UUID
    invoice_number: str
    amount_inr: float
    gst_inr: float
    total_inr: float
    status: str
    issued_at: datetime


class PaymentHistoryResponse(BaseModel):
    payment_id: UUID
    amount: float
    method: str
    status: str
    paid_at: Optional[datetime] = None
    plan_name: str
    invoice_number: Optional[str] = None
    invoice_id: Optional[UUID] = None
