from __future__ import annotations

from pydantic import Field

from app.schemas.common import APIModel
from app.schemas.tenant import TenantOut
from app.schemas.user import UserOut


class ProfileUpdate(APIModel):
    # User fields
    first_name: str | None = Field(default=None, min_length=2, max_length=200)
    last_name: str | None = Field(default=None, min_length=0, max_length=200)
    oab_number: str | None = Field(default=None, max_length=40)

    # Tenant address fields (law firm)
    address_street: str | None = Field(default=None, max_length=200)
    address_number: str | None = Field(default=None, max_length=40)
    address_complement: str | None = Field(default=None, max_length=200)
    address_neighborhood: str | None = Field(default=None, max_length=120)
    address_city: str | None = Field(default=None, max_length=120)
    address_state: str | None = Field(default=None, max_length=2)
    address_zip: str | None = Field(default=None, max_length=16)


class ProfileOut(APIModel):
    user: UserOut
    tenant: TenantOut

