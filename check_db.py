import asyncio
from db.session import async_session_maker
from models.agreement import RentalAgreement
from sqlalchemy.future import select

async def main():
    async with async_session_maker() as db:
        result = await db.execute(select(RentalAgreement))
        agreements = result.scalars().all()
        for a in agreements:
            print(f"ID: {a.id}, Deleted: {a.deleted_at}")

if __name__ == "__main__":
    asyncio.run(main())
