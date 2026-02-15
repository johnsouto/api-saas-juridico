from __future__ import annotations

import csv
import os
import secrets
import tempfile
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import AsyncSessionLocal
from app.models.agenda_evento import AgendaEvento
from app.models.client import Client
from app.models.document import Document
from app.models.enums import PlanCode, SubscriptionStatus
from app.models.honorario import Honorario
from app.models.parceria import Parceria
from app.models.process import Process
from app.models.subscription import Subscription
from app.models.tarefa import Tarefa
from app.models.tenant import Tenant
from app.models.tenant_export import TenantExport
from app.models.user import User
from app.services.action_audit_service import log_security_action
from app.services.email_service import EmailService
from app.services.s3_service import S3Service
from app.utils.slug import normalize_slug


EXPORT_STATUS_PENDING = "PENDING"
EXPORT_STATUS_RUNNING = "RUNNING"
EXPORT_STATUS_READY = "READY"
EXPORT_STATUS_FAILED = "FAILED"
EXPORT_STATUS_EXPIRED = "EXPIRED"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _fmt_date_br(value: datetime | None) -> str:
    if not value:
        return "-"
    return value.astimezone(timezone.utc).strftime("%d/%m/%Y")


def _as_iso(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _safe_part(value: str | None, fallback: str) -> str:
    if not value:
        return fallback
    slug = normalize_slug(value)
    return slug or fallback


def _safe_filename(value: str | None, fallback: str = "arquivo.bin") -> str:
    raw = (value or "").replace("\\", "_").replace("/", "_").strip()
    if not raw:
        return fallback
    return raw[:180]


@dataclass(frozen=True)
class ExportRateLimitError(Exception):
    latest_export: TenantExport | None
    retry_after_seconds: int


class TenantExportService:
    def __init__(self) -> None:
        self._s3 = S3Service()
        self._email = EmailService()

    async def _require_plus_tenant(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> Subscription:
        sub = (await db.execute(select(Subscription).where(Subscription.tenant_id == tenant_id))).scalar_one_or_none()
        if not sub:
            raise ForbiddenError("Exportação completa disponível apenas para o Plano Plus.")

        now = _utcnow()
        if sub.plan_code == PlanCode.FREE:
            raise ForbiddenError("Exportação completa disponível apenas para o Plano Plus.")

        if sub.status == SubscriptionStatus.active and (sub.current_period_end is None or now <= sub.current_period_end):
            return sub
        if sub.status == SubscriptionStatus.past_due and sub.grace_period_end and now <= sub.grace_period_end:
            return sub

        raise ForbiddenError("Exportação completa disponível apenas para o Plano Plus ativo.")

    async def _latest_export(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> TenantExport | None:
        stmt = (
            select(TenantExport)
            .where(TenantExport.tenant_id == tenant_id)
            .order_by(TenantExport.criado_em.desc())
            .limit(1)
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    async def request_export(
        self,
        db: AsyncSession,
        *,
        tenant_id: uuid.UUID,
        requested_by_user_id: uuid.UUID,
        note: str | None = None,
        enforce_rate_limit: bool = True,
    ) -> TenantExport:
        await self._require_plus_tenant(db, tenant_id=tenant_id)
        now = _utcnow()
        latest = await self._latest_export(db, tenant_id=tenant_id)
        if enforce_rate_limit and latest:
            elapsed = now - latest.criado_em
            if elapsed < timedelta(hours=24):
                retry_after_seconds = max(1, int((timedelta(hours=24) - elapsed).total_seconds()))
                raise ExportRateLimitError(latest_export=latest, retry_after_seconds=retry_after_seconds)

        exp = TenantExport(
            tenant_id=tenant_id,
            requested_by_user_id=requested_by_user_id,
            status=EXPORT_STATUS_PENDING,
            started_at=None,
            finished_at=None,
            expires_at=now + timedelta(days=14),
            file_key=None,
            file_size_bytes=None,
            error_message=None,
            downloaded_at=None,
            email_sent_at=None,
            email_confirm_token=secrets.token_urlsafe(32),
            email_confirmed_at=None,
            email_confirmed_ip=None,
            note=note,
        )
        db.add(exp)
        await db.commit()
        await db.refresh(exp)
        return exp

    async def get_export_for_tenant(self, db: AsyncSession, *, export_id: uuid.UUID, tenant_id: uuid.UUID) -> TenantExport:
        stmt = select(TenantExport).where(TenantExport.id == export_id).where(TenantExport.tenant_id == tenant_id)
        exp = (await db.execute(stmt)).scalar_one_or_none()
        if not exp:
            raise NotFoundError("Exportação não encontrada")
        return exp

    async def mark_expired_if_needed(self, db: AsyncSession, *, exp: TenantExport) -> TenantExport:
        if exp.status == EXPORT_STATUS_READY and exp.expires_at < _utcnow():
            exp.status = EXPORT_STATUS_EXPIRED
            db.add(exp)
            await db.commit()
            await db.refresh(exp)
        return exp

    async def cleanup_expired_exports(self, db: AsyncSession) -> int:
        now = _utcnow()
        stmt = select(TenantExport).where(TenantExport.status == EXPORT_STATUS_READY).where(TenantExport.expires_at < now)
        exports = list((await db.execute(stmt)).scalars().all())
        cleaned = 0
        for exp in exports:
            if exp.file_key:
                try:
                    self._s3.delete_object(key=exp.file_key)
                except Exception:
                    # Best-effort cleanup: never break scheduler due to storage hiccups.
                    pass
            exp.status = EXPORT_STATUS_EXPIRED
            db.add(exp)
            cleaned += 1
        if cleaned:
            await db.commit()
        return cleaned

    async def generate_export_background(self, export_id: uuid.UUID) -> None:
        async with AsyncSessionLocal() as db:
            await self._generate_export(db, export_id=export_id)

    async def _generate_export(self, db: AsyncSession, *, export_id: uuid.UUID) -> None:
        exp = await db.get(TenantExport, export_id)
        if not exp:
            return

        if exp.status not in (EXPORT_STATUS_PENDING, EXPORT_STATUS_RUNNING):
            return

        tenant = (await db.execute(select(Tenant).where(Tenant.id == exp.tenant_id))).scalar_one_or_none()
        requester = (await db.execute(select(User).where(User.id == exp.requested_by_user_id))).scalar_one_or_none()
        if tenant is None or requester is None:
            exp.status = EXPORT_STATUS_FAILED
            exp.error_message = "Tenant ou usuário solicitante não encontrado."
            exp.finished_at = _utcnow()
            db.add(exp)
            await db.commit()
            return

        exp.status = EXPORT_STATUS_RUNNING
        exp.started_at = _utcnow()
        exp.error_message = None
        db.add(exp)
        await db.commit()

        try:
            with tempfile.TemporaryDirectory(prefix="ej-export-") as tmp_dir_raw:
                tmp_dir = Path(tmp_dir_raw)
                root_name = f"ElementoJuris_Export_{_safe_part(tenant.slug, 'tenant')}_{_utcnow().strftime('%Y-%m-%d')}"
                data_dir = tmp_dir / "Dados"
                docs_cache_dir = tmp_dir / "docs-cache"
                data_dir.mkdir(parents=True, exist_ok=True)
                docs_cache_dir.mkdir(parents=True, exist_ok=True)

                await self._write_data_csvs(db, tenant_id=tenant.id, data_dir=data_dir)
                docs_payload = await self._fetch_documents_payload(db, tenant_id=tenant.id)

                zip_path = tmp_dir / f"{exp.id}.zip"
                with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
                    zf.writestr(
                        f"{root_name}/README.txt",
                        (
                            "Exportação gerada pelo Elemento Juris.\n"
                            "Conteúdo: dados do escritório em CSV e documentos organizados por cliente/processo.\n"
                            "Mantenha este arquivo em local seguro.\n"
                        ),
                    )

                    for csv_file in data_dir.glob("*.csv"):
                        zf.write(csv_file, arcname=f"{root_name}/Dados/{csv_file.name}")

                    for payload in docs_payload:
                        await self._append_document_to_zip(
                            zf,
                            docs_cache_dir=docs_cache_dir,
                            root_name=root_name,
                            payload=payload,
                        )

                file_size = int(os.path.getsize(zip_path))
                file_key = f"exports/{tenant.id}/{exp.id}.zip"
                with zip_path.open("rb") as fp:
                    self._s3.upload_fileobj(key=file_key, fileobj=fp, content_type="application/zip")

            exp.status = EXPORT_STATUS_READY
            exp.finished_at = _utcnow()
            exp.file_key = file_key
            exp.file_size_bytes = file_size
            exp.error_message = None
            db.add(exp)
            await log_security_action(
                db,
                action="EXPORT_READY",
                user=requester,
                tenant_id=tenant.id,
                request=None,
                metadata={
                    "export_id": exp.id,
                    "file_key": file_key,
                    "file_size_bytes": file_size,
                    "expires_at": exp.expires_at,
                },
            )
            await db.commit()

            sent = self._send_ready_email(requester=requester, exp=exp)
            if sent:
                exp.email_sent_at = _utcnow()
                db.add(exp)
                await db.commit()
        except Exception as exc:
            await db.rollback()
            exp = await db.get(TenantExport, export_id)
            if exp:
                exp.status = EXPORT_STATUS_FAILED
                exp.finished_at = _utcnow()
                exp.error_message = str(exc)[:1500]
                db.add(exp)
                await db.commit()

    async def _write_data_csvs(self, db: AsyncSession, *, tenant_id: uuid.UUID, data_dir: Path) -> None:
        clients = list(
            (await db.execute(select(Client).where(Client.tenant_id == tenant_id).order_by(Client.criado_em.asc()))).scalars().all()
        )
        processes = list(
            (await db.execute(select(Process).where(Process.tenant_id == tenant_id).order_by(Process.criado_em.asc()))).scalars().all()
        )
        partnerships = list(
            (await db.execute(select(Parceria).where(Parceria.tenant_id == tenant_id).order_by(Parceria.criado_em.asc()))).scalars().all()
        )
        honorarios = list(
            (await db.execute(select(Honorario).where(Honorario.tenant_id == tenant_id).order_by(Honorario.criado_em.asc()))).scalars().all()
        )
        agenda = list(
            (await db.execute(select(AgendaEvento).where(AgendaEvento.tenant_id == tenant_id).order_by(AgendaEvento.criado_em.asc()))).scalars().all()
        )
        tarefas = list(
            (await db.execute(select(Tarefa).where(Tarefa.tenant_id == tenant_id).order_by(Tarefa.criado_em.asc()))).scalars().all()
        )
        documents = list(
            (await db.execute(select(Document).where(Document.tenant_id == tenant_id).order_by(Document.criado_em.asc()))).scalars().all()
        )

        self._write_csv(
            data_dir / "clientes.csv",
            ["id", "nome", "tipo_documento", "documento", "email", "telefone", "criado_em"],
            [
                [c.id, c.nome, c.tipo_documento.value, c.documento, c.email or "", c.phone_mobile or "", _as_iso(c.criado_em)]
                for c in clients
            ],
        )
        self._write_csv(
            data_dir / "processos.csv",
            ["id", "numero", "status", "nicho", "client_id", "parceria_id", "criado_em"],
            [
                [p.id, p.numero, p.status, p.nicho or "", p.client_id, p.parceria_id or "", _as_iso(p.criado_em)]
                for p in processes
            ],
        )
        self._write_csv(
            data_dir / "parcerias.csv",
            ["id", "nome", "email", "telefone", "tipo_documento", "documento", "criado_em"],
            [
                [p.id, p.nome, p.email or "", p.telefone or "", p.tipo_documento.value, p.documento, _as_iso(p.criado_em)]
                for p in partnerships
            ],
        )
        self._write_csv(
            data_dir / "honorarios.csv",
            ["id", "client_id", "process_id", "valor", "data_vencimento", "status", "criado_em"],
            [
                [h.id, h.client_id, h.process_id or "", h.valor, h.data_vencimento.isoformat(), h.status.value, _as_iso(h.criado_em)]
                for h in honorarios
            ],
        )
        self._write_csv(
            data_dir / "agenda.csv",
            ["id", "titulo", "tipo", "inicio_em", "fim_em", "client_id", "process_id", "descricao"],
            [
                [a.id, a.titulo, a.tipo, _as_iso(a.inicio_em), _as_iso(a.fim_em), a.client_id or "", a.process_id or "", a.descricao or ""]
                for a in agenda
            ],
        )
        self._write_csv(
            data_dir / "tarefas.csv",
            ["id", "titulo", "status", "prazo_em", "client_id", "responsavel_id", "related_process_id"],
            [
                [t.id, t.titulo, t.status.value, _as_iso(t.prazo_em), t.client_id or "", t.responsavel_id or "", t.related_process_id or ""]
                for t in tarefas
            ],
        )
        self._write_csv(
            data_dir / "documentos.csv",
            ["id", "filename", "categoria", "mime_type", "size_bytes", "client_id", "process_id", "honorario_id", "s3_key"],
            [
                [
                    d.id,
                    d.filename,
                    d.categoria or "",
                    d.mime_type or "",
                    d.size_bytes,
                    d.client_id or "",
                    d.process_id or "",
                    d.honorario_id or "",
                    d.s3_key,
                ]
                for d in documents
            ],
        )

    def _write_csv(self, path: Path, header: list[str], rows: list[list[Any]]) -> None:
        with path.open("w", newline="", encoding="utf-8") as fp:
            writer = csv.writer(fp)
            writer.writerow(header)
            for row in rows:
                writer.writerow([_as_iso(v) for v in row])

    async def _fetch_documents_payload(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> list[dict[str, Any]]:
        stmt = (
            select(Document, Client.nome, Process.numero)
            .outerjoin(Client, Client.id == Document.client_id)
            .outerjoin(Process, Process.id == Document.process_id)
            .where(Document.tenant_id == tenant_id)
            .order_by(Document.criado_em.asc())
        )
        rows = (await db.execute(stmt)).all()
        payloads: list[dict[str, Any]] = []
        for doc, client_name, process_number in rows:
            payloads.append(
                {
                    "id": doc.id,
                    "s3_key": doc.s3_key,
                    "filename": doc.filename,
                    "categoria": doc.categoria,
                    "client_name": client_name,
                    "client_id": doc.client_id,
                    "process_number": process_number,
                    "process_id": doc.process_id,
                }
            )
        return payloads

    async def _append_document_to_zip(
        self,
        zf: zipfile.ZipFile,
        *,
        docs_cache_dir: Path,
        root_name: str,
        payload: dict[str, Any],
    ) -> None:
        cache_path = docs_cache_dir / f"{payload['id']}.bin"
        body = None
        try:
            obj = self._s3.get_object(key=str(payload["s3_key"]))
            body = obj.get("Body")
            with cache_path.open("wb") as fp:
                while True:
                    chunk = body.read(1024 * 1024)
                    if not chunk:
                        break
                    fp.write(chunk)
        finally:
            if body is not None:
                try:
                    body.close()
                except Exception:
                    pass

        category = _safe_part(str(payload.get("categoria") or "sem-categoria"), "sem-categoria")
        client_folder = f"{_safe_part(str(payload.get('client_name') or 'sem-cliente'), 'sem-cliente')}_{payload.get('client_id') or 'none'}"
        filename = _safe_filename(str(payload.get("filename") or "arquivo.bin"))
        client_arcname = f"{root_name}/Documentos/Clientes/{client_folder}/{category}/{filename}"
        zf.write(cache_path, arcname=client_arcname)

        process_id = payload.get("process_id")
        if process_id:
            process_folder = f"{_safe_part(str(payload.get('process_number') or 'processo'), 'processo')}_{process_id}"
            process_arcname = f"{root_name}/Documentos/Processos/{process_folder}/{category}/{filename}"
            if process_arcname != client_arcname:
                zf.write(cache_path, arcname=process_arcname)

        try:
            cache_path.unlink(missing_ok=True)
        except Exception:
            pass

    def _send_ready_email(self, *, requester: User, exp: TenantExport) -> bool:
        base = settings.PUBLIC_APP_URL.rstrip("/")
        expires_label = _fmt_date_br(exp.expires_at)
        access_link = f"{base}/exports/{exp.id}"
        confirm_link = f"{base}/api/v1/exports/tenant/{exp.id}/confirm-email?token={exp.email_confirm_token}"
        subject = "📦 Sua exportação do Elemento Juris está pronta"
        body = (
            "Olá,\n\n"
            "Sua exportação completa do Elemento Juris já está pronta.\n\n"
            f"Acesse para baixar: {access_link}\n"
            f"Data de expiração: {expires_label}\n\n"
            "Confirme o recebimento deste e-mail:\n"
            f"{confirm_link}\n\n"
            "Não é necessário responder este e-mail.\n\n"
            "Atenciosamente,\n"
            "Equipe Elemento Juris"
        )
        return self._email.send_generic_email_sync(to_emails=[requester.email], subject=subject, body=body)
