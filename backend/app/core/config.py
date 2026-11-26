import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "EpiCho API"
    VERSION: str = "2.0.0"
    ENVIRONMENT: str = "development"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = "postgresql://epicho:6335b1a3b762aeb4ac3cc8e2bd06b42827e4e390881c4343@127.0.0.1:5432/epicho"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT & Field Encryption
    JWT_SECRET: str = "epicho-super-secret-jwt-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    FIELD_ENCRYPTION_KEY: Optional[str] = None

    # Google Gemini AI API
    GEMINI_API_KEY: Optional[str] = None

    # Razorpay Payment Gateway
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None
    ALLOW_SANDBOX_PAYMENTS: bool = True

    # Media Storage
    STORAGE_TYPE: str = "local"
    STORAGE_PATH: str = "/home/pankaj/FINAL_EPICHO/backend/uploads"
    CDN_BASE_URL: str = "http://localhost:8000/uploads"

    model_config = SettingsConfigDict(
        env_file="/home/pankaj/FINAL_EPICHO/.env",
        extra="allow",
    )


settings = Settings()
os.makedirs(settings.STORAGE_PATH, exist_ok=True)
