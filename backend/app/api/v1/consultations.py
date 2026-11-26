import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import ensure_owner_or_permission, get_current_user
from app.core.security import decrypt_sensitive_text
from app.models.admin import Notification
from app.models.business import Consultation, NutritionistProfile
from app.models.user import UserAccount
from app.schemas.business import (
    ConsultationCreate,
    ConsultationResponse,
    ConsultationStatusUpdate,
    NutritionistProfileResponse,
)

router = APIRouter(prefix="/consultations", tags=["Nutritionist Consultations"])


@router.get("/nutritionists", response_model=List[NutritionistProfileResponse])
def get_nutritionists(db: Session = Depends(get_db)):
    profiles = db.query(NutritionistProfile).all()
    results = []
    for p in profiles:
        u = p.user
        results.append(
            NutritionistProfileResponse(
                nutritionist_id=p.nutritionist_id,
                user_id=p.user_id,
                full_name=u.full_name if u else "Certified Dietitian",
                credentials=p.credentials,
                specializations=p.specializations or ["Clinical Nutrition", "Metabolic Health"],
                consultation_fee=float(p.consultation_fee or 999.00),
                bio=p.bio or "Evidence-based personalized nutrition & culinary guidance.",
                is_verified=p.is_verified,
                avatar_url=u.avatar_url if u else None,
                availability_slots=p.availability_slots or ["Mon 10:00 AM", "Wed 04:00 PM"],
            )
        )
    return results


@router.post("/book", response_model=ConsultationResponse)
def book_consultation(
    req: ConsultationCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    nutritionist = db.query(UserAccount).filter(UserAccount.user_id == req.nutritionist_id).first()
    if not nutritionist:
        raise HTTPException(status_code=404, detail="Nutritionist not found.")

    prof = db.query(NutritionistProfile).filter(NutritionistProfile.user_id == req.nutritionist_id).first()
    fee = float(prof.consultation_fee or 999.00) if prof else 999.00
    meet_link = f"https://meet.jit.si/epicho-consult-{str(uuid.uuid4())[:8]}"

    consult = Consultation(
        client_id=current_user.user_id,
        nutritionist_id=req.nutritionist_id,
        appointment_time=req.appointment_time,
        duration_minutes=req.duration_minutes,
        consultation_notes=req.consultation_notes,
        share_health_data=req.share_health_data,
        fee_inr=fee,
        payment_status="paid",
        status="scheduled",
        meet_link=meet_link,
    )
    db.add(consult)
    db.add(
        Notification(
            user_id=req.nutritionist_id,
            type="consultation",
            title="New Consultation Booked",
            body=f"{current_user.full_name} booked a {req.duration_minutes}-min consultation.",
            action_url="/nutritionist/dashboard",
        )
    )
    db.commit()
    db.refresh(consult)

    return ConsultationResponse(
        consultation_id=consult.consultation_id,
        client_id=current_user.user_id,
        client_name=current_user.full_name,
        nutritionist_id=req.nutritionist_id,
        nutritionist_name=nutritionist.full_name,
        appointment_time=consult.appointment_time,
        duration_minutes=consult.duration_minutes,
        status=consult.status,
        fee_inr=float(consult.fee_inr),
        payment_status=consult.payment_status,
        share_health_data=consult.share_health_data,
        meet_link=consult.meet_link,
    )


@router.get("/my-appointments", response_model=List[ConsultationResponse])
def get_my_appointments(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consults = (
        db.query(Consultation)
        .filter(
            (Consultation.client_id == current_user.user_id)
            | (Consultation.nutritionist_id == current_user.user_id)
        )
        .order_by(Consultation.appointment_time.desc())
        .all()
    )

    results = []
    for c in consults:
        health_summary = None
        if c.share_health_data and c.client and c.client.profile and c.client.profile.health_data_consent:
            health_summary = {
                "diet_preference": c.client.profile.diet_preference,
                "allergies": decrypt_sensitive_text(c.client.profile.allergies_encrypted),
                "health_conditions": decrypt_sensitive_text(c.client.profile.health_conditions_encrypted),
            }
        results.append(
            ConsultationResponse(
                consultation_id=c.consultation_id,
                client_id=c.client_id,
                client_name=c.client.full_name if c.client else "Client",
                nutritionist_id=c.nutritionist_id,
                nutritionist_name=c.nutritionist.full_name if c.nutritionist else "Nutritionist",
                appointment_time=c.appointment_time,
                duration_minutes=c.duration_minutes,
                status=c.status,
                fee_inr=float(c.fee_inr),
                payment_status=c.payment_status,
                share_health_data=c.share_health_data,
                meet_link=c.meet_link,
                client_health_summary=health_summary,
            )
        )
    return results


@router.patch("/{consultation_id}/status")
def update_consultation_status(
    consultation_id: uuid.UUID,
    req: ConsultationStatusUpdate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = db.query(Consultation).filter(Consultation.consultation_id == consultation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found.")
    if current_user.user_id not in {c.client_id, c.nutritionist_id}:
        ensure_owner_or_permission(current_user, c.nutritionist_id, "user.manage", db)
    c.status = req.status
    db.commit()
    return {"message": f"Consultation updated to '{req.status}'."}
