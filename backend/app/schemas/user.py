from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

# Shared properties
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[EmailStr] = None

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

# Properties to receive via API on update
class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)
    openai_api_key: Optional[str] = None

# Properties to return via API
class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    has_openai_api_key: bool

    class Config:
        from_attributes = True

# Properties for login
class UserLogin(BaseModel):
    username: str
    password: str

# Properties for token
class Token(BaseModel):
    access_token: str
    token_type: str

# Properties inside JWT token
class TokenData(BaseModel):
    username: Optional[str] = None
    
# User API Key
class UserApiKey(BaseModel):
    openai_api_key: str 