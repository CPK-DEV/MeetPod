from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models.invite import Invite, InviteAcceptResult


def _inv(**kw):
    base = dict(
        code="abcd1234",
        inviter_id="u1",
        kind="friend",
        target_group_id=None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        max_uses=10,
        used_count=0,
    )
    base.update(kw)
    return Invite(**base)


def test_create_friend_invite(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.invites.create_invite") as m:
            m.return_value = _inv()
            r = client.post("/api/invites", json={"kind": "friend"})
    assert r.status_code == 200
    assert r.json()["code"] == "abcd1234"


def test_accept_invite_friend(client, auth_as):
    with auth_as("u2"):
        with patch("app.routers.invites.accept_invite") as m:
            m.return_value = InviteAcceptResult(kind="friend", inviter_id="u1", group_id=None)
            r = client.post("/api/invites/abcd1234/accept")
    assert r.status_code == 200
    assert r.json() == {"kind": "friend", "inviter_id": "u1", "group_id": None}


def test_create_invite_requires_auth(client):
    assert client.post("/api/invites", json={"kind": "friend"}).status_code == 401
