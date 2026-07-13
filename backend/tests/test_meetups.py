from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models.meetup import Meetup, Participant


def _m(**kw):
    base = dict(
        id="m1", group_id=None, creator_id="u1", title="T",
        starts_at=datetime.now(timezone.utc) + timedelta(hours=1),
        ends_at=datetime.now(timezone.utc) + timedelta(hours=2),
        place_name="P", place_lat=37.5, place_lng=127.0,
        place_address=None, place_google_id=None,
        location_share_minutes_before=20, status="scheduled",
        created_at=datetime.now(timezone.utc),
    )
    base.update(kw)
    return Meetup(**base)


def _create_body() -> dict:
    return {
        "title": "T",
        "starts_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "ends_at":   (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        "place": {"name": "P", "lat": 37.5, "lng": 127.0},
    }


def test_create_meetup(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.meetups.create_meetup") as m:
            m.return_value = _m()
            r = client.post("/api/meetups", json=_create_body())
    assert r.status_code == 200
    assert r.json()["id"] == "m1"


def test_create_validates_time_order(client, auth_as):
    body = _create_body()
    body["ends_at"] = body["starts_at"]
    with auth_as("u1"):
        r = client.post("/api/meetups", json=body)
    assert r.status_code == 422


def test_list_my_meetups(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.meetups.list_my_meetups") as m:
            m.return_value = [_m()]
            r = client.get("/api/meetups")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_get_meetup_requires_participant(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._is_meetup_participant") as p, \
             patch("app.routers.meetups.get_meetup") as g:
            p.return_value = False
            assert client.get("/api/meetups/m1").status_code == 403
            p.return_value = True
            g.return_value = _m()
            assert client.get("/api/meetups/m1").status_code == 200


def test_update_requires_editor(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._meetup_editor") as e, \
             patch("app.routers.meetups.update_meetup") as u:
            e.return_value = False
            assert client.patch("/api/meetups/m1", json={"title": "X"}).status_code == 403
            e.return_value = True
            u.return_value = _m(title="X")
            assert client.patch("/api/meetups/m1", json={"title": "X"}).status_code == 200


def test_cancel_requires_editor(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._meetup_editor") as e, \
             patch("app.routers.meetups.cancel_meetup") as c:
            e.return_value = True
            c.return_value = _m(status="cancelled")
            r = client.post("/api/meetups/m1/cancel")
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


def test_participants_list(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._is_meetup_participant") as p, \
             patch("app.routers.meetups.list_participants") as lp:
            p.return_value = True
            lp.return_value = [Participant(user_id="u1", status="going",
                                            joined_at=datetime.now(timezone.utc))]
            r = client.get("/api/meetups/m1/participants")
    assert r.status_code == 200
    assert r.json()[0]["user_id"] == "u1"


def test_add_participants_requires_editor(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._meetup_editor") as e, \
             patch("app.routers.meetups.add_participants") as a:
            e.return_value = True
            r = client.post("/api/meetups/m1/participants", json={"user_ids": ["u2", "u3"]})
    assert r.status_code == 204
    a.assert_called_with("m1", "u1", ["u2", "u3"])


def test_leave_meetup(client, auth_as):
    with auth_as("u2"):
        with patch("app.dependencies.permissions._is_meetup_participant") as p, \
             patch("app.routers.meetups.remove_participant") as r:
            p.return_value = True
            res = client.delete("/api/meetups/m1/participants/me")
    assert res.status_code == 204
    r.assert_called_with("m1", "u2")
