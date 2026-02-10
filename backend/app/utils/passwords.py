from __future__ import annotations

import re

from app.core.exceptions import BadRequestError


def validate_password_strength(password: str) -> None:
    """
    Enforce strong passwords on the server.

    Requirements (aligned with frontend UX):
    - minimum 8 characters
    - minimum 2 numbers
    - minimum 1 special character
    - minimum 1 uppercase letter
    - minimum 1 lowercase letter
    """
    pwd = str(password or "")

    length_ok = len(pwd) >= 8
    digits_ok = len(re.findall(r"\d", pwd)) >= 2
    special_ok = bool(re.search(r"[^A-Za-z0-9]", pwd))
    upper_ok = bool(re.search(r"[A-Z]", pwd))
    lower_ok = bool(re.search(r"[a-z]", pwd))

    if length_ok and digits_ok and special_ok and upper_ok and lower_ok:
        return

    raise BadRequestError(
        "Senha fraca. Use no mínimo 8 caracteres, 2 números, 1 caractere especial, 1 letra maiúscula e 1 letra minúscula."
    )

