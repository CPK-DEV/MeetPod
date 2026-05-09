from datetime import timedelta

from fastapi import HTTPException, status

from app.models.meetup import Reminder
from app.utils.db import single
from app.utils.supabase_client import get_supabase


def list_my_reminders(user_id: str, meetup_id: str | None = None) -> list[Reminder]:
    sb = get_supabase()
    q = sb.table("meetup_reminders").select("*").eq("user_id", user_id)
    if meetup_id:
        q = q.eq("meetup_id", meetup_id)
    return [Reminder(**r) for r in (q.execute().data or [])]


def upsert_reminder(user_id: str, meetup_id: str, minutes_before: int) -> Reminder:
    sb = get_supabase()
    m = single(sb.table("meetups").select("starts_at").eq("id", meetup_id))
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "meetup not found")
    from datetime import datetime
    starts_at = datetime.fromisoformat(m["starts_at"].replace("Z", "+00:00"))
    notify_at = starts_at - timedelta(minutes=minutes_before)
    sb.table("meetup_reminders").upsert({
        "meetup_id": meetup_id,
        "user_id": user_id,
        "minutes_before": minutes_before,
        "notify_at": notify_at.isoformat(),
    }).execute()
    return Reminder(meetup_id=meetup_id, user_id=user_id,
                    minutes_before=minutes_before, notify_at=notify_at)


def delete_reminder(user_id: str, meetup_id: str, minutes_before: int) -> None:
    sb = get_supabase()
    sb.table("meetup_reminders").delete() \
        .eq("user_id", user_id).eq("meetup_id", meetup_id) \
        .eq("minutes_before", minutes_before).execute()
