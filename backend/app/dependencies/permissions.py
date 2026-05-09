from typing import Literal

from fastapi import Depends, HTTPException, Path, status

from app.dependencies.auth import CurrentUser, current_user
from app.utils.db import single
from app.utils.supabase_client import get_supabase

Role = Literal["owner", "admin", "member"]
_RANK: dict[str, int] = {"member": 0, "admin": 1, "owner": 2}


def _fetch_role(group_id: str, user_id: str) -> str | None:
    sb = get_supabase()
    row = single(sb.table("group_members").select("role")
                 .eq("group_id", group_id).eq("user_id", user_id))
    return row["role"] if row else None


def require_group_role(min_role: Role):
    def _dep(
        gid: str = Path(..., alias="gid"),
        user: CurrentUser = Depends(current_user),
    ) -> None:
        role = _fetch_role(gid, user.id)
        if role is None or _RANK[role] < _RANK[min_role]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "insufficient group role")

    return Depends(_dep)


def _is_meetup_participant(meetup_id: str, user_id: str) -> bool:
    sb = get_supabase()
    return single(sb.table("meetup_participants").select("user_id")
                  .eq("meetup_id", meetup_id).eq("user_id", user_id)) is not None


def _meetup_editor(meetup_id: str, user_id: str) -> bool:
    """creator 또는 그룹 owner/admin"""
    sb = get_supabase()
    m = single(sb.table("meetups").select("creator_id, group_id").eq("id", meetup_id))
    if not m:
        return False
    if m["creator_id"] == user_id:
        return True
    if m["group_id"]:
        role = _fetch_role(m["group_id"], user_id)
        return role in ("owner", "admin")
    return False


def require_meetup_participant():
    def _dep(
        mid: str = Path(..., alias="mid"),
        user: CurrentUser = Depends(current_user),
    ) -> None:
        if not _is_meetup_participant(mid, user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not a meetup participant")
    return Depends(_dep)


def require_meetup_editor():
    def _dep(
        mid: str = Path(..., alias="mid"),
        user: CurrentUser = Depends(current_user),
    ) -> None:
        if not _meetup_editor(mid, user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not allowed to edit this meetup")
    return Depends(_dep)
