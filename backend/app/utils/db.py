from typing import Any


def single(query) -> dict[str, Any] | None:
    """supabase-py의 maybe_single()이 일관성 없게 동작하므로 직접 처리.
    `.execute()` 결과의 data 리스트에서 첫 행을 반환하거나 None.
    """
    result = query.execute()
    rows = result.data or []
    return rows[0] if rows else None
