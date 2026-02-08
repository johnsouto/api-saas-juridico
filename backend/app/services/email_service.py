from __future__ import annotations

from dataclasses import dataclass

from fastapi import BackgroundTasks
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.core.config import settings


def _is_smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD)


@dataclass(frozen=True)
class EmailService:
    def _client(self) -> FastMail:
        conf = ConnectionConfig(
            MAIL_USERNAME=settings.SMTP_USERNAME or "",
            MAIL_PASSWORD=settings.SMTP_PASSWORD or "",
            MAIL_FROM=settings.EMAIL_FROM,
            MAIL_FROM_NAME=settings.EMAIL_FROM_NAME,
            MAIL_SERVER=settings.SMTP_HOST or "",
            MAIL_PORT=settings.SMTP_PORT,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=False,
        )
        return FastMail(conf)

    def _enqueue_or_log(self, background: BackgroundTasks, subject: str, recipients: list[str], body: str) -> None:
        if not _is_smtp_configured():
            # Dev-friendly fallback: no SMTP configured.
            print(f"[email] To={recipients} Subject={subject}\n{body}\n")
            return

        message = MessageSchema(
            subject=subject,
            recipients=recipients,
            body=body,
            subtype=MessageType.plain,
        )

        async def _send() -> None:
            await self._client().send_message(message)

        background.add_task(_send)

    def send_welcome_email(self, background: BackgroundTasks, *, to_email: str, tenant_nome: str) -> None:
        subject = "Bem-vindo ao SaaS Jurídico"
        body = f"Seu tenant '{tenant_nome}' foi criado com sucesso.\n\nAcesse o sistema e comece a usar."
        self._enqueue_or_log(background, subject, [to_email], body)

    def send_invite_email(self, background: BackgroundTasks, *, to_email: str, inviter_name: str, invite_link: str) -> None:
        subject = "Convite para o SaaS Jurídico"
        body = f"{inviter_name} convidou você.\n\nDefina sua senha aqui:\n{invite_link}"
        self._enqueue_or_log(background, subject, [to_email], body)

    def send_first_access_email(self, background: BackgroundTasks, *, to_email: str, tenant_nome: str, invite_link: str) -> None:
        subject = "Primeiro acesso - SaaS Jurídico"
        body = f"Seu acesso ao tenant '{tenant_nome}' foi criado.\n\nDefina sua senha no link:\n{invite_link}"
        self._enqueue_or_log(background, subject, [to_email], body)

    def send_reset_password_email(self, background: BackgroundTasks, *, to_email: str, reset_link: str) -> None:
        subject = "Redefinição de senha"
        body = f"Para redefinir sua senha, acesse:\n{reset_link}\n\nSe não foi você, ignore."
        self._enqueue_or_log(background, subject, [to_email], body)

    def send_generic_email(self, background: BackgroundTasks, *, to_emails: list[str], subject: str, body: str) -> None:
        """
        Generic transactional email helper (plain text).

        Used by billing notifications and other operator flows.
        """
        recipients = [e for e in to_emails if e]
        if not recipients:
            return
        self._enqueue_or_log(background, subject, recipients, body)
