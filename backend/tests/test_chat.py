from datetime import datetime, timezone
from unittest.mock import patch

from app.models.chat import ChatRoom, Message, UploadUrlResponse


def _msg(**kw):
    base = dict(id="msg1", room_id="r1", sender_id="u1", kind="text",
                body="hi", image_url=None, place_payload=None,
                created_at=datetime.now(timezone.utc),
                edited_at=None, deleted_at=None)
    base.update(kw)
    return Message(**base)


def test_list_my_rooms(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.list_my_rooms") as m:
            m.return_value = [ChatRoom(id="r1", kind="group", ref_id="g1",
                                        archived_at=None, created_at=datetime.now(timezone.utc))]
            r = client.get("/api/chat/rooms")
    assert r.status_code == 200
    assert r.json()[0]["kind"] == "group"


def test_list_messages(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.list_messages") as m:
            m.return_value = [_msg()]
            r = client.get("/api/chat/rooms/r1/messages?limit=10")
    assert r.status_code == 200
    assert r.json()[0]["body"] == "hi"


def test_send_text(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.send_message") as m:
            m.return_value = _msg()
            r = client.post("/api/chat/rooms/r1/messages", json={"kind": "text", "body": "hi"})
    assert r.status_code == 200
    assert r.json()["body"] == "hi"


def test_send_text_missing_body_422(client, auth_as):
    with auth_as("u1"):
        r = client.post("/api/chat/rooms/r1/messages", json={"kind": "text"})
    assert r.status_code == 422


def test_edit_message(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.edit_message") as m:
            m.return_value = _msg(body="edited")
            r = client.patch("/api/chat/messages/msg1", json={"body": "edited"})
    assert r.status_code == 200
    assert r.json()["body"] == "edited"


def test_delete_message(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.delete_message") as m:
            r = client.delete("/api/chat/messages/msg1")
    assert r.status_code == 204
    m.assert_called_with("msg1", "u1")


def test_create_upload_url(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.create_image_upload_url") as m:
            m.return_value = UploadUrlResponse(object_key="r1/abc.jpg",
                                                signed_url="https://x", public_path="chat-images/r1/abc.jpg",
                                                expires_in=60)
            r = client.post("/api/chat/rooms/r1/upload-url", json={"ext": "jpg"})
    assert r.status_code == 200
    assert r.json()["object_key"].startswith("r1/")
