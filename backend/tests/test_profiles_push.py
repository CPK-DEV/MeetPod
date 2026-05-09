from unittest.mock import patch


def test_put_push_token(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.profiles.set_push_token") as m:
            r = client.put("/api/profiles/me/push-token", json={"expo_push_token": "ExponentPushToken[abc]"})
    assert r.status_code == 204
    m.assert_called_with("u1", "ExponentPushToken[abc]")


def test_put_push_token_null(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.profiles.set_push_token") as m:
            r = client.put("/api/profiles/me/push-token", json={"expo_push_token": None})
    assert r.status_code == 204
    m.assert_called_with("u1", None)
