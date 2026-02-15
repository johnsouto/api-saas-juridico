from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.models.enums import PlanCode, SubscriptionStatus
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.user import User
from app.services.action_audit_service import log_security_action
from app.services.email_service import EmailService
from app.services.export_service import ExportRateLimitError, TenantExportService


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_plus_effective(sub: Subscription, *, now: datetime) -> bool:
    if sub.plan_code == PlanCode.FREE:
        return False
    if sub.status == SubscriptionStatus.active and (sub.current_period_end is None or now <= sub.current_period_end):
        return True
    if sub.status == SubscriptionStatus.past_due and sub.grace_period_end and now <= sub.grace_period_end:
        return True
    return False


@dataclass(frozen=True)
class AccountDeleteResult:
    ok: bool
    delete_scheduled_for: datetime
    plan_code: PlanCode
    export_requested: bool
    export_id: uuid.UUID | None
    export_rate_limited: bool
    export_retry_after_seconds: int | None
    latest_export_id: uuid.UUID | None


@dataclass(frozen=True)
class AccountService:
    email_service: EmailService
    export_service: TenantExportService

    async def _tenant_and_subscription(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> tuple[Tenant, Subscription | None]:
        tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
        if not tenant:
            raise NotFoundError("Tenant não encontrado")
        sub = (await db.execute(select(Subscription).where(Subscription.tenant_id == tenant_id))).scalar_one_or_none()
        return tenant, sub

    async def request_delete(
        self,
        db: AsyncSession,
        background: BackgroundTasks,
        *,
        request: Request,
        user: User,
        confirm_text: str,
        reason: str | None,
        reason_text: str | None,
    ) -> AccountDeleteResult:
        if (confirm_text or "").strip().upper() != "EXCLUIR":
            raise BadRequestError("Confirmação inválida. Digite EXCLUIR para continuar.")

        now = _utcnow()
        tenant, sub = await self._tenant_and_subscription(db, tenant_id=user.tenant_id)
        plan_code = sub.plan_code if sub else PlanCode.FREE
        is_plus = bool(sub and _is_plus_effective(sub, now=now))

        delete_scheduled_for = now + timedelta(days=30)
        access_until = now + (timedelta(hours=48) if is_plus else timedelta(days=30))

        tenant.status = "PENDING_DELETE"
        tenant.delete_requested_at = now
        tenant.delete_scheduled_for = delete_scheduled_for
        tenant.delete_reason_code = (reason or "").strip().lower() or None
        tenant.delete_reason_text = (reason_text or "").strip()[:1000] or None
        tenant.delete_access_until = access_until
        db.add(tenant)

        export_requested = False
        export_id: uuid.UUID | None = None
        export_rate_limited = False
        export_retry_after_seconds: int | None = None
        latest_export_id: uuid.UUID | None = None

        if is_plus:
            try:
                exp = await self.export_service.request_export(
                    db,
                    tenant_id=user.tenant_id,
                    requested_by_user_id=user.id,
                    note="auto_on_delete_request",
                    enforce_rate_limit=True,
                )
                export_requested = True
                export_id = exp.id
                background.add_task(self.export_service.generate_export_background, exp.id)
            except ExportRateLimitError as exc:
                export_rate_limited = True
                export_retry_after_seconds = exc.retry_after_seconds
                latest_export_id = exc.latest_export.id if exc.latest_export else None

        await log_security_action(
            db,
            action="ACCOUNT_DELETE_REQUESTED",
            user=user,
            tenant_id=user.tenant_id,
            request=request,
            metadata={
                "plan_code": plan_code.value,
                "delete_scheduled_for": delete_scheduled_for,
                "reason": tenant.delete_reason_code,
                "export_requested": export_requested,
                "export_id": export_id,
                "export_rate_limited": export_rate_limited,
                "latest_export_id": latest_export_id,
            },
        )
        await db.commit()

        self._send_delete_email(
            background=background,
            to_email=user.email,
            is_plus=is_plus,
            delete_scheduled_for=delete_scheduled_for,
            export_id=export_id,
            export_rate_limited=export_rate_limited,
            latest_export_id=latest_export_id,
            retry_after_seconds=export_retry_after_seconds,
        )

        return AccountDeleteResult(
            ok=True,
            delete_scheduled_for=delete_scheduled_for,
            plan_code=plan_code,
            export_requested=export_requested,
            export_id=export_id,
            export_rate_limited=export_rate_limited,
            export_retry_after_seconds=export_retry_after_seconds,
            latest_export_id=latest_export_id,
        )

    def _send_delete_email(
        self,
        *,
        background: BackgroundTasks,
        to_email: str,
        is_plus: bool,
        delete_scheduled_for: datetime,
        export_id: uuid.UUID | None,
        export_rate_limited: bool,
        latest_export_id: uuid.UUID | None,
        retry_after_seconds: int | None,
    ) -> None:
        app_base = settings.PUBLIC_APP_URL.rstrip("/")
        delete_date = delete_scheduled_for.astimezone(timezone.utc).strftime("%d/%m/%Y")

        if is_plus:
            subject = "Solicitação de exclusão recebida — Elemento Juris"
            body_lines = [
                "Recebemos sua solicitação de exclusão de conta.",
                "",
                "Sua conta foi marcada para exclusão e será removida definitivamente após 30 dias.",
                f"Data prevista para exclusão definitiva: {delete_date}.",
                "",
            ]
            if export_id:
                body_lines.extend(
                    [
                        "Uma exportação completa foi iniciada automaticamente.",
                        f"Acompanhe em: {app_base}/exports/{export_id}",
                        "O link de download ficará disponível por 14 dias após concluir.",
                        "",
                    ]
                )
            elif export_rate_limited:
                body_lines.extend(
                    [
                        "Não foi possível gerar uma nova exportação agora por limite de 24h.",
                        f"Tempo restante aproximado: {retry_after_seconds or 0} segundos.",
                        (f"Use o export mais recente: {app_base}/exports/{latest_export_id}" if latest_export_id else "Aguarde para solicitar novo export."),
                        "",
                    ]
                )
            body_lines.extend(["Não é necessário responder este e-mail.", "", "Equipe Elemento Juris"])
            self.email_service.send_generic_email(background, to_emails=[to_email], subject=subject, body="\n".join(body_lines))
            return

        subject = "Solicitação de exclusão recebida — Elemento Juris"
        body = "\n".join(
            [
                "Recebemos sua solicitação de exclusão de conta.",
                "",
                "Como seu plano é Free, não há exportação automática.",
                "Acesse a plataforma para baixar manualmente seus documentos e dados dentro de 30 dias.",
                f"Data prevista para exclusão definitiva: {delete_date}.",
                "",
                "Não é necessário responder este e-mail.",
                "",
                "Equipe Elemento Juris",
            ]
        )
        self.email_service.send_generic_email(background, to_emails=[to_email], subject=subject, body=body)
