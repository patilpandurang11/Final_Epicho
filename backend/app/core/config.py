import os
import secrets
from pathlib import Path
from typing import Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "EpiCho API"
    VERSION: str = "2.0.0"
    ENVIRONMENT: str = "development"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = "postgresql://epicho@127.0.0.1:5432/epicho"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT & Field Encryption
    JWT_SECRET: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    FIELD_ENCRYPTION_KEY: Optional[str] = None

    # Authentication email
    FRONTEND_BASE_URL: str = "http://localhost:3000"
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "EpiCho <no-reply@localhost>"
    SMTP_STARTTLS: bool = True
    EMAIL_OUTBOX_DIR: str = str(Path(__file__).resolve().parents[3] / ".dev-email-outbox")

    # Google Gemini AI API
    GEMINI_API_KEY: Optional[str] = None
    AI_PROVIDER: str = "mock"

    # Razorpay Payment Gateway
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None
    ALLOW_SANDBOX_PAYMENTS: bool = True

    # Media Storage
    STORAGE_TYPE: str = "local"
    STORAGE_PATH: str = "./uploads"
    CDN_BASE_URL: str = "http://localhost:8000/uploads"
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_configuration(self) -> "Settings":
        if self.ENVIRONMENT.lower() != "production":
            return self

        if "DATABASE_URL" not in self.model_fields_set:
            raise ValueError("DATABASE_URL must be explicitly configured in production.")
        if (
            "JWT_SECRET" not in self.model_fields_set
            or len(self.JWT_SECRET) < 32
            or self.JWT_SECRET.lower().startswith(("change-me", "replace-me"))
        ):
            raise ValueError("Set a non-placeholder JWT_SECRET of at least 32 characters in production.")
        if (
            not self.FIELD_ENCRYPTION_KEY
            or len(self.FIELD_ENCRYPTION_KEY) < 32
            or self.FIELD_ENCRYPTION_KEY.lower().startswith(("change-me", "replace-me"))
        ):
            raise ValueError("Set a non-placeholder FIELD_ENCRYPTION_KEY of at least 32 characters in production.")
        if not self.cors_origins or "*" in self.cors_origins:
            raise ValueError("Configure explicit CORS_ALLOWED_ORIGINS in production.")
        if any(origin.startswith("http://") for origin in self.cors_origins):
            raise ValueError("Use HTTPS origins in CORS_ALLOWED_ORIGINS in production.")
        if self.ALLOW_SANDBOX_PAYMENTS:
            raise ValueError("Disable ALLOW_SANDBOX_PAYMENTS in production.")
        if not self.SMTP_HOST:
            raise ValueError("Configure SMTP_HOST for production authentication emails.")
        if (
            "SMTP_FROM" not in self.model_fields_set
            or "localhost" in self.SMTP_FROM.lower()
        ):
            raise ValueError("Configure a production SMTP_FROM address.")
        if not self.FRONTEND_BASE_URL.startswith("https://"):
            raise ValueError("Use an HTTPS FRONTEND_BASE_URL in production.")
        return self


settings = Settings()
os.makedirs(settings.STORAGE_PATH, exist_ok=True)
