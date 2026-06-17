from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from models.payment import Payment
from models.agreement import RentalAgreement
from models.user import User
from schemas.payment import PaymentCreate, PaymentUpdate, PaymentOut
from api.deps import get_current_user, get_or_404

router = APIRouter()

@router.post("/", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payment_in: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify agreement exists and belongs to user
    await get_or_404(db, RentalAgreement, payment_in.agreement_id, owner_id=current_user.id)
    
    new_payment = Payment(**payment_in.model_dump(), owner_id=current_user.id)
    db.add(new_payment)
    await db.commit()
    await db.refresh(new_payment)
    return new_payment

@router.get("/", response_model=List[PaymentOut])
async def read_payments(
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    agreement_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Payment).where(
        Payment.deleted_at == None,
        Payment.owner_id == current_user.id
    ).offset(skip).limit(limit)
    if agreement_id:
        query = query.where(Payment.agreement_id == agreement_id)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{id}", response_model=PaymentOut)
async def read_payment(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await get_or_404(db, Payment, id, owner_id=current_user.id)

@router.patch("/{id}", response_model=PaymentOut)
async def update_payment_status(
    id: UUID,
    payment_in: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only allow updating status and notes (immutable financial record rule)
    db_payment = await get_or_404(db, Payment, id, owner_id=current_user.id)
    
    if payment_in.status:
        db_payment.status = payment_in.status
    if payment_in.notes:
        db_payment.notes = payment_in.notes
        
    await db.commit()
    await db.refresh(db_payment)
    return db_payment

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_payment = await get_or_404(db, Payment, id, owner_id=current_user.id)
    db_payment.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return None
