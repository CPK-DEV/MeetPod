from fastapi import APIRouter, Depends, status

from app.dependencies.auth import CurrentUser, current_user
from app.dependencies.permissions import require_meetup_participant
from app.models.meetup import Reminder, ReminderUpsert
from app.services.reminder_service import (
    delete_reminder, list_my_reminders, upsert_reminder,
)

router = APIRouter(prefix="/api/meetups/{mid}/reminders/me", tags=["reminders"])


@router.get("", response_model=list[Reminder])
def list_(mid: str, user: CurrentUser = Depends(current_user)) -> list[Reminder]:
    return list_my_reminders(user.id, meetup_id=mid)


@router.put("", response_model=Reminder)
def upsert(
    mid: str, body: ReminderUpsert,
    user: CurrentUser = Depends(current_user),
    _: None = require_meetup_participant(),
) -> Reminder:
    return upsert_reminder(user.id, mid, body.minutes_before)


@router.delete("/{minutes_before}", status_code=status.HTTP_204_NO_CONTENT)
def delete_(
    mid: str, minutes_before: int,
    user: CurrentUser = Depends(current_user),
    _: None = require_meetup_participant(),
) -> None:
    delete_reminder(user.id, mid, minutes_before)
