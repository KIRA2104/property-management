import asyncio
from db.session import async_session_maker
from models.user import User
# pyrefly: ignore [missing-import]
from sqlalchemy.future import select

from tasks.scheduler import process_rent_reminders

async def test():
    async with async_session_maker() as session:
        # Get first user
        result = await session.execute(select(User).limit(1))
        user = result.scalars().first()
        if not user:
            print("No users found.")
            return
        print(f"Triggering for user {user.id}")
        sent = await process_rent_reminders(user.id)
        print(f"Emails sent: {sent}")

if __name__ == "__main__":
    asyncio.run(test())
