from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from models.rent_charge import RentChargeStatus

class RentChargeBase(BaseModel):
    agreement_id: UUID
    billing_month: str
    due_date: date
    rent_amount: Decimal
    late_fee: Decimal = Decimal('0.00')
    amount_paid: Decimal = Decimal('0.00')
    status: RentChargeStatus = RentChargeStatus.upcoming

class RentChargeCreate(RentChargeBase):
    pass

class RentChargeUpdate(BaseModel):
    due_date: Optional[date] = None
    rent_amount: Optional[Decimal] = None
    late_fee: Optional[Decimal] = None
    amount_paid: Optional[Decimal] = None
    status: Optional[RentChargeStatus] = None

class RentChargeOut(RentChargeBase):
    id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
