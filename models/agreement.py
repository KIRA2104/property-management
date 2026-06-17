# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Date, Numeric, ForeignKey, Enum, Uuid

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
import enum
from db.base import Base


class AgreementStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    terminated = "terminated"


class RentalAgreement(Base):
    __tablename__ = "agreements"

    property_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
    )
    tenant_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
    )

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    agreed_rent = Column(Numeric(12, 2), nullable=False)
    deposit = Column(Numeric(12, 2), nullable=False)

    status = Column(
        Enum(AgreementStatus), default=AgreementStatus.active, nullable=False
    )
    owner_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="agreements")
    property = relationship("Property", back_populates="agreements")
    tenant = relationship("Tenant", back_populates="agreements")
    payments = relationship(
        "Payment", back_populates="agreement", cascade="all, delete-orphan"
    )
