import asyncio
from uuid import UUID
from datetime import date
from db.session import async_session_maker
from models.rent_charge import RentCharge
from sqlalchemy.future import select

async def main():
    owner_id = UUID("8d5b15da-5d99-4980-8470-c6cca1ff7807")
    async with async_session_maker() as db:
        query = select(RentCharge).where(RentCharge.owner_id == owner_id)
        result = await db.execute(query)
        charges = result.scalars().all()
        print(f"Total charges for owner {owner_id}: {len(charges)}")
        for c in charges:
            print(f"ID: {c.id}, Due: {c.due_date}, Deleted: {c.deleted_at}")
        
        # Update the first non-deleted one to be due today
        active_charges = [c for c in charges if not c.deleted_at]
        if active_charges:
            c = active_charges[0]
            c.due_date = date.today()
            c.reminder_sent_at = None
            await db.commit()
            print(f"Updated {c.id} to be due today.")

if __name__ == "__main__":
    asyncio.run(main())
