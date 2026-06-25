# pyrefly: ignore [missing-import]
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from core.config import settings
from typing import List

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM or settings.MAIL_USERNAME or "noreply@example.com",
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=settings.USE_CREDENTIALS,
    VALIDATE_CERTS=settings.VALIDATE_CERTS,
)


async def send_rent_reminder_email(
    tenant_email: str,
    property_name: str,
    amount: float,
    due_date: str,
    status: str,
    agreement_id: str,
    billing_month: str = "this month",
):
    # Only try to send if we have a username and password
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        print(
            f"Skipping email to {tenant_email} for {property_name}: SMTP credentials not configured."
        )
        return

    is_overdue = status == "overdue"
    subject = (
        f"URGENT: Rent Overdue for {property_name}"
        if is_overdue
        else f"Reminder: Rent Due for {property_name}"
    )

    payment_link = f"http://127.0.0.1:8000/#/pay/{agreement_id}"

    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: {"#e53e3e" if is_overdue else "#3182ce"};">Rent {"Overdue" if is_overdue else "Reminder"}</h2>
            <p>This is a reminder regarding the rent for your property: <strong>{property_name}</strong>.</p>
            <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0; font-size: 16px;"><strong>Billing Month:</strong> {billing_month}</p>
                <p style="margin: 5px 0; font-size: 18px;"><strong>Amount Due:</strong> ₹{amount:,.2f}</p>
                <p style="margin: 5px 0;"><strong>Due Date:</strong> {due_date}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{payment_link}" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                    Pay Now Securely
                </a>
            </div>
            
            <p style="font-size: 14px; color: #718096;">Please ensure the payment is made promptly. If you have already paid, please ignore this message.</p>
            <p style="font-size: 14px; color: #718096;">Thank you,<br>Property Management</p>
        </body>
    </html>
    """

    message = MessageSchema(
        subject=subject, recipients=[tenant_email], body=html, subtype=MessageType.html
    )

    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        print(f"Successfully sent reminder email to {tenant_email} for {property_name}")
    except Exception as e:
        print(f"Failed to send email to {tenant_email}: {e}")
