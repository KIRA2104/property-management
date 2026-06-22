# pyrefly: ignore [missing-import]
from sqlalchemy import Column, String, Boolean

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
from db.base import Base


class User(Base):
    __tablename__ = "users"

    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    properties = relationship("Property", back_populates="owner")
    tenants = relationship("Tenant", back_populates="owner")
    agreements = relationship("RentalAgreement", back_populates="owner")
    payments = relationship("Payment", back_populates="owner")
    rent_charges = relationship("RentCharge", back_populates="owner")
