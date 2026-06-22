# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Date, String, Numeric, ForeignKey, Enum, Uuid

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
import enum
from db.base import Base


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    failed = "failed"


class Payment(Base):
    __tablename__ = "payments"

    agreement_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("agreements.id", ondelete="RESTRICT"),
        nullable=False,
    )

    amount = Column(Numeric(12, 2), nullable=False)
    rent_charge_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("rent_charges.id", ondelete="SET NULL"),
        nullable=True,
    )
    payment_date = Column(Date, nullable=False)
    payment_method = Column(String, nullable=True)
    reference_number = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending, nullable=False)
    owner_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="payments")
    agreement = relationship("RentalAgreement", back_populates="payments")
    rent_charge = relationship("RentCharge", back_populates="payments")
