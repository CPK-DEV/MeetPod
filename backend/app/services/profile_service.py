from fastapi import HTTPException, status

from app.models.profile import Profile
from app.utils.db import single
from app.utils.supabase_client import get_supabase


def get_profile(user_id: str) -> Profile | None:
    sb = get_supabase()
    row = single(sb.table("profiles").select("*").eq("id", user_id))
    return Profile(**row) if row else None


def upsert_profile_on_bootstrap(
    user_id: str, display_name: str, avatar_url: str | None
) -> Profile:
    sb = get_supabase()
    existing = get_profile(user_id)
    if existing:
        return existing
    payload = {"id": user_id, "display_name": display_name, "avatar_url": avatar_url}
    sb.table("profiles").insert(payload).execute()
    return Profile(**payload)


def set_handle(user_id: str, handle: str) -> Profile:
    sb = get_supabase()
    existing = get_profile(user_id)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "profile not found; bootstrap first")
    if existing.handle:
        raise HTTPException(status.HTTP_409_CONFLICT, "handle already set")

    # 중복 체크 (case-insensitive — DB unique index와 일관)
    dup = single(sb.table("profiles").select("id").ilike("handle", handle))
    if dup and dup["id"] != user_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "handle taken")

    sb.table("profiles").update({"handle": handle}).eq("id", user_id).execute()
    return existing.model_copy(update={"handle": handle})


def set_push_token(user_id: str, token: str | None) -> None:
    sb = get_supabase()
    sb.table("profiles").update({"expo_push_token": token}).eq("id", user_id).execute()
