from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr

from fastapi import BackgroundTasks
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD)


@dataclass(frozen=True)
class EmailService:
    def _smtp_send(self, message: EmailMessage) -> None:
        if not _is_smtp_configured():
            raise RuntimeError("SMTP não configurado")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as client:
            client.starttls()
            client.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            client.send_message(message)

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

    def send_agenda_event_created_email(
        self,
        *,
        to_email: str,
        subject: str,
        body: str,
        ics_bytes: bytes,
    ) -> bool:
        """
        Sends a transactional agenda email with .ics attachment.
        Returns True on success and False on failure.
        """
        if not _is_smtp_configured():
            logger.warning("SMTP não configurado para enviar e-mail de agenda")
            return False

        try:
            message = EmailMessage()
            message["Subject"] = subject
            message["From"] = formataddr((settings.EMAIL_FROM_NAME, settings.EMAIL_FROM))
            message["To"] = to_email
            # Explicit no-reply direction for recipients.
            message["Reply-To"] = "no-reply@elementojuris.cloud"
            message.set_content(body)
            message.add_attachment(
                ics_bytes,
                maintype="text",
                subtype="calendar",
                filename="evento-elemento-juris.ics",
                params={"charset": "utf-8", "method": "REQUEST"},
            )
            self._smtp_send(message)
            return True
        except Exception:
            logger.exception("Falha ao enviar e-mail de confirmação de agenda")
            return False
