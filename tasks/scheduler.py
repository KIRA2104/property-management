import asyncio
from datetime import datetime, date, timedelta, timezone
from uuid import UUID

# pyrefly: ignore [missing-import]
from sqlalchemy.future import select
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
            selectinload(RentCharge.agreement).selectinload(RentalAgreement.property)
        )
        .where(
            RentCharge.owner_id == owner_id,
            RentCharge.status.in_([RentChargeStatus.upcoming, RentChargeStatus.due, RentChargeStatus.overdue, RentChargeStatus.partial]),
            RentCharge.deleted_at == None
        )
    )
    
    result = await db.execute(query)
    charges = result.scalars().all()
    
    now = datetime.now(timezone.utc)
    emails_sent = 0
    notified_tenants = set()
    
    for charge in charges:
        # Skip if reminder sent in last 24 hours
        if charge.reminder_sent_at and (now - charge.reminder_sent_at) < timedelta(hours=24):
            continue
            
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
                        # Calculate total due across all unpaid charges for this agreement
                        total_amount_due = sum(
                            float(c.rent_amount + c.late_fee - c.amount_paid)
                            for c in charges
                            if c.agreement_id == agreement.id and (c.due_date == target_upcoming_date or c.due_date <= today)
                        )
                        
                        await send_rent_reminder_email(
                            tenant_email=tenant.email,
                            property_name=prop.name,
                            amount=total_amount_due,
                            due_date=charge.due_date.strftime("%Y-%m-%d"),
                            status=status_text
                        )
                        notified_tenants.add(tenant_prop_key)
                        emails_sent += 1
            
    await db.commit()
    return emails_sent
