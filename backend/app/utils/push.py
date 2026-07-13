import httpx

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_expo_push(tokens: list[str], title: str, body: str, data: dict | None = None) -> None:
    if not tokens:
        return
    messages = [
        {"to": tok, "sound": "default", "title": title, "body": body, "data": data or {}}
        for tok in tokens
    ]
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(EXPO_PUSH_URL, json=messages, headers={"Content-Type": "application/json"})
    except httpx.HTTPError:
        pass  # best-effort; caller's primary action already succeeded
