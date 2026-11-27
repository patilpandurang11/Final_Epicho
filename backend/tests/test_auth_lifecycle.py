import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import pytest

from app.core.database import SessionLocal
from app.core.security import get_password_hash, verify_password
from app.models.user import AuthActionToken, AuthUser, Role, UserAccount, UserRole, UserSession
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


@pytest.fixture
def sent_emails(monkeypatch):
    messages = []
    monkeypatch.setattr(
        "app.api.v1.auth.send_action_email",
        lambda recipient, subject, url: messages.append((recipient, subject, url)),
    )
    return messages


def register_user(sent_emails, account_tier=None):
    suffix = uuid.uuid4().hex
    email = f"auth_{suffix}@example.com"
    username = f"member_{suffix[:20]}"
    payload = {
        "email": email,
        "password": "StrongPassword123!",
        "full_name": "Test Community Member",
        "username": username,
        "diet_preference": "veg",
    }
    if account_tier:
        payload["account_tier"] = account_tier
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    verification_token = parse_qs(urlparse(sent_emails[-1][2]).query)["token"][0]
    return email, username, verification_token, response


def verify_email(token):
    return client.post("/api/v1/auth/verify-email", json={"token": token})


def login(email, password="StrongPassword123!"):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )


def test_registration_validation_duplicates_hashing_and_no_tier_escalation(sent_emails):
    invalid = client.post(
        "/api/v1/auth/register",
        json={
            "email": "not-an-email",
            "password": "short",
            "full_name": "A",
            "username": "x",
        },
    )
    assert invalid.status_code == 422
    assert sent_emails == []

    invalid_diet = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"invalid_{uuid.uuid4().hex}@example.com",
            "password": "StrongPassword123!",
            "full_name": "Test Community Member",
            "username": f"invalid_{uuid.uuid4().hex[:16]}",
            "diet_preference": "keto",
        },
    )
    assert invalid_diet.status_code == 422

    email, username, verification_token, response = register_user(
        sent_emails,
        account_tier="admin",
    )
    assert set(response.json()) == {"message", "email"}
    assert "access_token" not in response.json()

    with SessionLocal() as db:
        account = db.query(UserAccount).filter_by(email=email).one()
        auth_user = db.query(AuthUser).filter_by(email=email).one()
        assert account.account_tier == "registered"
        assert account.role.role_name == "registered"
        assert auth_user.encrypted_password != "StrongPassword123!"
        assert verify_password("StrongPassword123!", auth_user.encrypted_password)

    assert login(email).status_code == 403
    assert verify_email(verification_token).status_code == 200
    assert verify_email(verification_token).status_code == 400
    assert login(email, "WrongPassword123!").status_code == 401

    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "email": email.upper(),
            "password": "StrongPassword123!",
            "full_name": "Test Community Member",
            "username": f"another_{uuid.uuid4().hex[:20]}",
        },
    )
    assert duplicate.status_code == 409

    duplicate_username = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"other_{uuid.uuid4().hex}@example.com",
            "password": "StrongPassword123!",
            "full_name": "Test Community Member",
            "username": username.upper(),
        },
    )
    assert duplicate_username.status_code == 409


def test_refresh_rotation_logout_and_session_revocation(sent_emails):
    email, _, verification_token, _ = register_user(sent_emails)
    assert verify_email(verification_token).status_code == 200
    authenticated = login(email)
    assert authenticated.status_code == 200
    token_data = authenticated.json()
    access_token = token_data["access_token"]
    refresh_token = token_data["refresh_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    current_user = client.get("/api/v1/auth/me", headers=headers)
    assert current_user.status_code == 200
    assert current_user.json()["email"] == email
    assert "encrypted_password" not in current_user.json()
    assert client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    ).status_code == 401

    rotated = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert rotated.status_code == 200
    new_tokens = rotated.json()
    assert new_tokens["refresh_token"] != refresh_token
    assert client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    ).status_code == 401

    logged_out = client.post(
        "/api/v1/auth/logout",
        headers=headers,
        json={"refresh_token": new_tokens["refresh_token"]},
    )
    assert logged_out.status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": new_tokens["refresh_token"]},
    ).status_code == 401


