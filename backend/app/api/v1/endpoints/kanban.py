from __future__ import annotations

from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.enums import TarefaStatus
from app.models.tarefa import Tarefa
from app.models.user import User


router = APIRouter()


@router.get("/summary")
async def kanban_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """
    Lightweight Kanban/task summary for dashboards.

    - due_today: tasks whose prazo_em is today (Brasília tz) and status is pending/in-progress.
    - pendente: tasks with status=pendente
    - em_andamento: tasks with status=em_andamento
    - concluido: tasks with status=concluido
    """
    tz = ZoneInfo("America/Sao_Paulo")
    today_sp = datetime.now(tz).date()

    due_today_cond = (
        Tarefa.prazo_em.is_not(None)
        & Tarefa.status.in_([TarefaStatus.pendente, TarefaStatus.em_andamento])
        & (func.date(func.timezone("America/Sao_Paulo", Tarefa.prazo_em)) == today_sp)
    )

    stmt = (
        select(
            func.count().filter(due_today_cond).label("due_today"),
            func.count().filter(Tarefa.status == TarefaStatus.pendente).label("pendente"),
            func.count().filter(Tarefa.status == TarefaStatus.em_andamento).label("em_andamento"),
            func.count().filter(Tarefa.status == TarefaStatus.concluido).label("concluido"),
        )
        .select_from(Tarefa)
        .where(Tarefa.tenant_id == user.tenant_id)
    )

    row = (await db.execute(stmt)).one()
    m = row._mapping
    return {
        "due_today": int(m["due_today"] or 0),
        "pendente": int(m["pendente"] or 0),
        "em_andamento": int(m["em_andamento"] or 0),
        "concluido": int(m["concluido"] or 0),
    }

