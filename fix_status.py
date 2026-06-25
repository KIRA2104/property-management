import asyncio
from db.session import async_session_maker
from models.rent_charge import RentCharge, RentChargeStatus
from sqlalchemy.future import select
from datetime import date

async def main():
    async with async_session_maker() as db:
        query = select(RentCharge).where(RentCharge.id == "4ba3e16b-65da-4096-aa6f-04a183d1196a")
        result = await db.execute(query)
        charge = result.scalars().first()
        if charge:
            charge.status = RentChargeStatus.due
            await db.commit()
            print("Status updated to due!")

if __name__ == "__main__":
    asyncio.run(main())
