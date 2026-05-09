from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.models.invite import Invite, InviteAcceptResult, InviteCreate
from app.utils.db import single
from app.utils.invite_code import generate_code
from app.utils.supabase_client import get_supabase


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_invite(inviter_id: str, body: InviteCreate) -> Invite:
    if body.kind == "group" and not body.target_group_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "target_group_id required for group invite")
    if body.kind == "friend" and body.target_group_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "friend invite must not target a group")

    sb = get_supabase()

    if body.kind == "group":
        # 초대 권한: 그룹 멤버여야 함 (owner/admin은 후속 ACL에서 분리; MVP는 멤버 누구나)
        m = single(sb.table("group_members").select("user_id")
                   .eq("group_id", body.target_group_id).eq("user_id", inviter_id))
        if not m:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not a group member")

    payload = {
        "inviter_id": inviter_id,
        "kind": body.kind,
        "target_group_id": body.target_group_id,
        "expires_at": (_now() + timedelta(days=body.expires_in_days)).isoformat(),
        "max_uses": body.max_uses,
        "used_count": 0,
    }

    # 코드 충돌 시 재시도
    for _ in range(3):
        code = generate_code()
        try:
            sb.table("invites").insert({**payload, "code": code}).execute()
            row = single(sb.table("invites").select("*").eq("code", code))
            return Invite(**row)
        except Exception as e:
            if "duplicate key" not in str(e).lower():
                raise
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "could not allocate invite code")


def accept_invite(user_id: str, code: str) -> InviteAcceptResult:
    sb = get_supabase()
    inv = single(sb.table("invites").select("*").eq("code", code))
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "invite not found")

    expires_at = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00"))
    if expires_at < _now():
        raise HTTPException(status.HTTP_410_GONE, "invite expired")
    if inv["used_count"] >= inv["max_uses"]:
        raise HTTPException(status.HTTP_410_GONE, "invite exhausted")
    if inv["inviter_id"] == user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot accept own invite")

    if inv["kind"] == "friend":
        a, b = sorted([inv["inviter_id"], user_id])
        existing = single(sb.table("friendships").select("user_a_id")
                          .eq("user_a_id", a).eq("user_b_id", b))
        if not existing:
            sb.table("friendships").insert({"user_a_id": a, "user_b_id": b}).execute()
        group_id = None
    else:
        gid = inv["target_group_id"]
        existing_member = single(sb.table("group_members").select("user_id")
                                 .eq("group_id", gid).eq("user_id", user_id))
        if not existing_member:
            sb.table("group_members").insert(
                {"group_id": gid, "user_id": user_id, "role": "member"}
            ).execute()
        group_id = gid

    sb.table("invites").update({"used_count": inv["used_count"] + 1}).eq("code", code).execute()
    return InviteAcceptResult(kind=inv["kind"], inviter_id=inv["inviter_id"], group_id=group_id)
