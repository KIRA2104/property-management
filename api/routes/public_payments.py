import os
from dotenv import load_dotenv

load_dotenv()
# pyrefly: ignore [missing-import]
import razorpay

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException  # noqa: E402

# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from sqlalchemy.future import select  # noqa: F401

# pyrefly: ignore [missing-import]
from sqlalchemy import or_  # noqa: F401

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import selectinload  # noqa: F401

# pyrefly: ignore [missing-import]
from uuid import UUID  # noqa: F401
from pydantic import BaseModel

# pyrefly: ignore [missing-import]
from typing import Optional  # noqa: F401
from datetime import datetime, timezone, date, timedelta

from api.deps import get_db
from models.agreement import RentalAgreement
from models.rent_charge import RentCharge, RentChargeStatus
from models.payment import Payment

router = APIRouter()


def get_razorpay_client():
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise HTTPException(status_code=500, detail="Razorpay keys not configured")
    return razorpay.Client(auth=(key_id, key_secret))


class ChargeBreakdown(BaseModel):
    id: UUID
    billing_month: str
    amount: float
    late_fee: float
    total: float


class PublicBalanceResponse(BaseModel):
    property_name: str
    total_due: float
    charges_count: int
    razorpay_key_id: Optional[str] = None
    breakdown: list[ChargeBreakdown] = []


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: float
    currency: str


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    amount: float


@router.get("/{agreement_id}/balance", response_model=PublicBalanceResponse)
async def get_public_balance(agreement_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RentalAgreement)
        .options(selectinload(RentalAgreement.property))
        .where(RentalAgreement.id == agreement_id, RentalAgreement.deleted_at == None)
    )
    agreement = result.scalars().first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")

    charges_result = await db.execute(
        select(RentCharge)
        .where(
            RentCharge.agreement_id == agreement_id,
            or_(
                RentCharge.status.in_(
                    [
                        RentChargeStatus.due,
                        RentChargeStatus.overdue,
                        RentChargeStatus.partial,
                    ]
                ),
                (RentCharge.status == RentChargeStatus.upcoming)
                & (RentCharge.due_date <= date.today() + timedelta(days=7)),
            ),
            RentCharge.deleted_at == None,
        )
        .order_by(RentCharge.due_date.asc())
        .limit(1)
    )
    charge = charges_result.scalars().first()

    if not charge:
        total_due = 0.0
        breakdown = []
        count = 0
    else:
        charge_total = float(charge.rent_amount + charge.late_fee - charge.amount_paid)
        total_due = charge_total
        count = 1

        from datetime import datetime

        month_date = datetime.strptime(charge.billing_month, "%Y-%m")
        formatted_month = month_date.strftime("%B %Y")

        breakdown = [
            ChargeBreakdown(
                id=charge.id,
                billing_month=formatted_month,
                amount=float(charge.rent_amount),
                late_fee=float(charge.late_fee),
                total=charge_total,
            )
        ]

    return PublicBalanceResponse(
        property_name=agreement.property.name,
        total_due=total_due,
        charges_count=count,
        razorpay_key_id=os.getenv("RAZORPAY_KEY_ID"),
        breakdown=breakdown,
    )


@router.post("/{agreement_id}/create-order", response_model=CreateOrderResponse)
async def create_razorpay_order(agreement_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RentalAgreement).where(
            RentalAgreement.id == agreement_id, RentalAgreement.deleted_at == None
        )
    )
    agreement = result.scalars().first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")

    charges_result = await db.execute(
        select(RentCharge)
        .where(
            RentCharge.agreement_id == agreement_id,
            or_(
                RentCharge.status.in_(
                    [
                        RentChargeStatus.due,
                        RentChargeStatus.overdue,
                        RentChargeStatus.partial,
                    ]
                ),
                (RentCharge.status == RentChargeStatus.upcoming)
                & (RentCharge.due_date <= date.today() + timedelta(days=7)),
            ),
            RentCharge.deleted_at == None,
        )
        .order_by(RentCharge.due_date.asc())
        .limit(1)
    )
    charge = charges_result.scalars().first()
    if not charge:
        total_due = 0.0
    else:
        total_due = float(charge.rent_amount + charge.late_fee - charge.amount_paid)

    if total_due <= 0:
        raise HTTPException(status_code=400, detail="No outstanding balance")

    client = get_razorpay_client()
    # Razorpay amount is in paise (smallest currency unit)
    amount_in_paise = int(total_due * 100)

    data = {
        "amount": amount_in_paise,
        "currency": "INR",
        "receipt": str(agreement_id)[:40],  # max 40 chars
    }
    try:
        order = client.order.create(data=data)
        return CreateOrderResponse(
            order_id=order["id"], amount=total_due, currency="INR"
        )
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(f"Error creating Razorpay order: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Could not create payment order: {str(e)}"
        )


@router.post("/{agreement_id}/verify")
async def verify_payment(
    agreement_id: UUID,
    request: VerifyPaymentRequest,
    db: AsyncSession = Depends(get_db),
):
    client = get_razorpay_client()

    try:
        # Verify the signature
        client.utility.verify_payment_signature(
            {
                "razorpay_order_id": request.razorpay_order_id,
                "razorpay_payment_id": request.razorpay_payment_id,
                "razorpay_signature": request.razorpay_signature,
            }
        )
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Signature is valid, mark charge as paid
    charges_result = await db.execute(
        select(RentCharge)
        .where(
            RentCharge.agreement_id == agreement_id,
            or_(
                RentCharge.status.in_(
                    [
                        RentChargeStatus.due,
                        RentChargeStatus.overdue,
                        RentChargeStatus.partial,
                    ]
                ),
                (RentCharge.status == RentChargeStatus.upcoming)
                & (RentCharge.due_date <= date.today() + timedelta(days=7)),
            ),
            RentCharge.deleted_at == None,
        )
        .order_by(RentCharge.due_date.asc())
        .limit(1)
    )
    charges = [charges_result.scalars().first()]
    charges = [c for c in charges if c is not None]

    remaining_payment = request.amount
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    for charge in charges:
        if remaining_payment <= 0:
            break

        due_for_charge = float(
            charge.rent_amount + charge.late_fee - charge.amount_paid
        )

        if remaining_payment >= due_for_charge:
            charge.amount_paid = charge.rent_amount + charge.late_fee
            charge.status = RentChargeStatus.paid
            remaining_payment -= due_for_charge
        else:
            charge.amount_paid += remaining_payment
            charge.status = RentChargeStatus.partial
            remaining_payment = 0

    new_payment = Payment(
        agreement_id=agreement_id,
        amount=request.amount,
        payment_date=now.date(),
        payment_method="razorpay",
        reference_number=request.razorpay_payment_id,
        notes=f"Razorpay Order: {request.razorpay_order_id}",
    )
    db.add(new_payment)

    await db.commit()
    return {"message": "Payment successful"}
