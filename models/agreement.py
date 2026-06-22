# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Date, Numeric, ForeignKey, Enum, Uuid, Table

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
import enum
from db.base import Base

agreement_tenants = Table(
    "agreement_tenants",
    Base.metadata,
    Column("agreement_id", Uuid(as_uuid=True), ForeignKey("agreements.id", ondelete="CASCADE"), primary_key=True),
    Column("tenant_id", Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True)
)


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
    tenants = relationship("Tenant", secondary=agreement_tenants, back_populates="agreements")
    payments = relationship(
        "Payment", back_populates="agreement", cascade="all, delete-orphan"
    )
    rent_charges = relationship(
        "RentCharge", back_populates="agreement", cascade="all, delete-orphan"
    )

    @property
    def tenant_ids(self):
        return [t.id for t in self.tenants]
