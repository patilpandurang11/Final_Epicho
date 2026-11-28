from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: str = "Signature"
    recipe_id: Optional[UUID] = None
    is_available: bool = True


class MenuItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: UUID
    name: str
    description: Optional[str] = None
    price: float
    category: str = "Signature"
    recipe_id: Optional[UUID] = None
    is_available: bool = True


class BusinessProfileCreate(BaseModel):
    business_name: str
    business_type: Literal[
        "Restaurant",
        "Nutritionist",
        "CulinaryExpert",
        "Chef",
        "FoodBrand",
    ] = "Restaurant"
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    cuisine_type: Optional[str] = None
    contact_info: Dict[str, Any] = {}
    fssai_license_no: Optional[str] = None


class BusinessReviewCreate(BaseModel):
    rating: int
    review_text: str


class OwnerReplyRequest(BaseModel):
    owner_reply: str


class PromotionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    promo_code: Optional[str] = None
    discount_percent: int = 10


class BusinessProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    business_id: UUID
    owner_user_id: UUID
    business_name: str
    business_type: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    cuisine_type: Optional[str] = None
    contact_info: Dict[str, Any] = {}
    fssai_license_no: Optional[str] = None
    verification_status: str
    menu_items: List[MenuItemResponse] = []


class NutritionistProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nutritionist_id: UUID
    user_id: UUID
    full_name: str
    credentials: str
    specializations: List[str]
    consultation_fee: float
    bio: Optional[str] = None
    is_verified: bool
    avatar_url: Optional[str] = None
    availability_slots: List[str] = []


class ConsultationCreate(BaseModel):
    nutritionist_id: UUID
    appointment_time: datetime
    duration_minutes: int = 45
    consultation_notes: Optional[str] = None
    share_health_data: bool = False


class ConsultationStatusUpdate(BaseModel):
    status: str


class ConsultationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    consultation_id: UUID
    client_id: UUID
    client_name: str
    nutritionist_id: UUID
    nutritionist_name: str
    appointment_time: datetime
    duration_minutes: int
    status: str
    fee_inr: float
    payment_status: str
    share_health_data: bool = False
    meet_link: Optional[str] = None
    client_health_summary: Optional[Dict[str, Any]] = None


class VerificationSubmitRequest(BaseModel):
    target_role: str
    document_reference: str
    portfolio_url: Optional[str] = None
    notes: Optional[str] = None
