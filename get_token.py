import asyncio
from db.session import async_session_maker
from models.user import User
from core.security import create_access_token
from sqlalchemy.future import select

async def main():
    async with async_session_maker() as session:
        result = await session.execute(select(User).limit(1))
        user = result.scalars().first()
        if user:
            token = create_access_token(data={"sub": user.id})
            print(token)
            
if __name__ == "__main__":
    asyncio.run(main())
