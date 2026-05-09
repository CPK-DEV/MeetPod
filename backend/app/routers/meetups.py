from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel

from app.dependencies.auth import CurrentUser, current_user
from app.dependencies.permissions import (
    require_meetup_editor, require_meetup_participant,
)
from app.models.meetup import (
    Meetup, MeetupCreate, MeetupUpdate, Participant,
)
from app.services.meetup_service import (
    add_participants, cancel_meetup, create_meetup, get_meetup,
    list_my_meetups, list_participants, remove_participant, update_meetup,
)

router = APIRouter(prefix="/api/meetups", tags=["meetups"])


class AddParticipantsBody(BaseModel):
    user_ids: list[str]


@router.post("", response_model=Meetup)
def create(body: MeetupCreate, user: CurrentUser = Depends(current_user)) -> Meetup:
    return create_meetup(user.id, body)


@router.get("", response_model=list[Meetup])
def list_(
    user: CurrentUser = Depends(current_user),
    include_ended: bool = Query(default=False),
) -> list[Meetup]:
    return list_my_meetups(user.id, include_ended=include_ended)


@router.get("/{mid}", response_model=Meetup)
def get_(mid: str, _: None = require_meetup_participant()) -> Meetup:
    return get_meetup(mid)


@router.patch("/{mid}", response_model=Meetup)
def patch_(mid: str, body: MeetupUpdate, _: None = require_meetup_editor()) -> Meetup:
    return update_meetup(mid, body)


@router.post("/{mid}/cancel", response_model=Meetup)
def cancel(mid: str, _: None = require_meetup_editor()) -> Meetup:
    return cancel_meetup(mid)


@router.get("/{mid}/participants", response_model=list[Participant])
def participants(mid: str, _: None = require_meetup_participant()) -> list[Participant]:
    return list_participants(mid)


@router.post("/{mid}/participants", status_code=status.HTTP_204_NO_CONTENT)
def add(mid: str, body: AddParticipantsBody, _: None = require_meetup_editor()) -> None:
    add_participants(mid, body.user_ids)


@router.delete("/{mid}/participants/me", status_code=status.HTTP_204_NO_CONTENT)
def leave(
    mid: str,
    user: CurrentUser = Depends(current_user),
    _: None = require_meetup_participant(),
) -> None:
    remove_participant(mid, user.id)
