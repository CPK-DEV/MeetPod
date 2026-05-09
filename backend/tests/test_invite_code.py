import re

from app.utils.invite_code import generate_code


def test_generate_code_format():
    code = generate_code()
    assert re.fullmatch(r"[A-Za-z0-9_-]{8}", code)


def test_generate_code_unique_enough():
    seen = {generate_code() for _ in range(1000)}
    assert len(seen) == 1000
