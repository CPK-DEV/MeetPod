import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://x")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "x")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setenv("ENV", "test")
    from app.config import get_settings
    get_settings.cache_clear()


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


@pytest.fixture
def auth_as():
    """사용법:
        def test_x(client, auth_as):
            with auth_as("user-uuid-1"):
                client.get("/api/profiles/me")
    """
    from contextlib import contextmanager

    from app.dependencies.auth import CurrentUser, current_user
    from app.main import app

    @contextmanager
    def _ctx(user_id: str, email: str | None = None):
        app.dependency_overrides[current_user] = lambda: CurrentUser(id=user_id, email=email)
        try:
            yield
        finally:
            app.dependency_overrides.pop(current_user, None)

    return _ctx
