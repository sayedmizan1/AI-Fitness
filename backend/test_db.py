import asyncio
from database import init_db, AsyncSessionLocal
from models.user import User
from core.security import get_password_hash
from sqlalchemy import select

async def main():
    try:
        print("Initializing DB...")
        await init_db()
        print("DB initialized.")
        
        async with AsyncSessionLocal() as session:
            print("Creating user...")
            email = "test4@demo.com"
            result = await session.execute(select(User).where(User.email == email))
            if result.scalar_one_or_none():
                print("User already exists")
                return
                
            hash = get_password_hash("password123")
            user = User(email=email, hashed_password=hash, full_name="Test")
            session.add(user)
            await session.commit()
            print("User created successfully!")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
