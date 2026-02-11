from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.utils.validators import only_digits


router = APIRouter()


def _normalize_optional_str(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip()
    return v if v else None


@router.patch("/me", response_model=ProfileOut)
async def update_my_profile(
    payload: ProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(get_current_user)],
):
    user = (await db.execute(select(User).where(User.id == current.id))).scalar_one_or_none()
    if not user:
        raise NotFoundError("Usuário não encontrado")

    tenant = (await db.execute(select(Tenant).where(Tenant.id == current.tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundError("Tenant não encontrado")

    data = payload.model_dump(exclude_unset=True)

    # User
    if "first_name" in data:
        user.first_name = _normalize_optional_str(payload.first_name)
    if "last_name" in data:
        user.last_name = _normalize_optional_str(payload.last_name)
    if "oab_number" in data:
        user.oab_number = _normalize_optional_str(payload.oab_number)

    # Keep legacy full name in sync for older parts of the app.
    if user.first_name or user.last_name:
        full = " ".join([p for p in [(user.first_name or "").strip(), (user.last_name or "").strip()] if p]).strip()
        if full:
            user.nome = full

    # Tenant address
    if "address_street" in data:
        tenant.address_street = _normalize_optional_str(payload.address_street)
    if "address_number" in data:
        tenant.address_number = _normalize_optional_str(payload.address_number)
    if "address_complement" in data:
        tenant.address_complement = _normalize_optional_str(payload.address_complement)
    if "address_neighborhood" in data:
        tenant.address_neighborhood = _normalize_optional_str(payload.address_neighborhood)
    if "address_city" in data:
        tenant.address_city = _normalize_optional_str(payload.address_city)
    if "address_state" in data:
        uf = _normalize_optional_str(payload.address_state)
        if uf is not None:
            uf = uf.upper()
            if len(uf) != 2 or not uf.isalpha():
                raise BadRequestError("UF inválida. Use 2 letras (ex: SP).")
        tenant.address_state = uf
    if "address_zip" in data:
        cep = _normalize_optional_str(payload.address_zip)
        if cep is not None:
            digits = only_digits(cep)
            if len(digits) != 8:
                raise BadRequestError("CEP inválido. Use 8 dígitos (ex: 01001000).")
            cep = digits
        tenant.address_zip = cep

    db.add_all([user, tenant])
    await db.commit()
    await db.refresh(user)
    await db.refresh(tenant)
    return ProfileOut(user=user, tenant=tenant)

