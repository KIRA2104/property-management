# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status, Query

# pyrefly: ignore [missing-import]
from sqlalchemy import func

# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from models.tenant import Tenant
from models.user import User
from schemas.tenant import TenantCreate, TenantUpdate, TenantOut
from schemas.pagination import PaginatedResponse
from api.deps import get_current_user, get_or_404

router = APIRouter()


@router.post("/", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_in: TenantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check email uniqueness for tenants (scoped to the owner, or global? Let's make it global for the platform or scoped to owner? It's scoped to owner makes more sense, but the schema has unique=True on email. Wait, email=Column(String, unique=True). If unique=True, it's global. Let's just keep the global check.)
    result = await db.execute(
        select(Tenant).where(Tenant.email == tenant_in.email, Tenant.deleted_at == None)
    )
    if result.scalars().first():
        raise HTTPException(
            status_code=409, detail="Tenant with this email already exists"
        )

    new_tenant = Tenant(**tenant_in.model_dump(), owner_id=current_user.id)
    db.add(new_tenant)
    await db.commit()
    await db.refresh(new_tenant)
    return new_tenant


@router.get("/", response_model=PaginatedResponse[TenantOut])
async def read_tenants(
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = select(Tenant).where(
        Tenant.deleted_at == None, Tenant.owner_id == current_user.id
    )

    total = await db.scalar(select(func.count()).select_from(base_query.subquery()))

    query = base_query.offset(skip).limit(limit)
    result = await db.execute(query)
    tenants = result.scalars().all()

    return {"items": tenants, "total": total}


@router.get("/{id}", response_model=TenantOut)
async def read_tenant(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_or_404(db, Tenant, id, owner_id=current_user.id)


@router.patch("/{id}", response_model=TenantOut)
async def update_tenant(
    id: UUID,
    tenant_in: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_tenant = await get_or_404(db, Tenant, id, owner_id=current_user.id)

    update_data = tenant_in.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] != db_tenant.email:
        result = await db.execute(
            select(Tenant).where(
                Tenant.email == update_data["email"], Tenant.deleted_at == None
            )
        )
        if result.scalars().first():
            raise HTTPException(
                status_code=409, detail="Tenant with this email already exists"
            )

    for field, value in update_data.items():
        setattr(db_tenant, field, value)

    await db.commit()
    await db.refresh(db_tenant)
    return db_tenant


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_tenant = await get_or_404(db, Tenant, id, owner_id=current_user.id)
    db_tenant.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return None
