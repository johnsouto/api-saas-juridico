from fastapi import APIRouter
from fastapi import Depends

from app.api.deps import get_tenant_context
from app.api.deps import require_platform_admin
from app.api.v1.endpoints import (
    agenda_eventos,
    auth,
    billing,
    billing_webhooks,
    clients,
    documents,
    feedback,
    honorarios,
    parcerias,
    platform,
    plans,
    profile,
    processes,
    reports,
    tarefas,
    tenants,
    users,
)


api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(billing_webhooks.router, prefix="/billing", tags=["billing-webhooks"])
api_router.include_router(platform.router, prefix="/platform", tags=["platform"], dependencies=[Depends(require_platform_admin)])
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(users.router, prefix="/users", tags=["users"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(plans.router, prefix="/plans", tags=["plans"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(parcerias.router, prefix="/parcerias", tags=["parcerias"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(processes.router, prefix="/processes", tags=["processes"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(honorarios.router, prefix="/honorarios", tags=["honorarios"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(agenda_eventos.router, prefix="/agenda", tags=["agenda"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(tarefas.router, prefix="/tarefas", tags=["tarefas"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"], dependencies=[Depends(get_tenant_context)])
