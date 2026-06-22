# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, status, Query

# pyrefly: ignore [missing-import]
from sqlalchemy import func

# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from models.payment import Payment, PaymentStatus
from models.agreement import RentalAgreement
from models.user import User
from models.rent_charge import RentCharge, RentChargeStatus
from schemas.payment import PaymentCreate, PaymentUpdate, PaymentOut
from schemas.pagination import PaginatedResponse
from api.deps import get_current_user, get_or_404

router = APIRouter()


@router.post("/", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payment_in: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify agreement exists and belongs to user
    await get_or_404(
        db, RentalAgreement, payment_in.agreement_id, owner_id=current_user.id
    )

    new_payment = Payment(**payment_in.model_dump(), owner_id=current_user.id)

    if payment_in.rent_charge_id and payment_in.status == PaymentStatus.completed:
        rent_charge = await get_or_404(
            db, RentCharge, payment_in.rent_charge_id, owner_id=current_user.id
        )
        rent_charge.amount_paid += payment_in.amount
        if rent_charge.amount_paid >= rent_charge.rent_amount + rent_charge.late_fee:
            rent_charge.status = RentChargeStatus.paid
        elif rent_charge.amount_paid > 0:
            rent_charge.status = RentChargeStatus.partial

    db.add(new_payment)
    await db.commit()
    await db.refresh(new_payment)
    return new_payment


@router.get("/", response_model=PaginatedResponse[PaymentOut])
async def read_payments(
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    agreement_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = select(Payment).where(
        Payment.deleted_at == None, Payment.owner_id == current_user.id
    )
    if agreement_id:
        base_query = base_query.where(Payment.agreement_id == agreement_id)

    total = await db.scalar(select(func.count()).select_from(base_query.subquery()))

    query = base_query.offset(skip).limit(limit)
    result = await db.execute(query)
    payments = result.scalars().all()

    return {"items": payments, "total": total}


@router.get("/{id}", response_model=PaymentOut)
async def read_payment(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_or_404(db, Payment, id, owner_id=current_user.id)


@router.patch("/{id}", response_model=PaymentOut)
async def update_payment_status(
    id: UUID,
    payment_in: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_payment = await get_or_404(db, Payment, id, owner_id=current_user.id)
    old_status = db_payment.status

    if payment_in.status:
        db_payment.status = payment_in.status
        if (
            old_status != PaymentStatus.completed
            and payment_in.status == PaymentStatus.completed
            and db_payment.rent_charge_id
        ):
            rent_charge = await get_or_404(
                db, RentCharge, db_payment.rent_charge_id, owner_id=current_user.id
            )
            rent_charge.amount_paid += db_payment.amount
            if (
                rent_charge.amount_paid
                >= rent_charge.rent_amount + rent_charge.late_fee
            ):
                rent_charge.status = RentChargeStatus.paid
            elif rent_charge.amount_paid > 0:
                rent_charge.status = RentChargeStatus.partial

    if payment_in.notes:
        db_payment.notes = payment_in.notes

    await db.commit()
    await db.refresh(db_payment)
    return db_payment


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_payment = await get_or_404(db, Payment, id, owner_id=current_user.id)
    db_payment.deleted_at = datetime.now(timezone.utc)

    # We could also subtract amount from RentCharge, but typically we keep it immutable or handle it via a credit system. For MVP, just delete.

    await db.commit()
    return None
