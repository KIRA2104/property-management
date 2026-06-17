# pyrefly: ignore [missing-import]
from sqlalchemy import Column, String

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship

# pyrefly: ignore [missing-import]
from sqlalchemy import Uuid, ForeignKey
from db.base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, nullable=True)
    owner_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="tenants")
    agreements = relationship("RentalAgreement", back_populates="tenant")
