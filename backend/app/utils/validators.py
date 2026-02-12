from __future__ import annotations

import re
import unicodedata


_NON_DIGITS_RE = re.compile(r"\D+")


def only_digits(value: str) -> str:
    """
    Return `value` keeping digits only.

    Examples:
    - "123.456.789-09" -> "12345678909"
    - "12.345.678/0001-95" -> "12345678000195"
    """
    return _NON_DIGITS_RE.sub("", value or "").strip()


def is_valid_cpf(raw: str) -> bool:
    cpf = only_digits(raw)
    if len(cpf) != 11:
        return False
    if cpf == cpf[0] * 11:
        return False

    numbers = [int(d) for d in cpf]

    # 1st check digit
    s1 = sum(numbers[i] * (10 - i) for i in range(9))
    d1 = 0 if (s1 % 11) < 2 else 11 - (s1 % 11)
    if numbers[9] != d1:
        return False

    # 2nd check digit
    s2 = sum(numbers[i] * (11 - i) for i in range(10))
    d2 = 0 if (s2 % 11) < 2 else 11 - (s2 % 11)
    return numbers[10] == d2


def is_valid_cnpj(raw: str) -> bool:
    cnpj = only_digits(raw)
    if len(cnpj) != 14:
        return False
    if cnpj == cnpj[0] * 14:
        return False

    numbers = [int(d) for d in cnpj]

    def _calc_digit(nums: list[int], weights: list[int]) -> int:
        total = sum(n * w for n, w in zip(nums, weights, strict=True))
        r = total % 11
        return 0 if r < 2 else 11 - r

    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    d1 = _calc_digit(numbers[:12], w1)
    if numbers[12] != d1:
        return False

    w2 = [6] + w1
    d2 = _calc_digit(numbers[:13], w2)
    return numbers[13] == d2


def has_valid_cpf_length(raw: str) -> bool:
    return len(only_digits(raw)) == 11


def has_valid_cnpj_length(raw: str) -> bool:
    return len(only_digits(raw)) == 14


def has_valid_phone_length(raw: str) -> bool:
    digits = only_digits(raw)
    if len(digits) != 11:
        return False
    if len(digits) >= 3 and digits[2] != "9":
        return False
    return True


DOCUMENT_CATEGORY_ALIASES: dict[str, str] = {
    "sentenca": "sentencas",
    "sentencas": "sentencas",
    "sentença": "sentencas",
    "sentenças": "sentencas",
    "acordao": "acordao",
    "acordão": "acordao",
}

DOCUMENT_CATEGORIES_ALLOWED: set[str] = {
    "despacho",
    "sentencas",
    "acordao",
    "identidade",
    "comprovante_endereco",
    "declaracao_pobreza",
    "contrato",
    "peticao",
    "procuracao",
    "comprovante_pagamento",
    "ultima_movimentacao",
    "outros",
}


def normalize_document_category(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip().lower()
    if not value:
        return None
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = value.replace("-", "_").replace(" ", "_")
    if value in DOCUMENT_CATEGORY_ALIASES:
        value = DOCUMENT_CATEGORY_ALIASES[value]
    return value


def is_allowed_document_category(raw: str | None) -> bool:
    normalized = normalize_document_category(raw)
    if normalized is None:
        return True
    return normalized in DOCUMENT_CATEGORIES_ALLOWED


# Minimal blacklist. We can expand as needed.
DISPOSABLE_EMAIL_DOMAINS: set[str] = {
    # Mailinator
    "mailinator.com",
    "mailinator.net",
    "mailinator.org",
    # 10 Minute Mail
    "10minutemail.com",
    "10minutemail.net",
    "10minutemail.org",
    "10minutemail.co",
    # Guerrilla Mail
    "guerrillamail.com",
    "guerrillamail.net",
    "guerrillamail.org",
    "guerrillamail.de",
    # YOPmail
    "yopmail.com",
    "yopmail.net",
    "yopmail.fr",
    "yopmail.gq",
    # Temp-Mail / TempMail
    "temp-mail.org",
    "tempmail.com",
    # Others
    "getnada.com",
    "maildrop.cc",
}


def is_disposable_email(email: str) -> bool:
    """
    Return True if the email domain matches our disposable blacklist.

    This is intentionally a simple check (fast, no external network calls).
    """
    if not email:
        return False
    parts = email.strip().lower().rsplit("@", 1)
    if len(parts) != 2:
        return False
    domain = parts[1].strip().rstrip(".")
    if not domain:
        return False

    # Match either exact domain or subdomain of a disposable provider.
    for bad in DISPOSABLE_EMAIL_DOMAINS:
        if domain == bad or domain.endswith(f".{bad}"):
            return True
    return False
