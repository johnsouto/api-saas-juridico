from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.schemas.platform import PlatformTenantCreate, PlatformTenantCreatedOut, PlatformTenantListItem, PlatformTrialTenantCreate
from app.schemas.tenant import TenantOut
from app.schemas.token import TokenPair
from app.schemas.user import UserOut
from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from app.services.plan_limit_service import PlanLimitService
from app.services.platform_service import PlatformService


router = APIRouter()

_auth_service = AuthService(email_service=EmailService(), plan_limit_service=PlanLimitService())
_platform_service = PlatformService(email_service=EmailService())


@router.get("/tenants", response_model=list[PlatformTenantListItem])
async def list_tenants(db: Annotated[AsyncSession, Depends(get_db)]):
    """
    List tenants for the SaaS operator.

    Note: this endpoint is protected by PLATFORM_ADMIN_KEY.
    """
    tenants = list((await db.execute(select(Tenant).order_by(Tenant.criado_em.desc()))).scalars().all())
    items: list[PlatformTenantListItem] = []
    for t in tenants:
        sub_stmt = (
            select(Subscription, Plan)
            .join(Plan, Plan.id == Subscription.plan_id)
            .where(Subscription.tenant_id == t.id)
            .order_by(Subscription.criado_em.desc())
            .limit(1)
        )
        row = (await db.execute(sub_stmt)).first()
        if row:
            sub, plan = row
            items.append(
                PlatformTenantListItem(
                    id=t.id,
                    nome=t.nome,
                    cnpj=t.cnpj,
                    tipo_documento=t.tipo_documento.value if hasattr(t.tipo_documento, "value") else str(t.tipo_documento),
                    documento=t.documento,
                    slug=t.slug,
                    criado_em=t.criado_em,
                    plan_nome=plan.nome,
                    subscription_status=sub.status.value if hasattr(sub.status, "value") else str(sub.status),
                    subscription_ativo=sub.ativo,
                    subscription_validade=sub.validade,
                )
            )
        else:
            items.append(
                PlatformTenantListItem(
                    id=t.id,
                    nome=t.nome,
                    cnpj=t.cnpj,
                    tipo_documento=t.tipo_documento.value if hasattr(t.tipo_documento, "value") else str(t.tipo_documento),
                    documento=t.documento,
                    slug=t.slug,
                    criado_em=t.criado_em,
                    plan_nome=None,
                    subscription_status=None,
                    subscription_ativo=None,
                    subscription_validade=None,
                )
            )
    return items


@router.post("/tenants", response_model=PlatformTenantCreatedOut)
async def create_tenant(
    payload: PlatformTenantCreate,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Provision a new tenant + admin user.

    This is the operator equivalent of /auth/register-tenant.
    """
    tenant, admin_user, access, refresh = await _auth_service.register_tenant(
        db,
        background,
        tenant_nome=payload.tenant_nome,
        tenant_tipo_documento=payload.tenant_tipo_documento,
        tenant_documento=payload.tenant_documento,
        tenant_slug=payload.tenant_slug,
        admin_nome=payload.admin_nome,
        admin_email=str(payload.admin_email),
        admin_senha=payload.admin_senha,
    )
    return PlatformTenantCreatedOut(
        tenant=TenantOut.model_validate(tenant),
        admin_user=UserOut.model_validate(admin_user),
        tokens=TokenPair(access_token=access, refresh_token=refresh),
    )


@router.post("/tenants/trial", response_model=PlatformTenantCreatedOut)
async def create_trial_tenant(
    payload: PlatformTrialTenantCreate,
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Operator creates a FREE tenant for testing and sends a first-access invite link by email.
    """
    app_base_url = request.headers.get("origin") or f"{request.url.scheme}://{request.headers.get('host')}"
    tenant, admin_user = await _platform_service.create_trial_tenant(
        db,
        background,
        tenant_nome=payload.tenant_nome,
        tenant_tipo_documento=payload.tenant_tipo_documento,
        tenant_documento=payload.tenant_documento,
        tenant_slug=payload.tenant_slug,
        admin_nome=payload.admin_nome,
        admin_email=str(payload.admin_email),
        app_base_url=app_base_url,
    )
    # Tokens are not returned here (first access is via invite link); but keep response shape stable.
    return PlatformTenantCreatedOut(
        tenant=TenantOut.model_validate(tenant),
        admin_user=UserOut.model_validate(admin_user),
        tokens=TokenPair(access_token="", refresh_token=""),
    )
