import jwt
import httpx
from jwt.algorithms import ECAlgorithm, RSAAlgorithm
import json

from app.config import get_settings


class JWTError(Exception):
    pass


_jwks_cache: dict | None = None


def _fetch_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        s = get_settings()
        url = s.SUPABASE_URL.rstrip("/") + "/auth/v1/.well-known/jwks.json"
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


def _get_public_key(kid: str, alg: str):
    jwks = _fetch_jwks()
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            if alg.startswith("ES"):
                return ECAlgorithm.from_jwk(json.dumps(key_data))
            else:
                return RSAAlgorithm.from_jwk(json.dumps(key_data))
    # fallback: use first key
    keys = jwks.get("keys", [])
    if keys:
        key_data = keys[0]
        if alg.startswith("ES"):
            return ECAlgorithm.from_jwk(json.dumps(key_data))
        else:
            return RSAAlgorithm.from_jwk(json.dumps(key_data))
    raise JWTError("no matching key found in JWKS")


def decode_supabase_jwt(token: str) -> dict:
    settings = get_settings()
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "")
        if alg == "HS256":
            # Legacy symmetric secret path (kept for tests / older projects)
            return jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        # Asymmetric (ES256/RS256/EdDSA): fetch JWKS via httpx
        kid = header.get("kid", "")
        public_key = _get_public_key(kid, alg)
        return jwt.decode(
            token,
            public_key,
            algorithms=[alg],
            audience="authenticated",
        )
    except JWTError:
        raise
    except Exception as e:
        raise JWTError(str(e)) from e
