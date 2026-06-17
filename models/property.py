# pyrefly: ignore [missing-import]
from sqlalchemy import Column, String, Boolean, Numeric

from sqlalchemy.orm import relationship
from sqlalchemy import Uuid, ForeignKey
from db.base import Base


class Property(Base):
    __tablename__ = "properties"

    address = Column(String, nullable=False)
    description = Column(String, nullable=True)
    monthly_rent = Column(Numeric(12, 2), nullable=False)
    is_available = Column(Boolean, default=True)
    owner_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="properties")
    agreements = relationship("RentalAgreement", back_populates="property")
