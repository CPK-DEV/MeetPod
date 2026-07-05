from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.models.meetup import (
    Meetup, MeetupCreate, MeetupUpdate, Participant,
)
from app.utils.db import single
from app.utils.supabase_client import get_supabase


def _row_to_meetup(row: dict, my_status: str | None = None) -> Meetup:
    return Meetup(**row, my_status=my_status)


def create_meetup(creator_id: str, body: MeetupCreate) -> Meetup:
    sb = get_supabase()

    # 그룹 약속이면 creator는 멤버여야 함, 참여자는 모두 멤버여야 함
    if body.group_id:
        member = single(sb.table("group_members").select("user_id")
                        .eq("group_id", body.group_id).eq("user_id", creator_id))
        if not member:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not a group member")

        member_rows = sb.table("group_members").select("user_id") \
            .eq("group_id", body.group_id).execute().data or []
        member_ids = {r["user_id"] for r in member_rows}
        invalid = [uid for uid in body.participant_ids if uid not in member_ids]
        if invalid:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"non-member participants: {invalid}")

    # 항상 creator 포함
    participant_ids = list({creator_id, *body.participant_ids})

    payload = {
        "group_id": body.group_id,
        "creator_id": creator_id,
        "title": body.title,
        "starts_at": body.starts_at.isoformat(),
        "ends_at": body.ends_at.isoformat(),
        "place_name": body.place.name,
        "place_lat": body.place.lat,
        "place_lng": body.place.lng,
        "place_address": body.place.address,
        "place_google_id": body.place.google_id,
        "location_share_minutes_before": body.location_share_minutes_before,
        "status": "scheduled",
    }
    row = sb.table("meetups").insert(payload).execute().data[0]
    mid = row["id"]

    sb.table("meetup_participants").insert(
        [{"meetup_id": mid, "user_id": uid, "status": "going" if uid == creator_id else "pending"}
         for uid in participant_ids]
    ).execute()

    sb.table("chat_rooms").insert({"kind": "meetup", "ref_id": mid}).execute()

    if body.self_reminder_minutes_before is not None:
        notify_at = body.starts_at - timedelta(minutes=body.self_reminder_minutes_before)
        sb.table("meetup_reminders").insert({
            "meetup_id": mid,
            "user_id": creator_id,
            "minutes_before": body.self_reminder_minutes_before,
            "notify_at": notify_at.isoformat(),
        }).execute()

    return _row_to_meetup(row)


def get_meetup(meetup_id: str) -> Meetup:
    sb = get_supabase()
    row = single(sb.table("meetups").select("*").eq("id", meetup_id))
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "meetup not found")
    return _row_to_meetup(row)


def list_my_meetups(user_id: str, include_ended: bool = False) -> list[Meetup]:
    sb = get_supabase()
    parts = sb.table("meetup_participants").select("meetup_id, status").eq("user_id", user_id).execute().data or []
    status_by_id = {p["meetup_id"]: p["status"] for p in parts}
    if not status_by_id:
        return []
    q = sb.table("meetups").select("*").in_("id", list(status_by_id.keys())).order("starts_at", desc=False)
    if not include_ended:
        q = q.in_("status", ["scheduled", "active"])
    rows = q.execute().data or []
    return [_row_to_meetup(r, status_by_id.get(r["id"])) for r in rows]


def update_meetup(meetup_id: str, body: MeetupUpdate) -> Meetup:
    sb = get_supabase()
    patch: dict = {}
    if body.title is not None: patch["title"] = body.title
    if body.starts_at is not None: patch["starts_at"] = body.starts_at.isoformat()
    if body.ends_at is not None: patch["ends_at"] = body.ends_at.isoformat()
    if body.location_share_minutes_before is not None:
        patch["location_share_minutes_before"] = body.location_share_minutes_before
    if body.place is not None:
        patch.update({
            "place_name": body.place.name,
            "place_lat": body.place.lat,
            "place_lng": body.place.lng,
            "place_address": body.place.address,
            "place_google_id": body.place.google_id,
        })
    if patch:
        sb.table("meetups").update(patch).eq("id", meetup_id).execute()

    # starts_at 변경 시 notify_at 재계산 (모든 user_id의 reminders)
    if body.starts_at is not None:
        rems = sb.table("meetup_reminders").select("user_id, minutes_before") \
            .eq("meetup_id", meetup_id).execute().data or []
        for r in rems:
            new_at = body.starts_at - timedelta(minutes=r["minutes_before"])
            sb.table("meetup_reminders").update({"notify_at": new_at.isoformat()}) \
                .eq("meetup_id", meetup_id).eq("user_id", r["user_id"]) \
                .eq("minutes_before", r["minutes_before"]).execute()

    return get_meetup(meetup_id)


def cancel_meetup(meetup_id: str) -> Meetup:
    sb = get_supabase()
    sb.table("meetups").update({"status": "cancelled"}).eq("id", meetup_id).execute()
    sb.table("meetup_reminders").delete().eq("meetup_id", meetup_id).execute()
    return get_meetup(meetup_id)


def respond_to_meetup(meetup_id: str, user_id: str, rsvp_status: str) -> None:
    sb = get_supabase()
    sb.table("meetup_participants").update({"status": rsvp_status}) \
        .eq("meetup_id", meetup_id).eq("user_id", user_id).execute()


def list_participants(meetup_id: str) -> list[Participant]:
    sb = get_supabase()
    rows = sb.table("meetup_participants").select("user_id, status, joined_at") \
        .eq("meetup_id", meetup_id).execute().data or []
    if not rows:
        return []
    profiles = sb.table("profiles").select("id, display_name, handle") \
        .in_("id", [r["user_id"] for r in rows]).execute().data or []
    profile_by_id = {p["id"]: p for p in profiles}
    return [
        Participant(
            **r,
            display_name=profile_by_id.get(r["user_id"], {}).get("display_name"),
            handle=profile_by_id.get(r["user_id"], {}).get("handle"),
        )
        for r in rows
    ]


def add_participants(meetup_id: str, user_ids: list[str]) -> None:
    sb = get_supabase()
    if not user_ids:
        return
    rows = [{"meetup_id": meetup_id, "user_id": uid} for uid in user_ids]
    sb.table("meetup_participants").upsert(rows).execute()


def remove_participant(meetup_id: str, user_id: str) -> None:
    sb = get_supabase()
    sb.table("meetup_participants").delete() \
        .eq("meetup_id", meetup_id).eq("user_id", user_id).execute()
    sb.table("meetup_reminders").delete() \
        .eq("meetup_id", meetup_id).eq("user_id", user_id).execute()
