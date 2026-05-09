from unittest.mock import patch

from app.models.profile import Profile


def test_bootstrap_requires_auth(client):
    r = client.post("/api/auth/bootstrap", json={"display_name": "Harry"})
    assert r.status_code == 401


def test_bootstrap_creates_profile(client, auth_as):
    with auth_as("user-1", email="h@x.test"):
        with patch("app.routers.auth.upsert_profile_on_bootstrap") as m:
            m.return_value = Profile(id="user-1", display_name="Harry")
            r = client.post("/api/auth/bootstrap", json={"display_name": "Harry"})
    assert r.status_code == 200
    assert r.json()["id"] == "user-1"
    m.assert_called_once_with("user-1", "Harry", None)
