import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import (
    ensure_owner_or_permission,
    get_current_user,
    get_user_role_names,
    require_permission,
)
from app.models.business import BusinessProfile, BusinessReview, MenuItem, Promotion
from app.models.user import UserAccount
from app.schemas.business import (
    BusinessProfileCreate,
    BusinessProfileResponse,
    BusinessReviewCreate,
    MenuItemCreate,
    MenuItemResponse,
    OwnerReplyRequest,
    PromotionCreate,
)

router = APIRouter(prefix="/restaurants", tags=["Restaurants & Businesses"])


def _serialize_biz(r: BusinessProfile) -> BusinessProfileResponse:
    menu_schemas = [
        MenuItemResponse(
            item_id=m.menu_item_id,
            name=m.dish_name,
            description=m.description,
            price=float(m.price),
            category="Signature",
            recipe_id=m.recipe_id,
            is_available=m.in_stock,
        )
        for m in r.menu_items
    ]
    return BusinessProfileResponse(
        business_id=r.business_id,
        owner_user_id=r.owner_user_id,
        business_name=r.business_name,
        business_type=r.business_type,
        address=r.address,
        latitude=float(r.latitude) if r.latitude else None,
        longitude=float(r.longitude) if r.longitude else None,
        cuisine_type=r.cuisine_type or "Pan-Indian & Gourmet",
        contact_info=r.contact_info or {"phone": "+91 98765 43210", "timings": "11:00 AM - 11:00 PM"},
        fssai_license_no=r.fssai_license_no or "10019022009876",
        verification_status=r.verification_status,
        menu_items=menu_schemas,
    )


