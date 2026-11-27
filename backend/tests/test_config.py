import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_development_settings_use_ephemeral_signing_secrets():
    first = Settings()
    second = Settings()

    assert first.JWT_SECRET
    assert first.JWT_SECRET != second.JWT_SECRET
    assert first.cors_origins == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def test_production_requires_explicit_non_placeholder_secrets():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production")


def test_production_rejects_wildcard_cors():
    with pytest.raises(ValidationError, match="CORS_ALLOWED_ORIGINS"):
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="postgresql://epicho@db.example/epicho",
            JWT_SECRET="j" * 48,
            FIELD_ENCRYPTION_KEY="f" * 48,
            CORS_ALLOWED_ORIGINS="*",
            ALLOW_SANDBOX_PAYMENTS=False,
        )


def test_production_requires_sandbox_payments_disabled():
    with pytest.raises(ValidationError, match="ALLOW_SANDBOX_PAYMENTS"):
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="postgresql://epicho@db.example/epicho",
            JWT_SECRET="j" * 48,
            FIELD_ENCRYPTION_KEY="f" * 48,
            CORS_ALLOWED_ORIGINS="https://epicho.example",
        )
