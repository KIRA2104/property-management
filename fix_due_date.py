import asyncio
from datetime import date
from db.session import async_session_maker
from models.rent_charge import RentCharge
from sqlalchemy.future import select

async def main():
    async with async_session_maker() as db:
        result = await db.execute(select(RentCharge).limit(1))
        charge = result.scalars().first()
        if charge:
            charge.due_date = date.today()
            charge.reminder_sent_at = None
            await db.commit()
            print(f"Updated charge {charge.id} due_date to today.")

if __name__ == "__main__":
    asyncio.run(main())
