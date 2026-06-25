import asyncio
from datetime import datetime, date, timedelta, timezone
from uuid import UUID

# pyrefly: ignore [missing-import]
from sqlalchemy.future import select

# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import selectinload

from models.rent_charge import RentCharge, RentChargeStatus
from models.agreement import RentalAgreement
from models.property import Property
from models.tenant import Tenant
from core.email import send_rent_reminder_email


async def process_rent_reminders(db: AsyncSession, owner_id: UUID):
    print(f"Manually triggering rent reminders for owner: {owner_id}")
    today = date.today()
    # Find charges that are upcoming (due in exactly 3 days) or overdue (due date < today)
    target_upcoming_date = today + timedelta(days=3)

    query = (
        select(RentCharge)
        .options(
            selectinload(RentCharge.agreement).selectinload(RentalAgreement.tenants),
            selectinload(RentCharge.agreement).selectinload(RentalAgreement.property),
        )
        .join(RentalAgreement)
        .where(
            RentCharge.owner_id == owner_id,
            RentCharge.status.in_(
                [
                    RentChargeStatus.upcoming,
                    RentChargeStatus.due,
                    RentChargeStatus.overdue,
                    RentChargeStatus.partial,
                ]
            ),
            RentCharge.deleted_at == None,
            RentalAgreement.deleted_at == None,
            (RentCharge.due_date <= target_upcoming_date)
            | (RentCharge.status == RentChargeStatus.overdue),
        )
    )

    result = await db.execute(query)
    charges = result.scalars().all()

    # SQLite returns naive datetimes, so we must use a naive datetime for 'now'
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    emails_sent = 0
    notified_tenants = set()

    for charge in charges:
        # Skip if reminder sent in last 24 hours (REMOVED AT USER REQUEST)
        # if charge.reminder_sent_at and (now - charge.reminder_sent_at) < timedelta(hours=24):
        #    continue

        needs_reminder = False
        status_text = "upcoming"

        # Check if due in exactly 3 days
        if charge.due_date == target_upcoming_date:
            needs_reminder = True
        elif charge.due_date <= today:
            needs_reminder = True
            status_text = "overdue"

        if needs_reminder:
            agreement = charge.agreement
            prop = agreement.property
            tenants = agreement.tenants

            # Always mark the charge as processed so it doesn't trigger again today
            charge.reminder_sent_at = now

            for tenant in tenants:
                if tenant.email:
                    # Prevent spamming the same tenant for the same property multiple times
                    tenant_prop_key = (tenant.email, prop.id)
                    if tenant_prop_key not in notified_tenants:
                        amount_due = float(
                            charge.rent_amount + charge.late_fee - charge.amount_paid
                        )

                        # Parse billing month from YYYY-MM to Month YYYY
                        month_date = datetime.strptime(charge.billing_month, "%Y-%m")
                        formatted_month = month_date.strftime("%B %Y")

                        await send_rent_reminder_email(
                            tenant_email=tenant.email,
                            property_name=prop.name,
                            amount=amount_due,
                            due_date=charge.due_date.strftime("%Y-%m-%d"),
                            status=status_text,
                            agreement_id=str(agreement.id),
                            billing_month=formatted_month,
                        )
                        notified_tenants.add(tenant_prop_key)
                        emails_sent += 1

    await db.commit()
    return emails_sent
