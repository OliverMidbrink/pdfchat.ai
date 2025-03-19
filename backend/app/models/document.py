from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.session import Base

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    path = Column(String, nullable=False)  # Storage path
    size = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    content_type = Column(String, nullable=False, default="application/pdf")
    
    # Relationships
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    user = relationship("User", back_populates="documents")
    
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)
    conversation = relationship("Conversation", back_populates="documents") 