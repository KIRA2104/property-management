from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import date, datetime
from typing import Optional
from decimal import Decimal
from models.payment import PaymentStatus

class PaymentBase(BaseModel):
    agreement_id: UUID
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    payment_date: date
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    status: PaymentStatus = PaymentStatus.pending

class PaymentCreate(PaymentBase):
    pass

class PaymentUpdate(BaseModel):
    status: Optional[PaymentStatus] = None
    notes: Optional[str] = None

class PaymentOut(PaymentBase):
    id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
