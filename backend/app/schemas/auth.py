from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    mfa_code: Optional[str] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    username: str
    account_tier: Optional[str] = "registered"
    diet_preference: Optional[str] = "veg"


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    diet_preference: Optional[str] = None
    dietary_restrictions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    health_conditions: Optional[List[str]] = None
    dislikes: Optional[List[str]] = None
    available_equipment: Optional[List[str]] = None
    city: Optional[str] = None
    preferred_language: Optional[str] = None
    health_data_consent: Optional[bool] = None
    avatar_url: Optional[str] = None


class UserProfileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bio: Optional[str] = None
    diet_preference: Optional[str] = "veg"
    dietary_restrictions: Optional[List[str]] = []
    dislikes: Optional[List[str]] = []
    available_equipment: Optional[List[str]] = []
    city: Optional[str] = "Mumbai"
    preferred_language: Optional[str] = "en"
    health_data_consent: bool = False
    allergies: Optional[List[str]] = []
    health_conditions: Optional[List[str]] = []


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    email: str
    full_name: str
    username: Optional[str] = None
    account_tier: str
    tier: Optional[str] = None
    roles: List[str] = []
    permissions: List[str] = []
    is_verified: bool = False
    mfa_enabled: bool = False
    avatar_url: Optional[str] = None
    profile: Optional[UserProfileSchema] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int = 86400
    mfa_required: bool = False
    mfa_challenge_token: Optional[str] = None
    user: Optional[UserResponse] = None


class MFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str


class MFAVerifyRequest(BaseModel):
    code: str
    challenge_token: Optional[str] = None


class AdminInviteRequest(BaseModel):
    email: EmailStr
    role_name: str
