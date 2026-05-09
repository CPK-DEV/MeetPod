from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser, current_user
from app.models.invite import Invite, InviteAcceptResult, InviteCreate
from app.services.invite_service import accept_invite, create_invite

router = APIRouter(prefix="/api/invites", tags=["invites"])


@router.post("", response_model=Invite)
def create(body: InviteCreate, user: CurrentUser = Depends(current_user)) -> Invite:
    return create_invite(user.id, body)


@router.post("/{code}/accept", response_model=InviteAcceptResult)
def accept(code: str, user: CurrentUser = Depends(current_user)) -> InviteAcceptResult:
    return accept_invite(user.id, code)
