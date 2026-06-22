# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status, Query

# pyrefly: ignore [missing-import]
from sqlalchemy import func

# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import selectinload

# pyrefly: ignore [missing-import]
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone, date

from db.session import get_db
from models.agreement import RentalAgreement, AgreementStatus
from models.property import Property
from models.tenant import Tenant
from models.user import User
from models.rent_charge import RentCharge
from schemas.agreement import AgreementCreate, AgreementUpdate, AgreementOut
from schemas.pagination import PaginatedResponse
from api.deps import get_current_user, get_or_404

router = APIRouter()


def add_months(current_date: date, months: int) -> date:
    month = current_date.month - 1 + months
    year = current_date.year + month // 12
    month = month % 12 + 1
    day = min(current_date.day, 28)  # simplify
    return current_date.replace(year=year, month=month, day=day)


async def auto_expire_agreements(db: AsyncSession, agreements: List[RentalAgreement]):
    today = date.today()
    expired_any = False
    for agr in agreements:
        if agr.status == AgreementStatus.active and agr.end_date < today:
            agr.status = AgreementStatus.expired
            # Make property available
            db_property = await get_or_404(
                db, Property, agr.property_id, owner_id=agr.owner_id
            )
            db_property.is_available = True
            expired_any = True
    if expired_any:
        await db.commit()


