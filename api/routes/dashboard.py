import asyncio

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends

# pyrefly: ignore [missing-import]
from sqlalchemy.future import select

from db.session import async_session_maker
from models.property import Property
from models.tenant import Tenant
from models.payment import Payment
from models.rent_charge import RentCharge
from models.user import User
from schemas.dashboard import DashboardData
from api.deps import get_current_user

router = APIRouter()


async def fetch_properties(owner_id):
    async with async_session_maker() as session:
        query = select(Property).where(
            Property.owner_id == owner_id, Property.deleted_at == None
        )
        result = await session.execute(query)
        return result.scalars().all()


async def fetch_tenants(owner_id):
    async with async_session_maker() as session:
        query = select(Tenant).where(
            Tenant.owner_id == owner_id, Tenant.deleted_at == None
        )
        result = await session.execute(query)
        return result.scalars().all()


async def fetch_payments(owner_id):
    async with async_session_maker() as session:
        query = select(Payment).where(
            Payment.owner_id == owner_id, Payment.deleted_at == None
        )
        result = await session.execute(query)
        return result.scalars().all()


async def fetch_rent_charges(owner_id):
    async with async_session_maker() as session:
        query = select(RentCharge).where(RentCharge.owner_id == owner_id)
        result = await session.execute(query)
        return result.scalars().all()


@router.get("/", response_model=DashboardData)
async def get_dashboard(current_user: User = Depends(get_current_user)):
    # Here is the magic: these three database queries run simultaneously
    # instead of sequentially!
    properties, tenants, payments, rent_charges = await asyncio.gather(
        fetch_properties(current_user.id),
        fetch_tenants(current_user.id),
        fetch_payments(current_user.id),
        fetch_rent_charges(current_user.id),
    )

    return {
        "properties": properties,
        "tenants": tenants,
        "payments": payments,
        "rent_charges": rent_charges,
    }
