import uuid
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.ai import (
    AIKitchenGenerateRequest,
    AIKitchenRecipeResponse,
    IngredientInput,
)
from app.services.ai_kitchen import validate_and_sanitize_allergens
from app.core.database import SessionLocal
from app.models.recipe import AIRequest
from app.services.ai_providers import MockAIProvider, AIProviderError, get_ai_provider
from app.core.cache import cache


client = TestClient(app)


def register_user(monkeypatch, prefix: str):
    cache.delete("rl:auth_register:testclient")
    cache.delete("rl:auth_verify_email:testclient")
    cache.delete("rl:auth_login:testclient")
    emails = []
    monkeypatch.setattr(
        "app.api.v1.auth.send_action_email",
        lambda recipient, subject, url: emails.append(url),
    )
    suffix = uuid.uuid4().hex
    email = f"{prefix}_{suffix}@example.com"
    username = f"{prefix[:12]}_{suffix[:10]}"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "full_name": f"{prefix.title()} Tester",
            "username": username,
        },
    )
    assert response.status_code == 201, response.text
    token = parse_qs(urlparse(emails[-1]).query)["token"][0]
    assert client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 200
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "StrongPassword123!"},
    )
    assert login.status_code == 200, login.text
    return {
        "headers": {"Authorization": f"Bearer {login.json()['access_token']}"},
        "user": login.json()["user"],
        "username": username,
    }


