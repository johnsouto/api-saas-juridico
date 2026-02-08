from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.billing_service import BillingService
from app.services.email_service import EmailService
from app.services.payment_service import FakePaymentProvider


router = APIRouter()

logger = logging.getLogger(__name__)

_billing = BillingService(provider=FakePaymentProvider(), email_service=EmailService())


@router.post("/webhook/fake")
async def fake_webhook(
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Fake provider webhook (for prototyping).

    IMPORTANT: This is not a real payment gateway integration.
    """
    body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    try:
        event = _billing.provider.handle_webhook(headers=headers, body=body)
        await _billing.process_provider_event(db, background, event=event)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("fake webhook error: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook inválido") from exc

    return {"ok": True}


@router.post("/webhook/stripe")
async def stripe_webhook():
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")


@router.post("/webhook/mercadopago")
async def mercadopago_webhook():
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")
