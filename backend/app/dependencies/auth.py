from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

from app.utils.jwt_utils import JWTError, decode_supabase_jwt


@dataclass(frozen=True)
class CurrentUser:
    id: str          # uuid
    email: str | None


def current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = decode_supabase_jwt(token)
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {e}")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token missing sub")
    return CurrentUser(id=sub, email=claims.get("email"))


def require_auth() -> "Depends":
    return Depends(current_user)
