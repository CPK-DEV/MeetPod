from fastapi import HTTPException, status

from app.models.group import Group, GroupCreate, GroupMember, GroupUpdate
from app.utils.db import single
from app.utils.supabase_client import get_supabase


def create_group(creator_id: str, body: GroupCreate) -> Group:
    sb = get_supabase()
    payload = body.model_dump()
    payload["owner_id"] = creator_id
    row = sb.table("groups").insert(payload).execute().data[0]
    sb.table("group_members").insert(
        {"group_id": row["id"], "user_id": creator_id, "role": "owner"}
    ).execute()
    sb.table("chat_rooms").insert({"kind": "group", "ref_id": row["id"]}).execute()
    return Group(**row)


def list_my_groups(user_id: str) -> list[Group]:
    sb = get_supabase()
    member_rows = sb.table("group_members").select("group_id").eq("user_id", user_id).execute().data or []
    gids = [r["group_id"] for r in member_rows]
    if not gids:
        return []
    rows = sb.table("groups").select("*").in_("id", gids).execute().data or []
    return [Group(**r) for r in rows]


def get_group(group_id: str) -> Group:
    sb = get_supabase()
    row = single(sb.table("groups").select("*").eq("id", group_id))
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "group not found")
    return Group(**row)


def update_group(group_id: str, body: GroupUpdate) -> Group:
    sb = get_supabase()
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if patch:
        sb.table("groups").update(patch).eq("id", group_id).execute()
    return get_group(group_id)


def list_members(group_id: str) -> list[GroupMember]:
    sb = get_supabase()
    rows = sb.table("group_members").select("user_id, role").eq("group_id", group_id).execute().data or []
    return [GroupMember(**r) for r in rows]


def set_role(group_id: str, user_id: str, role: str) -> None:
    sb = get_supabase()
    target = single(sb.table("group_members").select("role").eq("group_id", group_id).eq("user_id", user_id))
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    if target["role"] == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot change owner role; use transfer")
    sb.table("group_members").update({"role": role}).eq("group_id", group_id).eq("user_id", user_id).execute()


def transfer_owner(group_id: str, current_owner_id: str, new_owner_id: str) -> None:
    sb = get_supabase()
    new_member = single(sb.table("group_members").select("role").eq("group_id", group_id).eq("user_id", new_owner_id))
    if not new_member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "new owner is not a member")
    if new_owner_id == current_owner_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "already owner")
    # 단일 owner unique 인덱스 회피: 기존 owner를 admin으로 먼저 격하
    sb.table("group_members").update({"role": "admin"}) \
        .eq("group_id", group_id).eq("user_id", current_owner_id).execute()
    sb.table("group_members").update({"role": "owner"}) \
        .eq("group_id", group_id).eq("user_id", new_owner_id).execute()
    sb.table("groups").update({"owner_id": new_owner_id}).eq("id", group_id).execute()


def remove_member(group_id: str, target_user_id: str) -> None:
    sb = get_supabase()
    target = single(sb.table("group_members").select("role").eq("group_id", group_id).eq("user_id", target_user_id))
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    if target["role"] == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot remove owner; transfer first")
    sb.table("group_members").delete().eq("group_id", group_id).eq("user_id", target_user_id).execute()
