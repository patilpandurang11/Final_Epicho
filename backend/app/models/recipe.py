import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Numeric, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import DietTypeEnum, DifficultyLevelEnum, ModerationStatusEnum, RecipeSourceEnum
from app.models.planning import Ingredient  # noqa: F401


class Recipe(Base):
    __tablename__ = "recipes"
    __table_args__ = {"schema": "public"}

    recipe_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    cuisine_type = Column(String, nullable=False, default="Indian")
    diet_type = Column(DietTypeEnum, nullable=False, default="veg")
    prep_time_mins = Column(Integer, default=15, nullable=False)
    cook_time_mins = Column(Integer, default=20, nullable=False)
    difficulty_level = Column(DifficultyLevelEnum, default="medium", nullable=False)
    recipe_source = Column(RecipeSourceEnum, default="user", nullable=False)
    servings = Column(Integer, default=2, nullable=False)
    equipment_required = Column(ARRAY(String), default=[], nullable=False)
    moderation_status = Column(ModerationStatusEnum, default="approved", nullable=False)
    is_ai_generated = Column(Boolean, default=False, nullable=False)
    is_premium = Column(Boolean, default=False, nullable=False)
    parent_recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="SET NULL"), nullable=True)
    view_count = Column(Integer, default=0, nullable=False)
    image_url = Column(String, default="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    author = relationship("UserAccount", back_populates="recipes")
    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")
    steps = relationship("RecipeStep", back_populates="recipe", cascade="all, delete-orphan", order_by="RecipeStep.step_number")
    nutrition = relationship("RecipeNutrition", back_populates="recipe", uselist=False, cascade="all, delete-orphan")
    reviews = relationship("RecipeReview", back_populates="recipe", cascade="all, delete-orphan")
    heritage = relationship("HeritageRecipe", back_populates="recipe", uselist=False, cascade="all, delete-orphan")
    versions = relationship("RecipeVersion", back_populates="recipe", cascade="all, delete-orphan", order_by="RecipeVersion.version_number.desc()")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"
    __table_args__ = {"schema": "public"}

    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), primary_key=True)
    ingredient_id = Column(UUID(as_uuid=True), ForeignKey("public.ingredients.ingredient_id"), primary_key=True)
    quantity = Column(Numeric(10, 3), nullable=False, default=1.0)
    unit = Column(String, nullable=False, default="cup")
    substitution_notes = Column(Text, nullable=True)

    recipe = relationship("Recipe", back_populates="ingredients")
    ingredient = relationship("Ingredient")

    @property
    def ingredient_name(self) -> str:
        return self.ingredient.name if self.ingredient else "Ingredient"


class RecipeStep(Base):
    __tablename__ = "recipe_steps"
    __table_args__ = {"schema": "public"}

    step_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), nullable=False)
    step_number = Column(Integer, nullable=False)
    instruction = Column(Text, nullable=False)
    duration_mins = Column(Integer, nullable=True)
    timer_seconds = Column(Integer, nullable=True)
    heat_level = Column(String, nullable=True)
    visual_cue = Column(Text, nullable=True)
    common_mistake = Column(Text, nullable=True)

    recipe = relationship("Recipe", back_populates="steps")

    @property
    def tip(self) -> str:
        return self.visual_cue or ""


class RecipeNutrition(Base):
    __tablename__ = "recipe_nutrition"
    __table_args__ = {"schema": "public"}

    nutrition_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), nullable=False, unique=True)
    calories = Column(Numeric(8, 2), nullable=False, default=0.0)
    protein_g = Column(Numeric(8, 2), nullable=False, default=0.0)
    carbs_g = Column(Numeric(8, 2), nullable=False, default=0.0)
    fat_g = Column(Numeric(8, 2), nullable=False, default=0.0)
    fiber_g = Column(Numeric(8, 2), default=0.0)
    sugar_g = Column(Numeric(8, 2), default=0.0)
    sodium_mg = Column(Numeric(8, 2), default=0.0)
    health_index = Column(Integer, default=85)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="SET NULL"), nullable=True)

    recipe = relationship("Recipe", back_populates="nutrition")

    @property
    def health_score(self) -> float:
        return float(self.health_index or 85)

    @property
    def data_source(self) -> str:
        return "EpiCho Nutrition Lab & USDA DB"


class RecipeReview(Base):
    __tablename__ = "recipe_reviews"
    __table_args__ = {"schema": "public"}

    review_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False, default=5)
    comment = Column(Text, nullable=True)
    verified_cooked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    recipe = relationship("Recipe", back_populates="reviews")
    user = relationship("UserAccount")


class RecipeVersion(Base):
    __tablename__ = "recipe_versions"
    __table_args__ = {"schema": "public"}

    version_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    edited_by = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="SET NULL"), nullable=True)
    change_summary = Column(Text, nullable=True)
    snapshot = Column(JSON, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    recipe = relationship("Recipe", back_populates="versions")


class HeritageRecipe(Base):
    __tablename__ = "heritage_recipes"
    __table_args__ = {"schema": "public"}

    heritage_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), nullable=False, unique=True)
    family_name = Column(String, nullable=False)
    region = Column(String, nullable=False)
    original_language = Column(String, nullable=False, default="Hindi")
    story_original = Column(Text, nullable=False)
    translations = Column(JSON, nullable=False, default={})
    colloquial_measurements = Column(JSON, nullable=False, default=[])
    story_media_url = Column(Text, nullable=True)
    is_family_verified = Column(Boolean, nullable=False, default=False)
    festival_collection = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    recipe = relationship("Recipe", back_populates="heritage")


class AIRequest(Base):
    __tablename__ = "ai_requests"
    __table_args__ = {"schema": "public"}

    request_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="SET NULL"), nullable=True)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="SET NULL"), nullable=True)
    request_type = Column(String, nullable=False, default="Full")
    prompt = Column(Text, nullable=False)
    macro_flavor_options = Column(JSON, nullable=False, default={})
    response_payload = Column(JSON, nullable=True)
    guest_identifier = Column(String, nullable=True)
    allergen_check_passed = Column(Boolean, nullable=False, default=True)
    latency_ms = Column(Integer, nullable=True)
    user_rating = Column(Integer, nullable=True)
    flagged_unsafe = Column(Boolean, nullable=False, default=False)
    unsafe_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
