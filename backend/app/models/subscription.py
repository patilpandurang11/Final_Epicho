import uuid
from datetime import datetime, date, timezone
from sqlalchemy import Column, String, DateTime, Date, Integer, Numeric, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import PaymentStatusEnum, SubscriptionStatusEnum


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    __table_args__ = {"schema": "public"}

    plan_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    yearly_price = Column(Numeric(10, 2), nullable=True)
    duration_days = Column(Integer, nullable=False, default=30)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = {"schema": "public"}

    subscription_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("public.subscription_plans.plan_id"), nullable=False)
    start_date = Column(Date, default=date.today, nullable=False)
    end_date = Column(Date, nullable=False)
    billing_cycle = Column(String, default="monthly", nullable=False)
    status = Column(SubscriptionStatusEnum, default="active", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("UserAccount")
    plan = relationship("SubscriptionPlan")
    payments = relationship("Payment", back_populates="subscription", cascade="all, delete-orphan")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = {"schema": "public"}

    payment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("public.subscriptions.subscription_id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    method = Column(String, default="Razorpay", nullable=False)
    gateway_order_id = Column(String, nullable=True)
    gateway_payment_id = Column(String, nullable=True)
    status = Column(PaymentStatusEnum, default="pending", nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    subscription = relationship("Subscription", back_populates="payments")


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = {"schema": "public"}

    invoice_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String, unique=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("public.subscriptions.subscription_id", ondelete="SET NULL"), nullable=True)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("public.payments.payment_id", ondelete="SET NULL"), nullable=True)
    amount_inr = Column(Numeric(10, 2), nullable=False)
    gst_inr = Column(Numeric(10, 2), nullable=False, default=0.00)
    total_inr = Column(Numeric(10, 2), nullable=False)
    status = Column(String, default="paid", nullable=False)
    issued_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SubscriptionHistory(Base):
    __tablename__ = "subscription_history"
    __table_args__ = {"schema": "public"}

    history_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("public.subscriptions.subscription_id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String, nullable=False)  # activated, upgraded, downgraded, cancelled, refunded, renewed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
