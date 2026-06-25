import asyncio
from db.session import async_session_maker
from models.rent_charge import RentCharge
from models.agreement import RentalAgreement
from models.tenant import Tenant
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

async def main():
    async with async_session_maker() as db:
        query = select(RentCharge).options(
            selectinload(RentCharge.agreement).selectinload(RentalAgreement.tenants)
        ).where(RentCharge.id == "2dd6beac-cc4c-40cf-b1a3-75bb02723223")
        result = await db.execute(query)
        c = result.scalars().first()
        if c:
            print(f"Charge owner: {c.owner_id}")
            print(f"Agreement deleted: {c.agreement.deleted_at if c.agreement else 'NO AGREEMENT'}")
            print(f"Tenants: {[t.email for t in c.agreement.tenants] if c.agreement else 'N/A'}")
        else:
            print("Charge not found.")

if __name__ == "__main__":
    asyncio.run(main())
