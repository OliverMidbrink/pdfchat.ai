from datetime import timedelta
import time
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import authenticate_user, create_access_token, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin

# Set up logging
logger = logging.getLogger("auth")

router = APIRouter(tags=["auth"])

@router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if username already exists
    db_user = db.query(User).filter(User.username == user_data.username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email already exists (if provided)
    if user_data.email:
        db_email = db.query(User).filter(User.email == user_data.email).first()
        if db_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/auth/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/auth/login", response_model=Token)
async def login(
    user_data: UserLogin,
    db: Session = Depends(get_db)
):
    """Login endpoint with detailed performance logging"""
    request_start_time = time.time()
    logger.info(f"Login request received for user: {user_data.username}")
    
    try:
        # Validate input
        validate_start = time.time()
        if not user_data.username or not user_data.password:
            logger.warning("Login attempt with empty username or password")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username and password are required"
            )
        validate_time = time.time() - validate_start
        logger.debug(f"Input validation took {validate_time:.4f}s")
        
        # Try to authenticate user
        auth_start = time.time()
        user = authenticate_user(db, user_data.username, user_data.password)
        auth_time = time.time() - auth_start
        logger.info(f"Authentication took {auth_time:.4f}s for user {user_data.username}")
        
        if not user:
            logger.warning(f"Failed login attempt for user {user_data.username}")
            failure_time = time.time() - request_start_time
            logger.info(f"Failed login processed in {failure_time:.4f}s")
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        token_start = time.time()
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        token_time = time.time() - token_start
        logger.info(f"Token generation took {token_time:.4f}s for user {user_data.username}")
        
        # Prepare response
        response_start = time.time()
        response_data = {"access_token": access_token, "token_type": "bearer"}
        response_time = time.time() - response_start
        logger.debug(f"Response preparation took {response_time:.4f}s")
        
        # Log complete performance breakdown
        total_time = time.time() - request_start_time
        logger.info(f"Total login process took {total_time:.4f}s for user {user_data.username}")
        logger.debug(f"Login performance breakdown: Validation={validate_time:.4f}s, Auth={auth_time:.4f}s, Token={token_time:.4f}s, Response={response_time:.4f}s")
        
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
        
    except Exception as e:
        # Log unexpected errors
        error_time = time.time() - request_start_time
        logger.error(f"Unexpected error during login: {str(e)}")
        logger.error(f"Login failed after {error_time:.4f}s due to unexpected error")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )

@router.post("/auth/refresh", response_model=Token)
async def refresh_token(current_user: User = Depends(get_current_user)):
    """Refresh the user's access token"""
    # Log and time refresh process
    start_time = time.time()
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.username}, expires_delta=access_token_expires
    )
    
    # Log refresh time
    total_time = time.time() - start_time
    logger.info(f"Token refresh took {total_time:.4f}s for user {current_user.username}")
    
    return {"access_token": access_token, "token_type": "bearer"} 