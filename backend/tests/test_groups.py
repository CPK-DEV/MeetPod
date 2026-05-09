from datetime import datetime, timezone
from unittest.mock import patch

from app.models.group import Group, GroupMember


def _g(**kw):
    base = dict(id="g1", name="G", description=None, avatar_url=None,
                owner_id="u1", created_at=datetime.now(timezone.utc))
    base.update(kw)
    return Group(**base)


def test_create_group(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.groups.create_group") as m:
            m.return_value = _g()
            r = client.post("/api/groups", json={"name": "G"})
    assert r.status_code == 200
    assert r.json()["id"] == "g1"


def test_list_my_groups(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.groups.list_my_groups") as m:
            m.return_value = [_g()]
            r = client.get("/api/groups")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_get_group_requires_member(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.get_group") as gg:
            fr.return_value = None
            r = client.get("/api/groups/g1")
            assert r.status_code == 403
            fr.return_value = "member"
            gg.return_value = _g()
            r = client.get("/api/groups/g1")
            assert r.status_code == 200


def test_update_group_requires_admin(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.update_group") as ug:
            fr.return_value = "member"
            r = client.patch("/api/groups/g1", json={"name": "X"})
            assert r.status_code == 403
            fr.return_value = "admin"
            ug.return_value = _g(name="X")
            r = client.patch("/api/groups/g1", json={"name": "X"})
            assert r.status_code == 200


def test_list_members(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.list_members") as lm:
            fr.return_value = "member"
            lm.return_value = [GroupMember(user_id="u1", role="owner")]
            r = client.get("/api/groups/g1/members")
    assert r.status_code == 200
    assert r.json()[0]["role"] == "owner"


def test_set_role_requires_admin(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.set_role") as sr:
            fr.return_value = "admin"
            sr.return_value = None
            r = client.patch("/api/groups/g1/members/u2/role", json={"role": "admin"})
    assert r.status_code == 204


def test_remove_member_requires_admin(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.remove_member") as rm:
            fr.return_value = "admin"
            r = client.delete("/api/groups/g1/members/u2")
    assert r.status_code == 204


def test_transfer_owner_requires_owner(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.transfer_owner") as t:
            fr.return_value = "admin"
            r = client.post("/api/groups/g1/transfer", json={"new_owner_id": "u2"})
            assert r.status_code == 403
            fr.return_value = "owner"
            r = client.post("/api/groups/g1/transfer", json={"new_owner_id": "u2"})
            assert r.status_code == 204
            t.assert_called_with("g1", "u1", "u2")
