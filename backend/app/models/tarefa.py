from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin
from app.models.enums import TarefaStatus

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.user import User


class Tarefa(UUIDBaseMixin, Base):
    __tablename__ = "tarefas"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    responsavel_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)

    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[TarefaStatus] = mapped_column(Enum(TarefaStatus, name="tarefa_status"), nullable=False, default=TarefaStatus.pendente)
    prazo_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    responsavel: Mapped["User | None"] = relationship()
    client: Mapped["Client | None"] = relationship()
