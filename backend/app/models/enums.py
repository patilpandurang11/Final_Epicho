from sqlalchemy.dialects.postgresql import ENUM

AccountTierEnum = ENUM(
    "guest", "registered", "premium", "creator", "business", "admin",
    name="account_tier", schema="public", create_type=False,
)
UserStatusEnum = ENUM(
    "active", "suspended", "deleted",
    name="user_status", schema="public", create_type=False,
)
DietTypeEnum = ENUM(
    "veg", "non_veg", "vegan", "eggetarian", "jain",
    name="diet_type", schema="public", create_type=False,
)
DifficultyLevelEnum = ENUM(
    "easy", "medium", "hard",
    name="difficulty_level", schema="public", create_type=False,
)
ModerationStatusEnum = ENUM(
    "pending", "approved", "flagged", "removed",
    name="moderation_status", schema="public", create_type=False,
)
RecipeSourceEnum = ENUM(
    "user", "creator", "business", "ai", "heritage",
    name="recipe_source", schema="public", create_type=False,
)
MealSlotTypeEnum = ENUM(
    "breakfast", "lunch", "snack", "dinner",
    name="meal_slot_type", schema="public", create_type=False,
)
FulfillmentStatusEnum = ENUM(
    "draft", "active", "partially_fulfilled", "completed",
    name="fulfillment_status", schema="public", create_type=False,
)
BusinessCategoryEnum = ENUM(
    "Restaurant", "Nutritionist", "CulinaryExpert",
    name="business_category", schema="public", create_type=False,
)
VerificationStatusEnum = ENUM(
    "pending", "verified", "rejected", "suspended",
    name="verification_status", schema="public", create_type=False,
)
RankingTargetTypeEnum = ENUM(
    "creator", "chef", "restaurant", "recipe", "critic",
    name="ranking_target_type", schema="public", create_type=False,
)
ReportTargetTypeEnum = ENUM(
    "recipe", "post", "comment", "user", "ai_output", "reel", "blog", "restaurant",
    name="report_target_type", schema="public", create_type=False,
)
NotificationTypeEnum = ENUM(
    "meal_reminder", "grocery_alert", "hidden_gem", "social", "system", "consultation", "subscription",
    name="notification_type", schema="public", create_type=False,
)
SubscriptionStatusEnum = ENUM(
    "active", "expired", "cancelled",
    name="subscription_status", schema="public", create_type=False,
)
PaymentStatusEnum = ENUM(
    "pending", "paid", "failed", "refunded",
    name="payment_status", schema="public", create_type=False,
)
