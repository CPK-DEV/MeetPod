from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from app.dependencies.auth import CurrentUser, current_user
from app.dependencies.permissions import require_group_role
from app.models.group import (
    Group, GroupCreate, GroupMember, GroupUpdate, RoleUpdate,
)
from app.services.group_service import (
    create_group, get_group, list_members, list_my_groups,
    remove_member, set_role, transfer_owner, update_group,
)

router = APIRouter(prefix="/api/groups", tags=["groups"])


class TransferBody(BaseModel):
    new_owner_id: str


@router.post("", response_model=Group)
def create(body: GroupCreate, user: CurrentUser = Depends(current_user)) -> Group:
    return create_group(user.id, body)


@router.get("", response_model=list[Group])
def list_(user: CurrentUser = Depends(current_user)) -> list[Group]:
    return list_my_groups(user.id)


@router.get("/{gid}", response_model=Group)
def get_(gid: str, _: None = require_group_role("member")) -> Group:
    return get_group(gid)


@router.patch("/{gid}", response_model=Group)
def patch_(gid: str, body: GroupUpdate, _: None = require_group_role("admin")) -> Group:
    return update_group(gid, body)


@router.get("/{gid}/members", response_model=list[GroupMember])
def members(gid: str, _: None = require_group_role("member")) -> list[GroupMember]:
    return list_members(gid)


@router.patch("/{gid}/members/{uid}/role", status_code=status.HTTP_204_NO_CONTENT)
def patch_role(gid: str, uid: str, body: RoleUpdate, _: None = require_group_role("admin")) -> None:
    set_role(gid, uid, body.role)


@router.delete("/{gid}/members/{uid}", status_code=status.HTTP_204_NO_CONTENT)
def kick(gid: str, uid: str, _: None = require_group_role("admin")) -> None:
    remove_member(gid, uid)


@router.post("/{gid}/transfer", status_code=status.HTTP_204_NO_CONTENT)
def transfer(
    gid: str,
    body: TransferBody,
    user: CurrentUser = Depends(current_user),
    _: None = require_group_role("owner"),
) -> None:
    transfer_owner(gid, user.id, body.new_owner_id)