@router.post("/", response_model=AgreementOut, status_code=status.HTTP_201_CREATED)
async def create_agreement(
    agreement_in: AgreementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify property exists and belongs to user
    db_property = await get_or_404(
        db, Property, agreement_in.property_id, owner_id=current_user.id
    )

    # Check for overlapping active agreements
    overlap_query = select(RentalAgreement).where(
        RentalAgreement.property_id == agreement_in.property_id,
        RentalAgreement.status == AgreementStatus.active,
        RentalAgreement.deleted_at == None,
    )
    overlap_result = await db.execute(overlap_query)
    if overlap_result.scalars().first():
        raise HTTPException(
            status_code=409, detail="Property already has an active agreement"
        )

    # Verify tenants exist and belong to user
    tenants = []
    if not agreement_in.tenant_ids:
        raise HTTPException(status_code=400, detail="At least one tenant is required")

    for t_id in agreement_in.tenant_ids:
        t = await get_or_404(db, Tenant, t_id, owner_id=current_user.id)
        tenants.append(t)

    dump_data = agreement_in.model_dump()
    dump_data.pop("tenant_ids", None)

    new_agreement = RentalAgreement(**dump_data, owner_id=current_user.id)
    new_agreement.tenants = tenants

    db.add(new_agreement)

    # Mark property as unavailable
    db_property.is_available = False

    await db.flush()  # flush to generate new_agreement.id

    # Generate RentCharges for the duration
    current_d = agreement_in.start_date
    while current_d <= agreement_in.end_date:
        billing_month = current_d.strftime("%Y-%m")
        charge = RentCharge(
            agreement_id=new_agreement.id,
            billing_month=billing_month,
            due_date=current_d,
            rent_amount=agreement_in.agreed_rent,
            owner_id=current_user.id,
        )
        db.add(charge)
        current_d = add_months(current_d, 1)

    await db.commit()
    await db.refresh(new_agreement)
    return new_agreement


@router.get("/", response_model=PaginatedResponse[AgreementOut])
async def read_agreements(
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    property_id: Optional[UUID] = None,
    tenant_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = (
        select(RentalAgreement)
        .options(selectinload(RentalAgreement.tenants))
        .where(
            RentalAgreement.deleted_at == None,
            RentalAgreement.owner_id == current_user.id,
        )
    )
    if property_id:
        base_query = base_query.where(RentalAgreement.property_id == property_id)
    if tenant_id:
        base_query = base_query.where(
            RentalAgreement.tenants.any(Tenant.id == tenant_id)
        )

    total = await db.scalar(select(func.count()).select_from(base_query.subquery()))

    query = base_query.offset(skip).limit(limit)
    result = await db.execute(query)
    agreements = result.scalars().all()

    await auto_expire_agreements(db, agreements)

    return {"items": agreements, "total": total}


@router.get("/{id}", response_model=AgreementOut)
async def read_agreement(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(RentalAgreement)
        .options(selectinload(RentalAgreement.tenants))
        .where(RentalAgreement.id == id, RentalAgreement.owner_id == current_user.id)
    )
    result = await db.execute(query)
    agr = result.scalars().first()
    if not agr:
        raise HTTPException(status_code=404, detail="Agreement not found")
    await auto_expire_agreements(db, [agr])
    return agr


@router.patch("/{id}", response_model=AgreementOut)
async def update_agreement(
    id: UUID,
    agreement_in: AgreementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(RentalAgreement)
        .options(selectinload(RentalAgreement.tenants))
        .where(RentalAgreement.id == id, RentalAgreement.owner_id == current_user.id)
    )
    result = await db.execute(query)
    db_agreement = result.scalars().first()
    if not db_agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")

    update_data = agreement_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_agreement, field, value)

    if agreement_in.status:
        if (
            agreement_in.status == AgreementStatus.terminated
            or agreement_in.status == AgreementStatus.expired
        ):
            db_property = await get_or_404(
                db, Property, db_agreement.property_id, owner_id=current_user.id
            )
            db_property.is_available = True
        elif agreement_in.status == AgreementStatus.active:
            db_property = await get_or_404(
                db, Property, db_agreement.property_id, owner_id=current_user.id
            )
            db_property.is_available = False

    await db.commit()
    await db.refresh(db_agreement)
    return db_agreement


@router.post("/{id}/terminate", response_model=AgreementOut)
async def terminate_agreement(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(RentalAgreement)
        .options(selectinload(RentalAgreement.tenants))
        .where(RentalAgreement.id == id, RentalAgreement.owner_id == current_user.id)
    )
    result = await db.execute(query)
    db_agreement = result.scalars().first()
    if not db_agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if db_agreement.status != AgreementStatus.active:
        raise HTTPException(
            status_code=400, detail="Only active agreements can be terminated"
        )

    db_agreement.status = AgreementStatus.terminated
    db_property = await get_or_404(
        db, Property, db_agreement.property_id, owner_id=current_user.id
    )
    db_property.is_available = True

    await db.commit()
    await db.refresh(db_agreement)
    return db_agreement


@router.post("/{id}/renew", response_model=AgreementOut)
async def renew_agreement(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(RentalAgreement)
        .options(selectinload(RentalAgreement.tenants))
        .where(RentalAgreement.id == id, RentalAgreement.owner_id == current_user.id)
    )
    result = await db.execute(query)
    agr = result.scalars().first()
    if not agr:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if agr.status == AgreementStatus.active:
        raise HTTPException(status_code=400, detail="Agreement is already active")

    # Check overlap
    overlap_query = select(RentalAgreement).where(
        RentalAgreement.property_id == agr.property_id,
        RentalAgreement.status == AgreementStatus.active,
        RentalAgreement.deleted_at == None,
    )
    if (await db.execute(overlap_query)).scalars().first():
        raise HTTPException(
            status_code=409, detail="Property already has an active agreement"
        )

    # Renew by extending by 1 year and generating new rent charges
    today = date.today()
    if agr.end_date < today:
        agr.start_date = today
        agr.end_date = add_months(today, 12)

    agr.status = AgreementStatus.active
    db_property = await get_or_404(
        db, Property, agr.property_id, owner_id=current_user.id
    )
    db_property.is_available = False

    # Generate new rent charges
    current_d = agr.start_date
    while current_d <= agr.end_date:
        billing_month = current_d.strftime("%Y-%m")
        charge = RentCharge(
            agreement_id=agr.id,
            billing_month=billing_month,
            due_date=current_d,
            rent_amount=agr.agreed_rent,
            owner_id=current_user.id,
        )
        db.add(charge)
        current_d = add_months(current_d, 1)

    await db.commit()
    await db.refresh(agr)
    return agr


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agreement(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_agreement = await get_or_404(db, RentalAgreement, id, owner_id=current_user.id)
    db_agreement.deleted_at = datetime.now(timezone.utc)

    if db_agreement.status == AgreementStatus.active:
        db_property = await get_or_404(
            db, Property, db_agreement.property_id, owner_id=current_user.id
        )
        db_property.is_available = True

    await db.commit()
    return None
