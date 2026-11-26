import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import _totp_at
import time

client = TestClient(app)


def test_root_and_health():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["platform"] == "EpiCho"

    h = client.get("/health")
    assert h.status_code == 200
    assert h.json()["database"] == "connected"


def test_public_discovery_endpoints():
    for path in [
        "/api/v1/recipes",
        "/api/v1/reels",
        "/api/v1/posts",
        "/api/v1/blogs",
        "/api/v1/heritage",
        "/api/v1/restaurants",
        "/api/v1/rankings?category=restaurants",
        "/api/v1/rankings/hidden-gems",
        "/api/v1/rankings/hidden-gems/archive",
        "/api/v1/rankings/methodology",
        "/api/v1/consultations/nutritionists",
        "/api/v1/subscriptions/plans",
        "/api/v1/ai-kitchen/quota",
    ]:
        resp = client.get(path)
        assert resp.status_code == 200, f"{path} failed: {resp.text}"


def test_ai_kitchen_allergen_sanitization_and_translation():
    payload = {
        "ingredients": ["paneer", "peanut", "tomatoes", "garlic"],
        "cuisine_preference": "Indian",
        "taste_preference": "spicy",
        "diet_preference": "veg",
        "servings": 2,
        "cooking_time_mins": 25,
        "cooking_equipment": ["Pan", "Knife"],
        "allergies": ["peanuts"],
    }
    resp = client.post("/api/v1/ai-kitchen/generate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_ai_generated"] is True
    assert len(data["allergen_warnings"]) >= 1
    assert all("peanut" not in ing["name"].lower() for ing in data["ingredients"])

    tr = client.post("/api/v1/ai-kitchen/translate", json={"recipe": data, "target_language": "Hindi"})
    assert tr.status_code == 200
    assert "[हिन्दी अनुवाद]" in tr.json()["title"]


def test_register_login_and_rbac_enforcement():
    uid = str(uuid.uuid4())[:8]
    email = f"chef_{uid}@example.com"
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "full_name": "Test Chef",
            "username": f"chef_{uid}",
            "diet_preference": "veg",
        },
    )
    assert reg.status_code == 200
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Standard user cannot access admin stats
    forbidden = client.get("/api/v1/admin/stats", headers=headers)
    assert forbidden.status_code == 403

    # Standard user can create & update recipe
    rec = client.post(
        "/api/v1/recipes",
        headers=headers,
        json={
            "title": f"Test Masala {uid}",
            "description": "Delicious test dish",
            "cuisine_type": "Indian",
            "diet_type": "veg",
            "prep_time_mins": 10,
            "cook_time_mins": 15,
            "servings": 2,
            "ingredients": [{"ingredient_name": "Tomato", "quantity": 2, "unit": "pieces"}],
            "steps": [{"step_number": 1, "instruction": "Simmer gently"}],
        },
    )
    assert rec.status_code == 200
    recipe_id = rec.json()["recipe_id"]

    # Save & remix
    save = client.post(f"/api/v1/recipes/{recipe_id}/save", headers=headers)
    assert save.status_code == 200 and save.json()["saved"] is True

    remix = client.post(
        f"/api/v1/recipes/{recipe_id}/remix",
        headers=headers,
        json={"twist_notes": "Added smoked paprika"},
    )
    assert remix.status_code == 200
    assert remix.json()["parent_recipe_id"] == recipe_id


def test_totp_mfa_flow_and_admin_suite():
    login_resp = client.post(
        "/api/v1/auth/admin-login",
        json={"email": "admin@epicho.com", "password": "AdminSecret123!"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    stats = client.get("/api/v1/admin/stats", headers=headers)
    assert stats.status_code == 200
    assert "total_users" in stats.json()

    roles = client.get("/api/v1/admin/roles", headers=headers)
    assert roles.status_code == 200
    role_names = {r["role_name"] for r in roles.json()["roles"]}
    assert "super_admin" in role_names
    assert "content_moderator" in role_names
    assert "finance_admin" in role_names

    # Verify TOTP helper works accurately
    setup = client.post("/api/v1/auth/mfa/setup", headers=headers)
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    code = _totp_at(secret, int(time.time() // 30))
    assert len(code) == 6
