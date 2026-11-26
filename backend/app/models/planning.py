import uuid
from datetime import datetime, date, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, Float, ForeignKey, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import FulfillmentStatusEnum, MealSlotTypeEnum

class Ingredient(Base):
    __tablename__ = "ingredients"
    __table_args__ = {"schema": "public"}

    ingredient_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False)
    category = Column(String, nullable=False)
    calories_per_unit = Column(Numeric(8, 2), default=0)
    standard_unit = Column(String, default="g", nullable=False)
    allergen_tags = Column(ARRAY(String), default=[])
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class MealPlan(Base):
    __tablename__ = "meal_plans"
    __table_args__ = {"schema": "public"}

    plan_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    plan_name = Column(String, nullable=False, default="Weekly Plan")
    week_start = Column(Date, nullable=False, default=date.today)
    start_date = Column(Date, nullable=False, default=date.today)
    end_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    items = relationship("MealPlanItem", back_populates="plan", cascade="all, delete-orphan")
    grocery_list = relationship("GroceryList", back_populates="plan", uselist=False, cascade="all, delete-orphan")

class MealPlanItem(Base):
    __tablename__ = "meal_plan_items"
    __table_args__ = {"schema": "public"}

    item_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("public.meal_plans.plan_id", ondelete="CASCADE"), nullable=False)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("public.recipes.recipe_id", ondelete="CASCADE"), nullable=False)
    meal_date = Column(Date, nullable=False)
    meal_type = Column(MealSlotTypeEnum, nullable=False)  # 'breakfast', 'lunch', 'dinner', 'snack'
    servings = Column(Integer, default=2, nullable=False)

    plan = relationship("MealPlan", back_populates="items")
    recipe = relationship("Recipe")

class GroceryList(Base):
    __tablename__ = "grocery_lists"
    __table_args__ = {"schema": "public"}

    list_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("public.meal_plans.plan_id", ondelete="CASCADE"), nullable=False, unique=True)
    fulfillment_status = Column(FulfillmentStatusEnum, default="draft", nullable=False)
    synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    plan = relationship("MealPlan", back_populates="grocery_list")
    items = relationship("GroceryListItem", back_populates="grocery_list", cascade="all, delete-orphan")

class GroceryListItem(Base):
    __tablename__ = "grocery_list_items"
    __table_args__ = {"schema": "public"}

    item_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    list_id = Column(UUID(as_uuid=True), ForeignKey("public.grocery_lists.list_id", ondelete="CASCADE"), nullable=False)
    ingredient_id = Column(UUID(as_uuid=True), ForeignKey("public.ingredients.ingredient_id"), nullable=False)
    quantity = Column(Numeric(10, 3), nullable=False)
    unit = Column(String, default="g", nullable=False)
    purchased = Column(Boolean, default=False, nullable=False)

    grocery_list = relationship("GroceryList", back_populates="items")
    ingredient = relationship("Ingredient")

class PantryItem(Base):
    __tablename__ = "pantry_items"
    __table_args__ = {"schema": "public"}

    pantry_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.user_accounts.user_id", ondelete="CASCADE"), nullable=False)
    ingredient_id = Column(UUID(as_uuid=True), ForeignKey("public.ingredients.ingredient_id"), nullable=False)
    quantity = Column(Numeric(10, 3), nullable=False)
    unit = Column(String, default="g", nullable=False)
    expiry_date = Column(Date, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    ingredient = relationship("Ingredient")
