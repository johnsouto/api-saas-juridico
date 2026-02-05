from __future__ import annotations

import re


_slug_re = re.compile(r"[^a-z0-9]+")


def normalize_slug(value: str) -> str:
    value = value.strip().lower()
    value = _slug_re.sub("-", value).strip("-")
    return value or "tenant"