@router.get("", response_model=List[BusinessProfileResponse])
def get_restaurants(
    city: Optional[str] = None,
    cuisine: Optional[str] = None,
    verified_only: bool = False,
    limit: int = Query(20, le=50),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(BusinessProfile)
    if city:
        query = query.filter(BusinessProfile.address.ilike(f"%{city}%"))
    if cuisine:
        query = query.filter(BusinessProfile.cuisine_type.ilike(f"%{cuisine}%"))
    if verified_only:
        query = query.filter(BusinessProfile.verification_status == "verified")

    restaurants = query.offset(offset).limit(limit).all()
    return [_serialize_biz(r) for r in restaurants]


@router.get("/my-business", response_model=BusinessProfileResponse)
def get_my_business(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    biz = db.query(BusinessProfile).filter(BusinessProfile.owner_user_id == current_user.user_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="No business profile found for this account.")
    return _serialize_biz(biz)


@router.post("", response_model=BusinessProfileResponse)
def create_or_update_business(
    req: BusinessProfileCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    biz = db.query(BusinessProfile).filter(BusinessProfile.owner_user_id == current_user.user_id).first()
    if biz:
        biz.business_name = req.business_name
        biz.business_type = req.business_type
        biz.address = req.address
        biz.cuisine_type = req.cuisine_type
        biz.contact_info = req.contact_info
        biz.fssai_license_no = req.fssai_license_no
    else:
        biz = BusinessProfile(
            owner_user_id=current_user.user_id,
            business_name=req.business_name,
            business_type=req.business_type,
            address=req.address,
            latitude=req.latitude,
            longitude=req.longitude,
            cuisine_type=req.cuisine_type,
            contact_info=req.contact_info,
            fssai_license_no=req.fssai_license_no,
            verification_status="pending",
        )
        db.add(biz)
    db.commit()
    db.refresh(biz)
    return _serialize_biz(biz)


@router.get("/{business_id}", response_model=BusinessProfileResponse)
def get_restaurant(business_id: uuid.UUID, db: Session = Depends(get_db)):
    r = db.query(BusinessProfile).filter(BusinessProfile.business_id == business_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    return _serialize_biz(r)


@router.post("/{business_id}/menu", response_model=MenuItemResponse)
def add_menu_item(
    business_id: uuid.UUID,
    req: MenuItemCreate,
    current_user: UserAccount = Depends(require_permission("business.manage_own")),
    db: Session = Depends(get_db),
):
    biz = db.query(BusinessProfile).filter(BusinessProfile.business_id == business_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")
    ensure_owner_or_permission(current_user, biz.owner_user_id, "user.manage", db)

    m = MenuItem(
        business_id=business_id,
        recipe_id=req.recipe_id,
        dish_name=req.name,
        description=req.description,
        price=req.price,
        in_stock=req.is_available,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return MenuItemResponse(
        item_id=m.menu_item_id,
        name=m.dish_name,
        description=m.description,
        price=float(m.price),
        category=req.category,
        recipe_id=m.recipe_id,
        is_available=m.in_stock,
    )


@router.get("/{business_id}/reviews")
def list_business_reviews(business_id: uuid.UUID, db: Session = Depends(get_db)):
    rows = (
        db.query(BusinessReview)
        .filter(BusinessReview.business_id == business_id)
        .order_by(desc(BusinessReview.created_at))
        .all()
    )
    return [
        {
            "review_id": str(rv.review_id),
            "author_name": rv.user.full_name if rv.user else "Diner",
            "rating": rv.rating,
            "review_text": rv.review_text,
            "owner_reply": rv.owner_reply,
            "is_critic_review": rv.is_critic_review,
            "created_at": rv.created_at,
        }
        for rv in rows
    ]


@router.post("/{business_id}/reviews")
def create_business_review(
    business_id: uuid.UUID,
    req: BusinessReviewCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.rating < 1 or req.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")
    roles = get_user_role_names(current_user, db)
    is_critic = "critic" in roles
    rv = BusinessReview(
        business_id=business_id,
        user_id=current_user.user_id,
        rating=req.rating,
        review_text=req.review_text,
        is_critic_review=is_critic,
    )
    db.add(rv)
    db.commit()
    db.refresh(rv)
    return {"message": "Review published.", "review_id": str(rv.review_id), "is_critic_review": is_critic}


@router.post("/reviews/{review_id}/reply")
def reply_to_review(
    review_id: uuid.UUID,
    req: OwnerReplyRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rv = db.query(BusinessReview).filter(BusinessReview.review_id == review_id).first()
    if not rv:
        raise HTTPException(status_code=404, detail="Review not found.")
    biz = db.query(BusinessProfile).filter(BusinessProfile.business_id == rv.business_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")
    ensure_owner_or_permission(current_user, biz.owner_user_id, "content.moderate", db)
    rv.owner_reply = req.owner_reply
    db.commit()
    return {"message": "Owner reply saved."}


@router.get("/{business_id}/promotions")
def list_promotions(business_id: uuid.UUID, db: Session = Depends(get_db)):
    promos = db.query(Promotion).filter(Promotion.business_id == business_id, Promotion.is_active.is_(True)).all()
    return [
        {
            "promotion_id": str(p.promotion_id),
            "title": p.title,
            "description": p.description,
            "promo_code": p.promo_code,
            "discount_percent": p.discount_percent,
        }
        for p in promos
    ]


@router.post("/{business_id}/promotions")
def create_promotion(
    business_id: uuid.UUID,
    req: PromotionCreate,
    current_user: UserAccount = Depends(require_permission("business.manage_own")),
    db: Session = Depends(get_db),
):
    biz = db.query(BusinessProfile).filter(BusinessProfile.business_id == business_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")
    ensure_owner_or_permission(current_user, biz.owner_user_id, "user.manage", db)
    promo = Promotion(
        business_id=business_id,
        title=req.title,
        description=req.description,
        promo_code=req.promo_code,
        discount_percent=req.discount_percent,
    )
    db.add(promo)
    db.commit()
    return {"message": "Promotion published.", "promotion_id": str(promo.promotion_id)}
