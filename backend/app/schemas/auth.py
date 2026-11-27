from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def validate_password_strength(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 UTF-8 bytes.")
    if not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
        raise ValueError("Password must contain at least one letter and one number.")
    return password


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)
    mfa_code: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)
    full_name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    diet_preference: Optional[Literal["veg", "non_veg", "vegan", "eggetarian", "jain"]] = "veg"

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class RegistrationResponse(BaseModel):
    message: str
    email: EmailStr


class EmailRequest(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class EmailTokenRequest(BaseModel):
    token: str = Field(min_length=20, max_length=256)


class PasswordResetRequest(EmailRequest):
    pass


class PasswordResetConfirmRequest(EmailTokenRequest):
    new_password: str = Field(min_length=12, max_length=72)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=4096)


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = Field(default=None, min_length=20, max_length=4096)


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    username: Optional[str] = Field(default=None, min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    bio: Optional[str] = Field(default=None, max_length=500)
    diet_preference: Optional[Literal["veg", "non_veg", "vegan", "eggetarian", "jain"]] = None
    dietary_restrictions: Optional[List[str]] = Field(default=None, max_length=30)
    allergies: Optional[List[str]] = Field(default=None, max_length=30)
    health_conditions: Optional[List[str]] = Field(default=None, max_length=30)
    dislikes: Optional[List[str]] = Field(default=None, max_length=30)
    available_equipment: Optional[List[str]] = Field(default=None, max_length=30)
    city: Optional[str] = Field(default=None, max_length=120)
    preferred_language: Optional[str] = Field(default=None, max_length=20)
    health_data_consent: Optional[bool] = None
    avatar_url: Optional[str] = Field(default=None, max_length=2048)
    cover_image_url: Optional[str] = Field(default=None, max_length=2048)
    cuisine_interests: Optional[List[str]] = Field(default=None, max_length=30)
    website_url: Optional[str] = Field(default=None, max_length=2048)
    social_links: Optional[dict[str, str]] = None
    is_private: Optional[bool] = None

    @field_validator("avatar_url", "cover_image_url", "website_url")
    @classmethod
    def validate_profile_url(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value and not value.startswith(("https://", "http://")):
            raise ValueError("Profile URLs must use HTTP or HTTPS.")
        return value

    @field_validator("social_links")
    @classmethod
    def validate_social_links(
        cls, value: Optional[dict[str, str]]
    ) -> Optional[dict[str, str]]:
        if value is None:
            return value
        if len(value) > 10 or any(
            not key.strip()
            or len(key) > 40
            or len(url) > 2048
            or not url.startswith(("https://", "http://"))
            for key, url in value.items()
        ):
            raise ValueError("Social links must contain up to 10 named HTTP or HTTPS URLs.")
        return value


class UserProfileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bio: Optional[str] = None
    is_private: bool = False
    cover_image_url: Optional[str] = None
    cuisine_interests: List[str] = []
    website_url: Optional[str] = None
    social_links: dict[str, str] = {}
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
    expires_in: int = 900
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
    role_name: Literal[
        "super_admin",
        "sysadmin",
        "infra_admin",
        "tech_admin",
        "content_moderator",
        "moderator",
        "verification_admin",
        "bizadmin",
        "ranking_admin",
        "finance_admin",
        "finance",
        "customer_support",
        "analytics_admin",
    ]

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class AdminInviteAcceptRequest(EmailTokenRequest):
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)
    full_name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)