def test_password_reset_revokes_sessions_and_is_single_use(sent_emails):
    email, _, verification_token, _ = register_user(sent_emails)
    assert verify_email(verification_token).status_code == 200
    initial_login = login(email)
    old_access_token = initial_login.json()["access_token"]
    old_refresh_token = initial_login.json()["refresh_token"]

    requested = client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": email},
    )
    assert requested.status_code == 200
    reset_token = parse_qs(urlparse(sent_emails[-1][2]).query)["token"][0]
    reset = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": reset_token, "new_password": "NewStrongPassword456!"},
    )
    assert reset.status_code == 200
    assert client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": reset_token, "new_password": "OtherStrongPassword789!"},
    ).status_code == 400

    assert client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {old_access_token}"},
    ).status_code == 401
    assert client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    ).status_code == 401
    assert login(email).status_code == 401
    assert login(email, "NewStrongPassword456!").status_code == 200

    unknown = client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": f"missing_{uuid.uuid4().hex}@example.com"},
    )
    assert unknown.status_code == 200
    assert "If an active account" in unknown.json()["message"]


def test_resending_verification_invalidates_old_link(sent_emails):
    email, _, original_token, _ = register_user(sent_emails)
    response = client.post(
        "/api/v1/auth/resend-verification",
        json={"email": email},
    )
    assert response.status_code == 200
    replacement_token = parse_qs(urlparse(sent_emails[-1][2]).query)["token"][0]

    assert verify_email(original_token).status_code == 400
    assert verify_email(replacement_token).status_code == 200
    assert login(email).status_code == 200


def test_guest_community_business_and_admin_permissions(sent_emails):
    assert client.get("/api/v1/recipes").status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401

    email, _, verification_token, _ = register_user(sent_emails)
    assert verify_email(verification_token).status_code == 200
    token_data = login(email).json()
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 403
    assert client.post(
        "/api/v1/auth/admin-login",
        json={"email": email, "password": "StrongPassword123!"},
    ).status_code == 403
    business_id = uuid.uuid4()
    assert client.post(
        f"/api/v1/restaurants/{business_id}/menu",
        headers=headers,
        json={"name": "Test dish", "price": 5},
    ).status_code == 403

    with SessionLocal() as db:
        account = db.query(UserAccount).filter_by(email=email).one()
        account.account_tier = "admin"
        business_role = db.query(Role).filter_by(role_name="restaurant").one()
        db.add(UserRole(user_id=account.user_id, role_id=business_role.role_id))
        db.commit()

    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 403
    assert client.post(
        f"/api/v1/restaurants/{business_id}/menu",
        headers=headers,
        json={"name": "Test dish", "price": 5},
    ).status_code == 404


def test_expired_session_is_rejected(sent_emails):
    email, _, verification_token, _ = register_user(sent_emails)
    assert verify_email(verification_token).status_code == 200
    token_data = login(email).json()
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    with SessionLocal() as db:
        session = db.query(UserSession).filter_by(user_id=token_data["user"]["user_id"]).one()
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_expired_email_and_password_action_tokens_are_rejected(sent_emails):
    email, _, verification_token, _ = register_user(sent_emails)
    with SessionLocal() as db:
        account = db.query(UserAccount).filter_by(email=email).one()
        action_token = (
            db.query(AuthActionToken)
            .filter_by(user_id=account.user_id, purpose="verify_email")
            .one()
        )
        action_token.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert verify_email(verification_token).status_code == 400

    client.post("/api/v1/auth/resend-verification", json={"email": email})
    new_verification_token = parse_qs(urlparse(sent_emails[-1][2]).query)["token"][0]
    assert verify_email(new_verification_token).status_code == 200

    assert client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": email},
    ).status_code == 200
    reset_token = parse_qs(urlparse(sent_emails[-1][2]).query)["token"][0]
    with SessionLocal() as db:
        account = db.query(UserAccount).filter_by(email=email).one()
        action_token = (
            db.query(AuthActionToken)
            .filter_by(user_id=account.user_id, purpose="password_reset")
            .one()
        )
        action_token.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()

    assert client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": reset_token, "new_password": "NewStrongPassword456!"},
    ).status_code == 400