def test_private_profile_follow_approval_and_verified_recipe_review(monkeypatch):
    owner = register_user(monkeypatch, "owner")
    follower = register_user(monkeypatch, "follower")

    created = client.post(
        "/api/v1/recipes",
        headers=owner["headers"],
        json={
            "title": f"Private recipe {uuid.uuid4().hex[:8]}",
            "ingredients": [{"ingredient_name": "Tomato", "quantity": 2, "unit": "pieces"}],
            "steps": [{"step_number": 1, "instruction": "Cook gently."}],
        },
    )
    assert created.status_code == 200, created.text
    recipe = created.json()

    private = client.put(
        "/api/v1/auth/me",
        headers=owner["headers"],
        json={"is_private": True},
    )
    assert private.status_code == 200
    assert private.json()["profile"]["is_private"] is True

    public_profile = client.get(f"/api/v1/posts/profile/{owner['username']}")
    assert public_profile.status_code == 200
    assert public_profile.json()["can_view_content"] is False
    assert public_profile.json()["recipes"] == []
    assert public_profile.json()["bio"] is None
    assert public_profile.json()["website_url"] is None
    assert client.get(f"/api/v1/recipes/{recipe['recipe_id']}").status_code == 404

    follow = client.post(
        f"/api/v1/posts/follow/{owner['user']['user_id']}",
        headers=follower["headers"],
    )
    assert follow.status_code == 200
    assert follow.json() == {"following": False, "requested": True}
    pending = client.get("/api/v1/posts/follow-requests", headers=owner["headers"])
    assert pending.status_code == 200
    assert pending.json()[0]["user_id"] == follower["user"]["user_id"]

    accepted = client.post(
        f"/api/v1/posts/follow-requests/{follower['user']['user_id']}/accept",
        headers=owner["headers"],
    )
    assert accepted.status_code == 200
    assert client.get(
        f"/api/v1/recipes/{recipe['recipe_id']}", headers=follower["headers"]
    ).status_code == 200
    recipe_comment = client.post(
        f"/api/v1/recipes/{recipe['recipe_id']}/comments",
        headers=follower["headers"],
        json={"content": "Can I use fresh herbs?"},
    )
    assert recipe_comment.status_code == 200
    recipe_reply = client.post(
        f"/api/v1/recipes/{recipe['recipe_id']}/comments",
        headers=owner["headers"],
        json={
            "content": "Absolutely.",
            "parent_comment_id": recipe_comment.json()["comment_id"],
        },
    )
    assert recipe_reply.status_code == 200
    assert recipe_reply.json()["parent_comment_id"] == recipe_comment.json()["comment_id"]

    cooked_post = client.post(
        "/api/v1/posts",
        headers=follower["headers"],
        json={
            "recipe_id": recipe["recipe_id"],
            "caption": "Cooked it!",
            "is_cooked_this": True,
            "media": [{"media_url": "https://example.test/dish.jpg", "media_type": "image"}],
        },
    )
    assert cooked_post.status_code == 200, cooked_post.text
    post_id = cooked_post.json()["post_id"]
    first_like = client.put(
        f"/api/v1/posts/{post_id}/like", headers=owner["headers"]
    ).json()
    second_like = client.put(
        f"/api/v1/posts/{post_id}/like", headers=owner["headers"]
    ).json()
    assert first_like["likes_count"] == second_like["likes_count"]
    assert client.delete(
        f"/api/v1/posts/{post_id}/like", headers=owner["headers"]
    ).json()["liked"] is False

    parent = client.post(
        f"/api/v1/posts/{post_id}/comments",
        headers=owner["headers"],
        json={"content": "Nice!"},
    )
    assert parent.status_code == 200
    reply = client.post(
        f"/api/v1/posts/{post_id}/comments",
        headers=follower["headers"],
        json={"content": "Thank you!", "parent_comment_id": parent.json()["comment_id"]},
    )
    assert reply.status_code == 200
    assert reply.json()["parent_comment_id"] == parent.json()["comment_id"]
    assert len(client.get(f"/api/v1/posts/{post_id}/comments").json()) == 2
    edited = client.patch(
        f"/api/v1/posts/comments/{parent.json()['comment_id']}",
        headers=owner["headers"],
        json={"content": "Updated comment"},
    )
    assert edited.status_code == 200
    assert edited.json()["content"] == "Updated comment"
    assert client.delete(
        f"/api/v1/posts/comments/{reply.json()['comment_id']}",
        headers=follower["headers"],
    ).status_code == 200

    review = client.post(
        f"/api/v1/recipes/{recipe['recipe_id']}/reviews",
        headers=follower["headers"],
        json={"rating": 4, "review_text": "Great."},
    )
    assert review.status_code == 200
    first_review_id = review.json()["review_id"]
    updated = client.post(
        f"/api/v1/recipes/{recipe['recipe_id']}/reviews",
        headers=follower["headers"],
        json={"rating": 5, "review_text": "Excellent."},
    )
    assert updated.json()["review_id"] == first_review_id
    reviews = client.get(
        f"/api/v1/recipes/{recipe['recipe_id']}/reviews",
        headers=follower["headers"],
    ).json()
    assert len(reviews) == 1
    assert reviews[0]["verified_cooked"] is True
    assert reviews[0]["rating"] == 5


def test_ai_generation_validation_and_allergen_guard():
    with pytest.raises(ValueError):
        AIKitchenGenerateRequest(ingredients=[], servings=0)

    safe, warnings, _, _ = validate_and_sanitize_allergens(
        [IngredientInput(name="Eggplant")], ["eggs"]
    )
    assert safe[0].name == "Eggplant"
    assert warnings == []

    sanitized, warnings, _, _ = validate_and_sanitize_allergens(
        [IngredientInput(name="Egg", quantity=1, unit="piece")], ["eggs"]
    )
    assert warnings
    assert "egg" not in sanitized[0].name.lower()


