import asyncio
from db.session import async_session_maker
from models.rent_charge import RentCharge
from sqlalchemy.future import select
from uuid import UUID

async def main():
    async with async_session_maker() as db:
        query = select(RentCharge).where(RentCharge.agreement_id == UUID("984b3e0c-8115-4f0c-a217-5cf09bd3c21d"))
        result = await db.execute(query)
        charges = result.scalars().all()
        total = 0
        for c in charges:
            due = float(c.rent_amount + c.late_fee - c.amount_paid)
            print(f"Charge {c.id} amount: {c.rent_amount}, late fee: {c.late_fee}, paid: {c.amount_paid}, due: {due}, status: {c.status}")
            total += due
        print(f"Total due: {total}")

if __name__ == "__main__":
    asyncio.run(main())
