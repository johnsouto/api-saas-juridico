from __future__ import annotations

import httpx

from app.core.config import settings


async def send_telegram_alert(message: str) -> None:
    """
    Send an alert message via Telegram (best-effort).

    Requirements:
    - TELEGRAM_BOT_TOKEN
    - TELEGRAM_CHAT_ID

    Resilience:
    - Never raise. If Telegram is down or misconfigured, the app must continue normally.
    """
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID
    if not token or not chat_id:
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # Telegram accepts JSON. We intentionally ignore response body to avoid logging PII.
            await client.post(url, json=payload)
    except Exception:
        # Best-effort only.
        return

