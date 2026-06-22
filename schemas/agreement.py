from pydantic import BaseModel, Field, ConfigDict, model_validator
from uuid import UUID
from datetime import date, datetime
from typing import Any, Optional
from decimal import Decimal
from models.agreement import AgreementStatus

class AgreementBase(BaseModel):
    property_id: UUID
    tenant_ids: list[UUID]
    start_date: date
    end_date: date
    agreed_rent: Decimal = Field(..., gt=0, decimal_places=2)
    deposit: Decimal = Field(..., ge=0, decimal_places=2)
    status: AgreementStatus = AgreementStatus.active

class AgreementCreate(AgreementBase):
    @model_validator(mode="before")
    @classmethod
    def accept_legacy_tenant_id(cls, data: Any) -> Any:
        """Keep older frontend bundles working during the tenant_ids rollout."""
        if isinstance(data, dict) and "tenant_ids" not in data and data.get("tenant_id"):
            data = {**data, "tenant_ids": [data["tenant_id"]]}
        return data

    @model_validator(mode="after")
    def check_dates(self) -> "AgreementCreate":
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self

class AgreementUpdate(BaseModel):
    tenant_ids: Optional[list[UUID]] = Field(None, min_length=1)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    agreed_rent: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    deposit: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    status: Optional[AgreementStatus] = None

class AgreementOut(AgreementBase):
    id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
