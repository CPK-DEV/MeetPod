import secrets


def generate_code() -> str:
    """8-char URL-safe code. token_urlsafe(6)은 base64로 정확히 8자."""
    return secrets.token_urlsafe(6)
