import jwt

from app.config import get_settings


class JWTError(Exception):
    pass


def decode_supabase_jwt(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as e:
        raise JWTError(str(e)) from e
