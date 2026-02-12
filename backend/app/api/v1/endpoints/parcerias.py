from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models.parceria import Parceria
from app.models.process import Process
from app.models.user import User
from app.schemas.parceria import ParceriaCreate, ParceriaOut, ParceriaUpdate
from app.schemas.process import ProcessOut
from app.utils.validators import has_valid_cep_length, has_valid_cnpj_length, has_valid_cpf_length, has_valid_phone_length, only_digits


router = APIRouter()


def _normalize_optional_str(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


@router.get("", response_model=list[ParceriaOut])
async def list_parcerias(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Parceria).where(Parceria.tenant_id == user.tenant_id).order_by(Parceria.criado_em.desc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=ParceriaOut)
async def create_parceria(
    payload: ParceriaCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    documento = only_digits(payload.documento)
    if payload.tipo_documento == "cpf" and not has_valid_cpf_length(documento):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="CPF incompleto. Informe 11 dígitos.")
    if payload.tipo_documento == "cnpj" and not has_valid_cnpj_length(documento):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="CNPJ incompleto. Informe 14 dígitos.")

    telefone = None
    if payload.telefone:
        digits = only_digits(payload.telefone)
        if not has_valid_phone_length(digits):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Telefone incompleto. Informe DDD + número com 11 dígitos.",
            )
        telefone = digits

    oab_uf = _normalize_optional_str(payload.oab_uf)
    if oab_uf is not None:
        oab_uf = oab_uf.upper()
        if len(oab_uf) != 2 or not oab_uf.isalpha():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="UF da OAB inválida. Use 2 letras.")

    address_state = _normalize_optional_str(payload.address_state)
    if address_state is not None:
        address_state = address_state.upper()
        if len(address_state) != 2 or not address_state.isalpha():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="UF inválida. Use 2 letras (ex: SP).")

    address_zip = None
    if payload.address_zip:
        digits = only_digits(payload.address_zip)
        if not has_valid_cep_length(digits):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="CEP incompleto. Informe 8 dígitos.")
        address_zip = digits

    parceria = Parceria(
        tenant_id=user.tenant_id,
        nome=payload.nome,
        email=str(payload.email) if payload.email else None,
        telefone=telefone,
        oab_uf=oab_uf,
        oab_number=_normalize_optional_str(payload.oab_number),
        tipo_documento=payload.tipo_documento,
        documento=documento,
        address_street=_normalize_optional_str(payload.address_street),
        address_number=_normalize_optional_str(payload.address_number),
        address_complement=_normalize_optional_str(payload.address_complement),
        address_neighborhood=_normalize_optional_str(payload.address_neighborhood),
        address_city=_normalize_optional_str(payload.address_city),
        address_state=address_state,
        address_zip=address_zip,
    )
    db.add(parceria)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise BadRequestError("CPF/CNPJ já cadastrado para uma parceria.") from exc
    await db.refresh(parceria)
    return parceria


@router.get("/{parceria_id}", response_model=ParceriaOut)
async def get_parceria(
    parceria_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Parceria).where(Parceria.id == parceria_id).where(Parceria.tenant_id == user.tenant_id)
    parceria = (await db.execute(stmt)).scalar_one_or_none()
    if not parceria:
        raise NotFoundError("Parceria não encontrada")
    return parceria


@router.put("/{parceria_id}", response_model=ParceriaOut)
async def update_parceria(
    parceria_id: uuid.UUID,
    payload: ParceriaUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Parceria).where(Parceria.id == parceria_id).where(Parceria.tenant_id == user.tenant_id)
    parceria = (await db.execute(stmt)).scalar_one_or_none()
    if not parceria:
        raise NotFoundError("Parceria não encontrada")

    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "email":
            setattr(parceria, key, str(value) if value else None)
        elif key == "documento":
            tipo_doc = payload.tipo_documento or parceria.tipo_documento
            digits = only_digits(value) if value else value
            if tipo_doc == "cpf" and not has_valid_cpf_length(digits or ""):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="CPF incompleto. Informe 11 dígitos.",
                )
            if tipo_doc == "cnpj" and not has_valid_cnpj_length(digits or ""):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="CNPJ incompleto. Informe 14 dígitos.",
                )
            setattr(parceria, key, digits)
        elif key == "telefone":
            if value:
                digits = only_digits(value)
                if not has_valid_phone_length(digits):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Telefone incompleto. Informe DDD + número com 11 dígitos.",
                    )
                setattr(parceria, key, digits)
            else:
                setattr(parceria, key, None)
        elif key == "oab_uf":
            if value:
                uf = value.strip().upper()
                if len(uf) != 2 or not uf.isalpha():
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="UF da OAB inválida. Use 2 letras.",
                    )
                setattr(parceria, key, uf)
            else:
                setattr(parceria, key, None)
        elif key == "oab_number":
            setattr(parceria, key, _normalize_optional_str(value))
        elif key == "address_state":
            if value:
                uf = value.strip().upper()
                if len(uf) != 2 or not uf.isalpha():
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="UF inválida. Use 2 letras (ex: SP).",
                    )
                setattr(parceria, key, uf)
            else:
                setattr(parceria, key, None)
        elif key == "address_zip":
            if value:
                digits = only_digits(value)
                if not has_valid_cep_length(digits):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="CEP incompleto. Informe 8 dígitos.",
                    )
                setattr(parceria, key, digits)
            else:
                setattr(parceria, key, None)
        elif key in {
            "address_street",
            "address_number",
            "address_complement",
            "address_neighborhood",
            "address_city",
        }:
            setattr(parceria, key, _normalize_optional_str(value))
        else:
            setattr(parceria, key, value)
    db.add(parceria)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise BadRequestError("CPF/CNPJ já cadastrado para uma parceria.") from exc
    await db.refresh(parceria)
    return parceria


@router.delete("/{parceria_id}")
async def delete_parceria(
    parceria_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Parceria).where(Parceria.id == parceria_id).where(Parceria.tenant_id == user.tenant_id)
    parceria = (await db.execute(stmt)).scalar_one_or_none()
    if not parceria:
        raise NotFoundError("Parceria não encontrada")
    await db.delete(parceria)
    await db.commit()
    return {"message": "Parceria removida"}


@router.get("/{parceria_id}/processes", response_model=list[ProcessOut])
async def list_processes_for_partner(
    parceria_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Process)
        .where(Process.tenant_id == user.tenant_id)
        .where(Process.parceria_id == parceria_id)
        .order_by(Process.criado_em.desc())
    )
    return list((await db.execute(stmt)).scalars().all())
