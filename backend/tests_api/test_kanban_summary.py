from __future__ import annotations

import httpx


async def test_kanban_summary_requires_auth(api_client: httpx.AsyncClient):
    r = await api_client.get("/api/v1/kanban/summary")
    assert r.status_code == 401


async def test_kanban_summary_shape(auth_client: httpx.AsyncClient):
    r = await auth_client.get("/api/v1/kanban/summary")
    r.raise_for_status()
    payload = r.json()

    assert set(payload.keys()) == {"due_today", "pendente", "em_andamento", "concluido"}
    for k in ("due_today", "pendente", "em_andamento", "concluido"):
        assert isinstance(payload[k], int)
        assert payload[k] >= 0
