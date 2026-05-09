from unittest.mock import patch

from app.models.profile import Profile


def test_get_me_requires_auth(client):
    assert client.get("/api/profiles/me").status_code == 401


def test_get_me_returns_profile(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.profiles.get_profile") as m:
            m.return_value = Profile(id="u1", display_name="Harry", handle="harry")
            r = client.get("/api/profiles/me")
    assert r.status_code == 200
    assert r.json()["handle"] == "harry"


def test_get_me_404_when_not_bootstrapped(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.profiles.get_profile") as m:
            m.return_value = None
            r = client.get("/api/profiles/me")
    assert r.status_code == 404


def test_set_handle_validates_format(client, auth_as):
    with auth_as("u1"):
        r = client.patch("/api/profiles/me/handle", json={"handle": "ab"})
    assert r.status_code == 422


def test_set_handle_calls_service(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.profiles.set_handle") as m:
            m.return_value = Profile(id="u1", display_name="Harry", handle="harry")
            r = client.patch("/api/profiles/me/handle", json={"handle": "harry"})
    assert r.status_code == 200
    m.assert_called_once_with("u1", "harry")
