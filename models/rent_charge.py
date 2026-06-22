# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Date, String, Numeric, ForeignKey, Enum, Uuid

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
import enum
from db.base import Base


class RentChargeStatus(str, enum.Enum):
    upcoming = "upcoming"
    due = "due"
    partial = "partial"
    paid = "paid"
    overdue = "overdue"


class RentCharge(Base):
    __tablename__ = "rent_charges"

    agreement_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("agreements.id", ondelete="RESTRICT"),
        nullable=False,
    )

    billing_month = Column(String(7), nullable=False) # Format: YYYY-MM
    due_date = Column(Date, nullable=False)
    rent_amount = Column(Numeric(12, 2), nullable=False)
    late_fee = Column(Numeric(12, 2), nullable=False, default=0)
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0)

    status = Column(Enum(RentChargeStatus), default=RentChargeStatus.upcoming, nullable=False)
    owner_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="rent_charges")
    agreement = relationship("RentalAgreement", back_populates="rent_charges")
    payments = relationship("Payment", back_populates="rent_charge")
