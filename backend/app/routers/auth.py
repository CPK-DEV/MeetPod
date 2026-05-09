from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser, current_user
from app.models.profile import BootstrapRequest, Profile
from app.services.profile_service import upsert_profile_on_bootstrap

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/bootstrap", response_model=Profile)
def bootstrap(body: BootstrapRequest, user: CurrentUser = Depends(current_user)) -> Profile:
    return upsert_profile_on_bootstrap(user.id, body.display_name, body.avatar_url)
