import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Numeric, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import BusinessCategoryEnum, VerificationStatusEnum


class BusinessProfile(Base):
    __tablename__ = "business_profiles"
    __table_args__ = {"schema": "public"}

    business_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    business_name = Column(String, nullable=False)
    business_type = Column(BusinessCategoryEnum, default="Restaurant", nullable=False)
    address = Column(Text, default="Unspecified", nullable=False)
    latitude = Column(Numeric(9, 6), nullable=True)
    longitude = Column(Numeric(9, 6), nullable=True)
    cuisine_type = Column(String, nullable=True)
    contact_info = Column(JSON, default={}, nullable=False)
    fssai_license_no = Column(String, nullable=True)
    certification_no = Column(String, nullable=True)
    verification_status = Column(VerificationStatusEnum, default="pending", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("UserAccount")
    menu_items = relationship("MenuItem", back_populates="business", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_items"
    __table_args__ = {"schema": "public"}

    menu_item_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("public.business_profiles.business_id", ondelete="CASCADE"), nullable=False)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="SET NULL"), nullable=True)
    dish_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    in_stock = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    business = relationship("BusinessProfile", back_populates="menu_items")
    recipe = relationship("Recipe")

    @property
    def item_id(self):
        return self.menu_item_id

    @property
    def name(self):
        return self.dish_name

    @property
    def is_available(self):
        return self.in_stock


class BusinessReview(Base):
    __tablename__ = "business_reviews"
    __table_args__ = {"schema": "public"}

    review_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("public.business_profiles.business_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False, default=5)
    review_text = Column(Text, nullable=False)
    owner_reply = Column(Text, nullable=True)
    is_critic_review = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("UserAccount")


class Promotion(Base):
    __tablename__ = "promotions"
    __table_args__ = {"schema": "public"}

    promotion_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("public.business_profiles.business_id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    promo_code = Column(String, nullable=True)
    discount_percent = Column(Integer, default=10, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class NutritionistProfile(Base):
    __tablename__ = "nutritionist_profiles"
    __table_args__ = {"schema": "public"}

    nutritionist_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False, unique=True)
    business_id = Column(UUID(as_uuid=True), ForeignKey("public.business_profiles.business_id", ondelete="SET NULL"), nullable=True)
    qualification = Column(String, nullable=False, default="M.Sc Clinical Nutrition")
    specialization = Column(String, nullable=False, default="Metabolic & Preventive Health")
    experience_years = Column(Integer, nullable=False, default=5)
    certification = Column(String, nullable=False, default="RD (IDA)")
    verification_status = Column(VerificationStatusEnum, default="pending", nullable=False)
    consultation_fee = Column(Numeric(10, 2), default=999.00)
    bio = Column(Text, nullable=True)
    availability_slots = Column(JSON, default=["Mon 10:00 AM", "Wed 04:00 PM", "Fri 11:00 AM"], nullable=False)

    user = relationship("UserAccount")

    @property
    def credentials(self) -> str:
        return f"{self.qualification} • {self.certification}"

    @property
    def specializations(self):
        return [s.strip() for s in (self.specialization or "").split(",") if s.strip()]

    @property
    def is_verified(self) -> bool:
        return self.verification_status == "verified"


class Consultation(Base):
    __tablename__ = "consultations"
    __table_args__ = {"schema": "public"}

    consultation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    nutritionist_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    appointment_time = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=45)
    status = Column(String, default="scheduled", nullable=False)
    consultation_notes = Column(Text, nullable=True)
    share_health_data = Column(Boolean, default=False, nullable=False)
    fee_inr = Column(Numeric(10, 2), default=999.00)
    payment_status = Column(String, default="paid", nullable=False)
    meet_link = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    client = relationship("UserAccount", foreign_keys=[client_id])
    nutritionist = relationship("UserAccount", foreign_keys=[nutritionist_id])


class VerificationRequest(Base):
    __tablename__ = "verification_requests"
    __table_args__ = {"schema": "public"}

    request_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    target_role = Column(String, nullable=False)  # creator, business, nutritionist, critic
    document_reference = Column(Text, nullable=False)
    portfolio_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="pending", nullable=False)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("UserAccount", foreign_keys=[user_id])
