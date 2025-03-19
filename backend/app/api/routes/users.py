from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user, get_password_hash
from app.models.user import User
from app.schemas.user import User as UserSchema, UserUpdate, UserApiKey

router = APIRouter(tags=["users"])

@router.get("/users/me", response_model=UserSchema)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    # Convert to schema with additional computed properties
    user_dict = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "has_openai_api_key": bool(current_user.openai_api_key)
    }
    return user_dict

@router.put("/users/me", response_model=UserSchema)
async def update_user(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Update user fields if provided
    if user_update.username is not None:
        # Check if username is already taken
        existing_user = db.query(User).filter(User.username == user_update.username).first()
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        current_user.username = user_update.username
        
    if user_update.email is not None:
        # Check if email is already taken
        existing_email = db.query(User).filter(User.email == user_update.email).first()
        if existing_email and existing_email.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        current_user.email = user_update.email
        
    if user_update.password is not None:
        current_user.hashed_password = get_password_hash(user_update.password)
        
    if user_update.openai_api_key is not None:
        current_user.openai_api_key = user_update.openai_api_key
        
    db.commit()
    db.refresh(current_user)
    
    # Convert to schema with additional computed properties
    user_dict = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "has_openai_api_key": bool(current_user.openai_api_key)
    }
    return user_dict

@router.post("/users/me/api-key", response_model=UserSchema)
async def update_api_key(
    api_key: UserApiKey,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    current_user.openai_api_key = api_key.openai_api_key
    db.commit()
    db.refresh(current_user)
    
    # Convert to schema with additional computed properties
    user_dict = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "has_openai_api_key": bool(current_user.openai_api_key)
    }
    return user_dict 