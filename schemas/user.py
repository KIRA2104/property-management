from pydantic import BaseModel, EmailStr, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)

class UserCreate(UserBase):
    password: str = Field(..., min_length=10, description="Password must be at least 10 characters long")

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    password: Optional[str] = Field(None, min_length=10)
    is_active: Optional[bool] = None

class UserOut(UserBase):
    id: UUID
    created_at: datetime
    is_active: bool
    is_superuser: bool
    
    model_config = ConfigDict(from_attributes=True)
