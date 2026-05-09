from unittest.mock import patch

from app.models.friendship import FriendSummary


def test_list_friends_requires_auth(client):
    assert client.get("/api/friendships").status_code == 401


def test_list_friends_returns(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.friendships.list_friends") as m:
            m.return_value = [FriendSummary(id="u2", handle="bob", display_name="Bob", avatar_url=None)]
            r = client.get("/api/friendships")
    assert r.status_code == 200
    assert r.json()[0]["handle"] == "bob"
