from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DocumentBase(BaseModel):
    name: str
    size: int
    content_type: str = "application/pdf"

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    conversation_id: Optional[int] = None

class Document(DocumentBase):
    id: int
    path: str
    user_id: int
    conversation_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        orm_mode = True

class DocumentResponse(BaseModel):
    id: int
    name: str
    size: int
    url: str
    created_at: datetime
    
    class Config:
        orm_mode = True 