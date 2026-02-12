from __future__ import annotations

import uuid

from pydantic import Field

from app.schemas.common import APIModel


class ClientPartnershipsUpdate(APIModel):
    partnership_ids: list[uuid.UUID] = Field(default_factory=list)
