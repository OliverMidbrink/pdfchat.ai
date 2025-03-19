from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Message schema
class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    is_user: bool = True

class Message(MessageBase):
    id: int
    conversation_id: int
    is_user: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Conversation schema
class ConversationBase(BaseModel):
    title: str = "New Conversation"

class ConversationCreate(ConversationBase):
    pass

class ConversationUpdate(BaseModel):
    title: Optional[str] = None

class Conversation(ConversationBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    messages: List[Message] = []

    class Config:
        from_attributes = True

# Chat request/response
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None

class ChatResponse(BaseModel):
    message: str
    conversation_id: int 