import base64
import hashlib
import hmac
import secrets
import struct
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        pw_bytes = plain_password.encode("utf-8")
        hash_bytes = hashed_password.replace("$2a$", "$2b$").encode("utf-8")
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        pass
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": to_encode.get("type", "access")})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


# ==============================================================================
# TOTP Multi-Factor Authentication (RFC 6238, zero extra dependencies)
# ==============================================================================

def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("utf-8").rstrip("=")


def _totp_at(secret: str, counter: int, digits: int = 6) -> str:
    padded = secret.upper() + "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(padded, casefold=True)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10**digits)).zfill(digits)


def verify_totp_code(secret: str, code: str, window: int = 1) -> bool:
    if not secret or not code:
        return False
    clean_code = code.strip().replace(" ", "")
    if not clean_code.isdigit() or len(clean_code) != 6:
        return False
    current_step = int(time.time() // 30)
    for step_offset in range(-window, window + 1):
        if hmac.compare_digest(_totp_at(secret, current_step + step_offset), clean_code):
            return True
    return False


def get_totp_provisioning_uri(secret: str, email: str, issuer: str = "EpiCho") -> str:
    return f"otpauth://totp/{issuer}:{email}?secret={secret}&issuer={issuer}&digits=6&period=30"


# ==============================================================================
# Field-level Encryption (DPDP Health & Allergy Protection)
# ==============================================================================

def _get_fernet() -> Fernet:
    raw = (settings.FIELD_ENCRYPTION_KEY or settings.JWT_SECRET).encode("utf-8")
    digest = hashlib.sha256(raw).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_sensitive_text(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_sensitive_text(ciphertext: Optional[str]) -> str:
    if not ciphertext:
        return ""
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception):
        return ciphertext
