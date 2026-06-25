import os
import razorpay
from dotenv import load_dotenv

load_dotenv()

key_id = os.getenv("RAZORPAY_KEY_ID")
key_secret = os.getenv("RAZORPAY_KEY_SECRET")

print(f"Key ID: {key_id}")
if not key_id or not key_secret:
    print("Keys missing!")
    exit(1)

client = razorpay.Client(auth=(key_id, key_secret))
data = {
    "amount": 7500000,
    "currency": "INR",
    "receipt": "47794166-e9c6-4741-b77d-08a33b81d687"
}

try:
    order = client.order.create(data=data)
    print("Order created successfully:", order)
except Exception as e:
    print(f"Error: {e}")

