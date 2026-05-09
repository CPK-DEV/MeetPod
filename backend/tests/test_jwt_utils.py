import jwt
import pytest

from app.utils.jwt_utils import decode_supabase_jwt, JWTError

SECRET = "test-secret"


def make_token(claims: dict) -> str:
    return jwt.encode(claims, SECRET, algorithm="HS256")


def test_decode_valid_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("SUPABASE_URL", "http://x")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "x")
    from app.config import get_settings
    get_settings.cache_clear()

    token = make_token({"sub": "abc", "aud": "authenticated", "exp": 9999999999})
    claims = decode_supabase_jwt(token)
    assert claims["sub"] == "abc"


def test_decode_expired_raises(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("SUPABASE_URL", "http://x")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "x")
    from app.config import get_settings
    get_settings.cache_clear()

    token = make_token({"sub": "abc", "aud": "authenticated", "exp": 1})
    with pytest.raises(JWTError):
        decode_supabase_jwt(token)


def test_decode_bad_signature(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "other-secret")
    monkeypatch.setenv("SUPABASE_URL", "http://x")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "x")
    from app.config import get_settings
    get_settings.cache_clear()

    token = make_token({"sub": "abc", "aud": "authenticated", "exp": 9999999999})
    with pytest.raises(JWTError):
        decode_supabase_jwt(token)
