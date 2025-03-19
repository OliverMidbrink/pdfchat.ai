from datetime import datetime, timedelta
import time
import logging
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.schemas.user import TokenData
from app.db.session import get_db
from app.models.user import User

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("security")

# Configure bcrypt for password hashing with reduced work factor for better performance
# The default is usually 12, but we're reducing to 10 for better performance
# while still maintaining good security
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=10  # Reduce work factor from default (usually 12) to 10
)

# JWT Configuration
SECRET_KEY = "YOUR_SECRET_KEY_HERE"  # Should be replaced with env variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080  # 7 days (60 min * 24 hours * 7 days)

# OAuth2 password bearer for token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

def verify_password(plain_password, hashed_password):
    """Verify a password against a hash with detailed timing information"""
    start_time = time.time()
    
    # Extract bcrypt parameters for logging
    try:
        hash_parts = hashed_password.split('$')
        if len(hash_parts) >= 3:
            work_factor = hash_parts[2]
            logger.debug(f"Verifying password with work factor: ${work_factor}$")
    except Exception as e:
        logger.warning(f"Could not parse hash parameters: {e}")
    
    # Verify the password
    result = pwd_context.verify(plain_password, hashed_password)
    verification_time = time.time() - start_time
    
    # Log verification time
    if verification_time > 0.5:  # 500ms threshold
        logger.warning(f"Password verification took {verification_time:.4f}s")
    else:
        logger.debug(f"Password verification took {verification_time:.4f}s")
    
    # If verification is slow, suggest reducing work factor
    if verification_time > 0.3:
        logger.warning("Password verification is slow. Consider reducing bcrypt work factor.")
        
    return result

def get_password_hash(password):
    """Hash a password with detailed timing information"""
    start_time = time.time()
    hashed = pwd_context.hash(password)
    hash_time = time.time() - start_time
    
    # Log hashing time
    if hash_time > 0.5:  # 500ms threshold 
        logger.warning(f"Password hashing took {hash_time:.4f}s")
    else:
        logger.debug(f"Password hashing took {hash_time:.4f}s")
    
    # Extract and log the work factor
    try:
        hash_parts = hashed.split('$')
        if len(hash_parts) >= 3:
            work_factor = hash_parts[2]
            logger.debug(f"Password hashed with work factor: ${work_factor}$")
    except Exception as e:
        logger.warning(f"Could not parse hash parameters: {e}")
        
    return hashed

def authenticate_user(db: Session, username: str, password: str):
    """Authenticate a user with detailed timing information"""
    start_time = time.time()
    logger.info(f"Starting authentication for user: {username}")
    
    # Find user
    db_lookup_start = time.time()
    user = db.query(User).filter(User.username == username).first()
    query_time = time.time() - db_lookup_start
    
    # Log query time
    logger.debug(f"Database user lookup took {query_time:.4f}s")
    
    if not user:
        logger.warning(f"User not found: {username}")
        auth_time = time.time() - start_time
        logger.info(f"Authentication failed (user not found) in {auth_time:.4f}s")
        return False
    
    logger.debug(f"User found: {username}")
    
    # Verify password
    logger.debug("Starting password verification...")
    verify_start = time.time()
    valid_password = verify_password(password, user.hashed_password)
    verify_time = time.time() - verify_start
    
    if not valid_password:
        logger.warning(f"Invalid password for user: {username}")
        auth_time = time.time() - start_time
        logger.info(f"Authentication failed (invalid password) in {auth_time:.4f}s")
        return False
    
    # Log total authentication time
    total_time = time.time() - start_time
    logger.info(f"Authentication successful for {username} in {total_time:.4f}s")
    logger.debug(f"Authentication breakdown: DB lookup={query_time:.4f}s, Password verify={verify_time:.4f}s")
    
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    start_time = time.time()
    
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    # Log token creation time
    token_time = time.time() - start_time
    logger.debug(f"Token creation took {token_time:.4f}s")
    
    return encoded_jwt

async def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    start_time = time.time()
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        logger.warning("JWT validation error")
        raise credentials_exception
    
    # Find user in DB
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        logger.warning(f"User from token not found: {token_data.username}")
        raise credentials_exception
    
    # Log total validation time
    total_time = time.time() - start_time
    logger.debug(f"get_current_user took {total_time:.4f}s")
    
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user 