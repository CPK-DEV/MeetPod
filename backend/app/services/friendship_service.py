from app.models.friendship import FriendSummary
from app.utils.supabase_client import get_supabase


def list_friends(user_id: str) -> list[FriendSummary]:
    sb = get_supabase()
    rows = sb.table("friendships").select("user_a_id, user_b_id") \
        .or_(f"user_a_id.eq.{user_id},user_b_id.eq.{user_id}").execute().data or []

    other_ids = [r["user_b_id"] if r["user_a_id"] == user_id else r["user_a_id"] for r in rows]
    if not other_ids:
        return []
    profiles = sb.table("profiles").select("id, handle, display_name, avatar_url") \
        .in_("id", other_ids).execute().data or []
    return [FriendSummary(**p) for p in profiles]