def test_profile_fields_post_saves_and_recipe_publication(monkeypatch):
    author = register_user(monkeypatch, "publisher")
    viewer = register_user(monkeypatch, "reader")
    profile = client.put(
        "/api/v1/auth/me",
        headers=author["headers"],
        json={
            "cover_image_url": "https://example.test/cover.jpg",
            "cuisine_interests": ["Indian", "Italian"],
            "website_url": "https://example.test",
            "social_links": {"Instagram": "https://example.test/creator"},
        },
    )
    assert profile.status_code == 200, profile.text
    public_profile = client.get(f"/api/v1/posts/profile/{author['username']}")
    assert public_profile.json()["cuisine_interests"] == ["Indian", "Italian"]
    assert public_profile.json()["cover_image_url"] == "https://example.test/cover.jpg"

    created_post = client.post(
        "/api/v1/posts",
        headers=author["headers"],
        json={"caption": "A simple kitchen update."},
    )
    assert created_post.status_code == 200, created_post.text
    post_id = created_post.json()["post_id"]
    assert client.get(f"/api/v1/posts/{post_id}").status_code == 200
    shared = client.post(f"/api/v1/posts/{post_id}/share")
    assert shared.status_code == 200
    assert shared.json()["shares_count"] == 1
    assert client.post(
        f"/api/v1/posts/{post_id}/save", headers=viewer["headers"]
    ).json()["saved"] is True
    saved = client.get("/api/v1/posts/saved", headers=viewer["headers"])
    assert [item["post_id"] for item in saved.json()] == [post_id]
    assert client.delete(
        f"/api/v1/posts/{post_id}/save", headers=viewer["headers"]
    ).json()["saved"] is False
    assert client.get("/api/v1/posts/saved", headers=viewer["headers"]).json() == []

    draft = client.post(
        "/api/v1/recipes",
        headers=author["headers"],
        json={
            "title": f"Unpublished recipe {uuid.uuid4().hex[:8]}",
            "category": "Breakfast",
            "is_published": False,
            "allergen_tags": ["sesame"],
            "ingredients": [{"ingredient_name": "Oats", "quantity": 1, "unit": "cup"}],
            "steps": [{"step_number": 1, "instruction": "Cook until soft."}],
        },
    )
    assert draft.status_code == 200, draft.text
    assert draft.json()["category"] == "Breakfast"
    assert client.get(
        f"/api/v1/recipes/{draft.json()['recipe_id']}", headers=viewer["headers"]
    ).status_code == 404
    assert client.get(
        f"/api/v1/recipes/{draft.json()['recipe_id']}", headers=author["headers"]
    ).status_code == 200
    assert all(
        item["recipe_id"] != draft.json()["recipe_id"]
        for item in client.get("/api/v1/recipes", headers=viewer["headers"]).json()
    )


def test_ai_history_quota_and_allergy_privacy(monkeypatch):
    user = register_user(monkeypatch, "chef")
    headers = user["headers"]
    profile = client.put(
        "/api/v1/auth/me",
        headers=headers,
        json={"allergies": ["peanuts"]},
    )
    assert profile.status_code == 200

    generated = client.post(
        "/api/v1/ai-kitchen/generate",
        headers=headers,
        json={"ingredients": ["Peanut", "Tomato"], "allergies": []},
    )
    assert generated.status_code == 200, generated.text
    data = generated.json()
    assert all("peanut" not in item["name"].lower() for item in data["ingredients"])
    assert data["request_id"]

    with SessionLocal() as db:
        history_record = db.query(AIRequest).filter(
            AIRequest.request_id == data["request_id"]
        ).one()
        assert "allergies" not in history_record.macro_flavor_options
        assert history_record.macro_flavor_options["allergen_count"] == 1
        assert history_record.allergen_check_passed is True
        assert history_record.response_payload["request_id"] == data["request_id"]

    history = client.get("/api/v1/ai-kitchen/history", headers=headers)
    assert history.status_code == 200
    assert history.json()[0]["request_id"] == data["request_id"]
    quota = client.get("/api/v1/ai-kitchen/quota", headers=headers).json()
    assert quota["used_today"] == 1

    other_user = register_user(monkeypatch, "other")
    unauthorized = client.delete(
        f"/api/v1/ai-kitchen/history/{data['request_id']}",
        headers=other_user["headers"],
    )
    assert unauthorized.status_code == 404
    deleted = client.delete(
        f"/api/v1/ai-kitchen/history/{data['request_id']}",
        headers=headers,
    )
    assert deleted.status_code == 200
    with SessionLocal() as db:
        retained = db.query(AIRequest).filter(
            AIRequest.request_id == data["request_id"]
        ).one()
        assert retained.history_deleted_at is not None
    assert client.get("/api/v1/ai-kitchen/quota", headers=headers).json()["used_today"] == 1


