from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser, current_user
from app.models.friendship import FriendSummary
from app.services.friendship_service import list_friends

router = APIRouter(prefix="/api/friendships", tags=["friendships"])


@router.get("", response_model=list[FriendSummary])
def list_(user: CurrentUser = Depends(current_user)) -> list[FriendSummary]:
    return list_friends(user.id)
