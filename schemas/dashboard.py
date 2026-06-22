from typing import List
from pydantic import BaseModel

from schemas.property import PropertyOut
from schemas.tenant import TenantOut
from schemas.payment import PaymentOut
from schemas.rent_charge import RentChargeOut

class DashboardData(BaseModel):
    properties: List[PropertyOut]
    tenants: List[TenantOut]
    payments: List[PaymentOut]
    rent_charges: List[RentChargeOut]