def test_ai_generation_respects_excluded_ingredients():
    response = client.post(
        "/api/v1/ai-kitchen/generate",
        json={
            "ingredients": ["Paneer", "Tomato"],
            "excluded_ingredients": ["paneer"],
            "dish_type": "Lunch",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["category"] == "Lunch"
    assert all("paneer" not in item["name"].casefold() for item in body["ingredients"])
    assert all(
        "paneer" not in step["instruction"].casefold() for step in body["steps"]
    )


def test_recommendations_follow_lists_collections_and_serving_adjustment(monkeypatch):
    owner = register_user(monkeypatch, "recommend_owner")
    follower = register_user(monkeypatch, "recommend_follower")

    post = client.post(
        "/api/v1/posts",
        headers=owner["headers"],
        json={
            "caption": "Recommended Indian tomato dish",
            "dish_name": "Tomato Curry",
            "hashtags": ["Indian", "tomato"],
            "is_cooked_this": False,
        },
    )
    assert post.status_code == 200, post.text
    post_id = post.json()["post_id"]

    follow = client.post(
        f"/api/v1/posts/follow/{owner['user']['user_id']}",
        headers=follower["headers"],
    )
    assert follow.status_code == 200
    assert follow.json()["following"] is True

    recommendations = client.get(
        "/api/v1/posts?sort=recommended&limit=20&offset=0",
        headers=follower["headers"],
    )
    assert recommendations.status_code == 200
    assert any(item["post_id"] == post_id for item in recommendations.json())

    followers = client.get(
        f"/api/v1/posts/followers/{owner['user']['user_id']}?limit=20&offset=0",
        headers=follower["headers"],
    )
    assert followers.status_code == 200
    assert followers.json()[0]["user_id"] == follower["user"]["user_id"]

    following = client.get(
        f"/api/v1/posts/following/{follower['user']['user_id']}?limit=20&offset=0",
        headers=follower["headers"],
    )
    assert following.status_code == 200
    assert following.json()[0]["user_id"] == owner["user"]["user_id"]

    first_collection = client.post(
        "/api/v1/posts/collections",
        headers=follower["headers"],
        json={"name": "Weeknight Favorites", "description": "Fast recipes"},
    )
    assert first_collection.status_code == 201, first_collection.text
    collection_id = first_collection.json()["collection_id"]

    duplicate_collection = client.post(
        "/api/v1/posts/collections",
        headers=follower["headers"],
        json={"name": "Weeknight Favorites"},
    )
    assert duplicate_collection.status_code == 409

    renamed = client.patch(
        f"/api/v1/posts/collections/{collection_id}",
        headers=follower["headers"],
        json={"name": "Family Favorites"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Family Favorites"

    item = client.post(
        f"/api/v1/posts/collections/{collection_id}/items",
        headers=follower["headers"],
        json={"post_id": post_id},
    )
    assert item.status_code == 200
    duplicate_item = client.post(
        f"/api/v1/posts/collections/{collection_id}/items",
        headers=follower["headers"],
        json={"post_id": post_id},
    )
    assert duplicate_item.status_code == 200
    assert duplicate_item.json()["already_saved"] is True

    items = client.get(
        f"/api/v1/posts/collections/{collection_id}/items",
        headers=follower["headers"],
    )
    assert items.status_code == 200
    assert len(items.json()) == 1
    unauthorized_item_read = client.get(
        f"/api/v1/posts/collections/{collection_id}/items",
        headers=owner["headers"],
    )
    unauthorized_item_add = client.post(
        f"/api/v1/posts/collections/{collection_id}/items",
        headers=owner["headers"],
        json={"post_id": post_id},
    )
    unauthorized_item_remove = client.delete(
        f"/api/v1/posts/collections/{collection_id}/items/{items.json()[0]['item_id']}",
        headers=owner["headers"],
    )
    assert unauthorized_item_read.status_code == 404
    assert unauthorized_item_add.status_code == 404
    assert unauthorized_item_remove.status_code == 404
    removed = client.delete(
        f"/api/v1/posts/collections/{collection_id}/items/{items.json()[0]['item_id']}",
        headers=follower["headers"],
    )
    assert removed.status_code == 200
    deleted = client.delete(
        f"/api/v1/posts/collections/{collection_id}",
        headers=owner["headers"],
    )
    assert deleted.status_code == 404

    other_owner = register_user(monkeypatch, "collection_intruder")
    unauthorized = client.patch(
        f"/api/v1/posts/collections/{collection_id}",
        headers=other_owner["headers"],
        json={"name": "Not yours"},
    )
    assert unauthorized.status_code == 404
    deleted = client.delete(
        f"/api/v1/posts/collections/{collection_id}",
        headers=follower["headers"],
    )
    assert deleted.status_code == 200

    recipe = client.post(
        "/api/v1/recipes",
        headers=owner["headers"],
        json={
            "title": "Scaling Test Curry",
            "cuisine_type": "Indian",
            "servings": 4,
            "ingredients": [
                {"ingredient_name": "Tomato", "quantity": 2, "unit": "cups"},
                {"ingredient_name": "Rice", "quantity": 3, "unit": "cups"},
            ],
            "steps": [{"step_number": 1, "instruction": "Cook and serve."}],
        },
    )
    assert recipe.status_code == 200, recipe.text
    recipe_id = recipe.json()["recipe_id"]

    for target_servings, expected in ((2, [1.0, 1.5]), (6, [3.0, 4.5])):
        adjusted = client.get(
            f"/api/v1/recipes/{recipe_id}/adjust-servings",
            params={"servings": target_servings},
        )
        assert adjusted.status_code == 200
        quantities = [item["quantity"] for item in adjusted.json()["ingredients"]]
        assert quantities == expected
        assert adjusted.json()["quantity_disclaimer"]


def test_recommendations_support_interest_signals_and_empty_history_pagination(monkeypatch):
    author = register_user(monkeypatch, "interest_author")
    reader = register_user(monkeypatch, "interest_reader")

    updated_profile = client.put(
        "/api/v1/auth/me",
        headers=reader["headers"],
        json={"cuisine_interests": ["Thai"]},
    )
    assert updated_profile.status_code == 200, updated_profile.text

    thai_post = client.post(
        "/api/v1/posts",
        headers=author["headers"],
        json={
            "caption": "A Thai-inspired supper",
            "dish_name": "Noodles",
            "hashtags": ["THAI"],
        },
    )
    unrelated_post = client.post(
        "/api/v1/posts",
        headers=author["headers"],
        json={
            "caption": "A classic Italian supper",
            "dish_name": "Italian Pasta",
            "hashtags": ["Italian"],
        },
    )
    assert thai_post.status_code == 200, thai_post.text
    assert unrelated_post.status_code == 200, unrelated_post.text

    recommended = client.get(
        "/api/v1/posts?sort=recommended&limit=1&offset=0",
        headers=reader["headers"],
    )
    assert recommended.status_code == 200, recommended.text
    assert recommended.json()[0]["post_id"] == thai_post.json()["post_id"]

    no_interest_user = register_user(monkeypatch, "empty_interest")
    first_page = client.get(
        "/api/v1/posts?sort=recommended&limit=1&offset=0",
        headers=no_interest_user["headers"],
    )
    repeated_first_page = client.get(
        "/api/v1/posts?sort=recommended&limit=1&offset=0",
        headers=no_interest_user["headers"],
    )
    second_page = client.get(
        "/api/v1/posts?sort=recommended&limit=1&offset=1",
        headers=no_interest_user["headers"],
    )
    assert first_page.status_code == 200, first_page.text
    assert repeated_first_page.status_code == 200, repeated_first_page.text
    assert second_page.status_code == 200, second_page.text
    assert first_page.json()[0]["post_id"] == repeated_first_page.json()[0]["post_id"]
    assert first_page.json()[0]["post_id"] != second_page.json()[0]["post_id"]


def test_review_feedback_is_unique_and_cannot_be_self_manipulated(monkeypatch):
    author = register_user(monkeypatch, "review_author")
    reviewer = register_user(monkeypatch, "reviewer")
    voter = register_user(monkeypatch, "review_voter")

    recipe = client.post(
        "/api/v1/recipes",
        headers=author["headers"],
        json={
            "title": "Helpful Review Recipe",
            "ingredients": [{"ingredient_name": "Beans", "quantity": 1, "unit": "cup"}],
            "steps": [{"step_number": 1, "instruction": "Cook beans."}],
        },
    )
    assert recipe.status_code == 200
    recipe_id = recipe.json()["recipe_id"]
    review = client.post(
        f"/api/v1/recipes/{recipe_id}/reviews",
        headers=reviewer["headers"],
        json={"rating": 5, "review_text": "Excellent texture."},
    )
    assert review.status_code == 200
    review_id = review.json()["review_id"]

    first = client.post(
        f"/api/v1/recipes/{recipe_id}/reviews/{review_id}/feedback",
        headers=voter["headers"],
        params={"helpful": True},
    )
    assert first.status_code == 200
    assert first.json()["helpful_count"] == 1

    repeated = client.post(
        f"/api/v1/recipes/{recipe_id}/reviews/{review_id}/feedback",
        headers=voter["headers"],
        params={"helpful": True},
    )
    assert repeated.status_code == 200
    assert repeated.json()["helpful_count"] == 0

    changed = client.post(
        f"/api/v1/recipes/{recipe_id}/reviews/{review_id}/feedback",
        headers=voter["headers"],
        params={"helpful": True},
    )
    assert changed.json()["helpful_count"] == 1
    opposite = client.post(
        f"/api/v1/recipes/{recipe_id}/reviews/{review_id}/feedback",
        headers=voter["headers"],
        params={"helpful": False},
    )
    assert opposite.json()["helpful_count"] == 0
    assert opposite.json()["unhelpful_count"] == 1

    self_vote = client.post(
        f"/api/v1/recipes/{recipe_id}/reviews/{review_id}/feedback",
        headers=reviewer["headers"],
        params={"helpful": True},
    )
    assert self_vote.status_code == 403

    report = client.post(
        f"/api/v1/recipes/{recipe_id}/reviews/{review_id}/report",
        headers=voter["headers"],
        params={"reason": "This review contains abusive content."},
    )
    assert report.status_code == 200


@pytest.mark.asyncio
async def test_mock_ai_provider_interface_without_real_api(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "mock")
    provider = get_ai_provider("mock")
    assert isinstance(provider, MockAIProvider)
    request = AIKitchenGenerateRequest(
        ingredients=["Tomato", "Paneer"],
        excluded_ingredients=["Paneer"],
        cuisine_preference="Indian",
        dish_type="Lunch",
        servings=2,
    )
    result = await provider.generate(request)
    assert isinstance(result, AIKitchenRecipeResponse)
    assert result.category == "Lunch"
    assert all("paneer" not in item.name.casefold() for item in result.ingredients)
    assert result.ai_provider == "EpiCho Mock Provider"

    try:
        get_ai_provider("unsupported-provider")
    except AIProviderError:
        pass
    else:
        raise AssertionError("Unsupported providers must raise an explicit error.")
