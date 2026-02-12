from __future__ import annotations

import uuid
from datetime import datetime

from app.schemas.common import APIModel
from app.schemas.tarefa import TarefaOut


class ProcessLastMovementStatusOut(APIModel):
    can_create: bool
    blocking_task_id: uuid.UUID | None = None
    blocking_task_title: str | None = None
    blocking_due_at: datetime | None = None


class ProcessMovementOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    client_id: uuid.UUID
    process_id: uuid.UUID
    task_id: uuid.UUID | None
    title: str
    due_at: datetime
    document_id: uuid.UUID | None
    created_at: datetime


class ProcessLastMovementCreateOut(APIModel):
    ok: bool = True
    movement: ProcessMovementOut
    task: TarefaOut
