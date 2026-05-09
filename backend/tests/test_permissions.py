from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.dependencies.auth import CurrentUser, current_user
from app.dependencies.permissions import require_group_role


def _app_with_route(role: str):
    app = FastAPI()

    @app.get("/g/{gid}")
    def view(gid: str, _: None = require_group_role(role)) -> dict:
        return {"ok": True}

    return app


@pytest.mark.parametrize("user_role,required,expected", [
    ("owner", "owner", 200),
    ("owner", "admin", 200),
    ("admin", "admin", 200),
    ("admin", "owner", 403),
    ("member", "admin", 403),
    ("member", "member", 200),
])
def test_role_gate(user_role, required, expected):
    app = _app_with_route(required)
    app.dependency_overrides[current_user] = lambda: CurrentUser(id="u1", email=None)

    with patch("app.dependencies.permissions._fetch_role") as m:
        m.return_value = user_role
        client = TestClient(app)
        r = client.get("/g/g1")
    assert r.status_code == expected


def test_no_membership_403():
    app = _app_with_route("member")
    app.dependency_overrides[current_user] = lambda: CurrentUser(id="u1", email=None)
    with patch("app.dependencies.permissions._fetch_role") as m:
        m.return_value = None
        client = TestClient(app)
        assert client.get("/g/g1").status_code == 403
