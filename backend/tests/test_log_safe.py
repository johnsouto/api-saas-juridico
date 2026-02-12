from __future__ import annotations

from app.utils.log_safe import safe_identifier


def test_safe_identifier_never_returns_raw_email():
    email = "usuario.teste@example.com"
    output = safe_identifier(email)
    assert output.startswith("h:")
    assert email not in output
    assert "example.com" not in output
    assert "@" not in output

