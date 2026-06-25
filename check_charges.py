import asyncio
from db.session import async_session_maker
from models.rent_charge import RentCharge
from sqlalchemy.future import select

async def main():
    async with async_session_maker() as db:
        result = await db.execute(select(RentCharge))
        charges = result.scalars().all()
        for c in charges:
            print(f"Charge {c.id} - Status: {c.status}, Due: {c.due_date}")

if __name__ == "__main__":
    asyncio.run(main())