def test_inactive_account_cannot_login_or_refresh(sent_emails):
    email, _, verification_token, _ = register_user(sent_emails)
    assert verify_email(verification_token).status_code == 200
    token_data = login(email).json()
    with SessionLocal() as db:
        account = db.query(UserAccount).filter_by(email=email).one()
        account.status = "suspended"
        db.commit()

    assert login(email).status_code == 403
    assert client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token_data["refresh_token"]},
    ).status_code == 401
    assert client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token_data['access_token']}"},
    ).status_code == 401


def test_staff_invitation_is_emailed_and_accepted_once(sent_emails):
    admin_email = f"inviter_{uuid.uuid4().hex}@example.com"
    invitee_email = f"staff_{uuid.uuid4().hex}@example.com"
    admin_id = uuid.uuid4()
    with SessionLocal() as db:
        role = db.query(Role).filter_by(role_name="super_admin").one()
        db.add(
            AuthUser(
                id=admin_id,
                email=admin_email,
                encrypted_password=get_password_hash("AdminPassword123!"),
            )
        )
        db.add(
            UserAccount(
                user_id=admin_id,
                full_name="Test Inviting Admin",
                username=f"inviter_{uuid.uuid4().hex[:16]}",
                email=admin_email,
                role_id=role.role_id,
                account_tier="admin",
                status="active",
                is_verified=True,
            )
        )
        db.commit()

    admin_tokens = client.post(
        "/api/v1/auth/admin-login",
        json={"email": admin_email, "password": "AdminPassword123!"},
    ).json()
    admin_headers = {"Authorization": f"Bearer {admin_tokens['access_token']}"}
    invitation = client.post(
        "/api/v1/auth/admin-invite",
        headers=admin_headers,
        json={"email": invitee_email, "role_name": "content_moderator"},
    )
    assert invitation.status_code == 200
    assert "invite_token" not in invitation.json()
    assert sent_emails[-1][0] == invitee_email
    assert "/accept-admin-invite?token=" in sent_emails[-1][2]
    invite_token = parse_qs(urlparse(sent_emails[-1][2]).query)["token"][0]

    mismatched_email = client.post(
        "/api/v1/auth/admin-invite/accept",
        json={
            "token": invite_token,
            "email": f"wrong_{uuid.uuid4().hex}@example.com",
            "password": "StaffPassword123!",
            "full_name": "Invited Staff Member",
            "username": f"staff_{uuid.uuid4().hex[:16]}",
        },
    )
    assert mismatched_email.status_code == 400

    accepted = client.post(
        "/api/v1/auth/admin-invite/accept",
        json={
            "token": invite_token,
            "email": invitee_email,
            "password": "StaffPassword123!",
            "full_name": "Invited Staff Member",
            "username": f"staff_{uuid.uuid4().hex[:16]}",
        },
    )
    assert accepted.status_code == 201
    assert accepted.json()["email"] == invitee_email
    assert "token" not in accepted.json()

    with SessionLocal() as db:
        staff_user = db.query(UserAccount).filter_by(email=invitee_email).one()
        assert staff_user.role.role_name == "content_moderator"
        assert staff_user.account_tier == "admin"
        assert staff_user.is_verified is True

    staff_login = client.post(
        "/api/v1/auth/admin-login",
        json={"email": invitee_email, "password": "StaffPassword123!"},
    )
    assert staff_login.status_code == 200
    assert client.post(
        "/api/v1/auth/admin-invite/accept",
        json={
            "token": invite_token,
            "email": invitee_email,
            "password": "AnotherPassword123!",
            "full_name": "Duplicate Staff Member",
            "username": f"other_{uuid.uuid4().hex[:16]}",
        },
    ).status_code == 400
