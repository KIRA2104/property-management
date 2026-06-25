import asyncio
from core.email import send_rent_reminder_email
from core.config import settings

async def test():
    print(f"Testing with MAIL_SERVER={settings.MAIL_SERVER}, MAIL_PORT={settings.MAIL_PORT}, USER={settings.MAIL_USERNAME}")
    if not settings.MAIL_USERNAME:
        print("NO USERNAME SET IN SETTINGS!")
        return
    
    print("Attempting to send email...")
    try:
        await asyncio.wait_for(
            send_rent_reminder_email(
                tenant_email=settings.MAIL_USERNAME,
                property_name="Test Property",
                amount=1000.0,
                due_date="2026-06-30",
                status="upcoming"
            ),
            timeout=10.0
        )
        print("Finished.")
    except asyncio.TimeoutError:
        print("HANG: send_rent_reminder_email timed out after 10 seconds!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
