# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, status, Query

# pyrefly: ignore [missing-import]
from sqlalchemy import func

# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from sqlalchemy.future import select
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from models.property import Property
from models.user import User
from schemas.property import PropertyCreate, PropertyUpdate, PropertyOut
from schemas.pagination import PaginatedResponse
from api.deps import get_current_user, get_or_404

router = APIRouter()


@router.post("/", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
async def create_property(
    property_in: PropertyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_property = Property(**property_in.model_dump(), owner_id=current_user.id)
    db.add(new_property)
    await db.commit()
    await db.refresh(new_property)
    return new_property


@router.get("/", response_model=PaginatedResponse[PropertyOut])
async def read_properties(
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    is_available: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = select(Property).where(
        Property.deleted_at == None, Property.owner_id == current_user.id
    )
    if is_available is not None:
        base_query = base_query.where(Property.is_available == is_available)

    total = await db.scalar(select(func.count()).select_from(base_query.subquery()))

    query = base_query.offset(skip).limit(limit)
    result = await db.execute(query)
    properties = result.scalars().all()
    return {"items": properties, "total": total}


@router.get("/{id}", response_model=PropertyOut)
async def read_property(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_or_404(db, Property, id, owner_id=current_user.id)


@router.put("/{id}", response_model=PropertyOut)
async def update_property(
    id: UUID,
    property_in: PropertyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_property = await get_or_404(db, Property, id, owner_id=current_user.id)

    update_data = property_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_property, field, value)

    await db.commit()
    await db.refresh(db_property)
    return db_property


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_property = await get_or_404(db, Property, id, owner_id=current_user.id)
    db_property.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return None
