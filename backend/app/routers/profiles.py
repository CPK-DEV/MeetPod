from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import CurrentUser, current_user
from app.models.profile import HandleUpdate, Profile
from app.services.profile_service import get_profile, set_handle

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/me", response_model=Profile)
def get_me(user: CurrentUser = Depends(current_user)) -> Profile:
    p = get_profile(user.id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "profile not found")
    return p


@router.patch("/me/handle", response_model=Profile)
def patch_handle(body: HandleUpdate, user: CurrentUser = Depends(current_user)) -> Profile:
    return set_handle(user.id, body.handle)
