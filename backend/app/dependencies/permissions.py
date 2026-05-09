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
