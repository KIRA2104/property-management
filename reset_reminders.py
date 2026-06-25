import asyncio
from db.session import async_session_maker
from models.rent_charge import RentCharge
from sqlalchemy import update

async def main():
    async with async_session_maker() as session:
        await session.execute(update(RentCharge).values(reminder_sent_at=None))
        await session.commit()
        print("Reset reminder timestamps!")

if __name__ == "__main__":
    asyncio.run(main())
