from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from decimal import Decimal

class PropertyBase(BaseModel):
    name: str = Field(..., min_length=1)
    address: str = Field(..., min_length=5)
    description: Optional[str] = None
    monthly_rent: Decimal = Field(..., gt=0, decimal_places=2)
    is_available: bool = True

class PropertyCreate(PropertyBase):
    pass

class PropertyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    address: Optional[str] = Field(None, min_length=5)
    description: Optional[str] = None
    monthly_rent: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    is_available: Optional[bool] = None

class PropertyOut(PropertyBase):
    id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
