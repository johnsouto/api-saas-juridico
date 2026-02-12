from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.parceria import Parceria


class ClientPartnership(UUIDBaseMixin, Base):
    __tablename__ = "client_partnerships"
    __table_args__ = (UniqueConstraint("tenant_id", "client_id", "partnership_id"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    partnership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("parcerias.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    client: Mapped["Client"] = relationship(back_populates="partnership_links")
    parceria: Mapped["Parceria"] = relationship(back_populates="client_links")
