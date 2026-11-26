import uuid
from typing import Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import get_current_user
from app.models.admin import Notification
from app.models.user import UserAccount, UserProfile

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
def list_notifications(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.user_id)
        .order_by(desc(Notification.created_at))
        .limit(50)
        .all()
    )
    unread_count = sum(1 for r in rows if not r.is_read)
    return {
        "unread_count": unread_count,
        "notifications": [
            {
                "notification_id": str(n.notification_id),
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "action_url": n.action_url,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in rows
        ],
    }


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: uuid.UUID,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = (
        db.query(Notification)
        .filter(Notification.notification_id == notification_id, Notification.user_id == current_user.user_id)
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found.")
    n.is_read = True
    db.commit()
    return {"is_read": True}


@router.post("/read-all")
def mark_all_read(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.user_id, Notification.is_read.is_(False)
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}


@router.get("/preferences")
def get_preferences(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prof = current_user.profile
    return prof.notification_preferences if prof else {"likes": True, "comments": True, "follows": True, "meal_reminders": True, "hidden_gems": True}


@router.put("/preferences")
def update_preferences(
    prefs: Dict[str, bool],
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prof = current_user.profile
    if not prof:
        prof = UserProfile(user_id=current_user.user_id)
        db.add(prof)
    prof.notification_preferences = prefs
    db.commit()
    return {"preferences": prof.notification_preferences}
