import asyncio
from uuid import UUID
from datetime import date
from db.session import async_session_maker
from models.rent_charge import RentCharge
from models.agreement import RentalAgreement
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

async def main():
    owner_id = UUID("8d5b15da-5d99-4980-8470-c6cca1ff7807")
    async with async_session_maker() as db:
        # Find active rent charges
        query = select(RentCharge).options(
            selectinload(RentCharge.agreement).selectinload(RentalAgreement.tenants)
        ).join(RentalAgreement).where(
            RentCharge.owner_id == owner_id,
            RentalAgreement.deleted_at == None,
            RentCharge.deleted_at == None
        )
        result = await db.execute(query)
        charges = result.scalars().all()
        
        valid = None
        for c in charges:
            if c.agreement and len(c.agreement.tenants) > 0 and c.agreement.tenants[0].email:
                valid = c
                break
                
        if valid:
            valid.due_date = date.today()
            valid.reminder_sent_at = None
            await db.commit()
            print(f"Updated valid charge {valid.id} for agreement {valid.agreement_id}. Tenant email: {valid.agreement.tenants[0].email}")
        else:
            print("No valid active charge found with a tenant email!")

if __name__ == "__main__":
    asyncio.run(main())
