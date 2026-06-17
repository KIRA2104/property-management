from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from models.agreement import RentalAgreement, AgreementStatus
from models.property import Property
from models.tenant import Tenant
from models.user import User
from schemas.agreement import AgreementCreate, AgreementUpdate, AgreementOut
from api.deps import get_current_user, get_or_404

router = APIRouter()

@router.post("/", response_model=AgreementOut, status_code=status.HTTP_201_CREATED)
async def create_agreement(
    agreement_in: AgreementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify property exists, is available, and belongs to user
    db_property = await get_or_404(db, Property, agreement_in.property_id, owner_id=current_user.id)
    if not db_property.is_available:
        raise HTTPException(status_code=409, detail="Property is not available for rent")
        
    # Verify tenant exists and belongs to user
    await get_or_404(db, Tenant, agreement_in.tenant_id, owner_id=current_user.id)
    
    new_agreement = RentalAgreement(**agreement_in.model_dump(), owner_id=current_user.id)
    db.add(new_agreement)
    
    # Mark property as unavailable
    db_property.is_available = False
    
    await db.commit()
    await db.refresh(new_agreement)
    return new_agreement

@router.get("/", response_model=List[AgreementOut])
async def read_agreements(
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    property_id: Optional[UUID] = None,
    tenant_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(RentalAgreement).where(
        RentalAgreement.deleted_at == None,
        RentalAgreement.owner_id == current_user.id
    ).offset(skip).limit(limit)
    if property_id:
        query = query.where(RentalAgreement.property_id == property_id)
    if tenant_id:
        query = query.where(RentalAgreement.tenant_id == tenant_id)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{id}", response_model=AgreementOut)
async def read_agreement(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await get_or_404(db, RentalAgreement, id, owner_id=current_user.id)

@router.patch("/{id}", response_model=AgreementOut)
async def update_agreement(
    id: UUID,
    agreement_in: AgreementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_agreement = await get_or_404(db, RentalAgreement, id, owner_id=current_user.id)
    
    if agreement_in.status:
        db_agreement.status = agreement_in.status
        if agreement_in.status == AgreementStatus.terminated:
            # Mark property back as available
            db_property = await get_or_404(db, Property, db_agreement.property_id, owner_id=current_user.id)
            db_property.is_available = True

    await db.commit()
    await db.refresh(db_agreement)
    return db_agreement

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agreement(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_agreement = await get_or_404(db, RentalAgreement, id, owner_id=current_user.id)
    db_agreement.deleted_at = datetime.now(timezone.utc)
    
    # If it was active, make property available again
    if db_agreement.status == AgreementStatus.active:
        db_property = await get_or_404(db, Property, db_agreement.property_id, owner_id=current_user.id)
        db_property.is_available = True
        
    await db.commit()
    return None
