#!/usr/bin/env python3
"""
Backend Unit Tests for Authentication Functions
----------------------------------------------
This script performs unit tests on the backend authentication functions:
1. Password hashing and verification
2. Token creation and validation
3. User authentication

Usage:
    python -m tests.backend.test_auth_functions
"""

import sys
import os
import unittest
import jwt
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Import the backend modules
from backend.app.core.security import (
    verify_password, get_password_hash, create_access_token, 
    get_current_user, authenticate_user, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM
)
from backend.app.models.user import User
from backend.app.db.session import Base
from backend.app.schemas.user import TokenData

# Create an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool  # Use StaticPool for in-memory database
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class TestAuthFunctions(unittest.TestCase):
    """Test case for the authentication functions"""
    
    def setUp(self):
        """Create tables and add a test user before each test"""
        # Create the tables
        Base.metadata.create_all(bind=engine)
        
        # Create a test session
        self.db = TestingSessionLocal()
        
        # Create a test user
        hashed_password = get_password_hash("testpassword")
        test_user = User(
            username="testuser",
            email="testuser@example.com",
            hashed_password=hashed_password,
            is_active=True
        )
        self.db.add(test_user)
        self.db.commit()
        self.db.refresh(test_user)
        
        # Store the test user
        self.test_user = test_user
    
    def tearDown(self):
        """Clean up after each test"""
        # Remove all data
        self.db.query(User).delete()
        self.db.commit()
        
        # Close the session
        self.db.close()
        
        # Drop the tables
        Base.metadata.drop_all(bind=engine)
    
    def test_password_hash_and_verify(self):
        """Test that password hashing and verification work"""
        password = "securepassword123"
        
        # Hash the password
        hashed = get_password_hash(password)
        
        # Verify should return True for the correct password
        self.assertTrue(verify_password(password, hashed))
        
        # Verify should return False for an incorrect password
        self.assertFalse(verify_password("wrongpassword", hashed))
        
        # Hash should be different each time
        hashed2 = get_password_hash(password)
        self.assertNotEqual(hashed, hashed2)
    
    def test_authenticate_user(self):
        """Test the authenticate_user function"""
        # Test valid credentials
        user = authenticate_user(self.db, "testuser", "testpassword")
        self.assertIsNotNone(user)
        self.assertEqual(user.username, "testuser")
        
        # Test invalid password
        user = authenticate_user(self.db, "testuser", "wrongpassword")
        self.assertFalse(user)
        
        # Test non-existent user
        user = authenticate_user(self.db, "nonexistentuser", "testpassword")
        self.assertFalse(user)
    
    def test_create_access_token(self):
        """Test the create_access_token function"""
        # Create a token with default expiry
        token_data = {"sub": "testuser"}
        token = create_access_token(data=token_data)
        
        # Decode the token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Check that the subject is correct
        self.assertEqual(payload["sub"], "testuser")
        
        # Check that the token has an expiry time
        self.assertIn("exp", payload)
        
        # Expiry should be in the future
        exp_time = datetime.fromtimestamp(payload["exp"])
        now = datetime.utcnow()
        self.assertGreater(exp_time, now)
        
        # Expiry should be approximately ACCESS_TOKEN_EXPIRE_MINUTES in the future
        expected_exp = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        self.assertAlmostEqual(exp_time, expected_exp, delta=timedelta(minutes=1))
        
        # Test with custom expiry
        custom_expires = timedelta(minutes=30)
        token = create_access_token(data=token_data, expires_delta=custom_expires)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        exp_time = datetime.fromtimestamp(payload["exp"])
        expected_exp = now + custom_expires
        self.assertAlmostEqual(exp_time, expected_exp, delta=timedelta(minutes=1))
    
    async def test_get_current_user(self):
        """Test the get_current_user function"""
        # Create a valid token
        token_data = {"sub": "testuser"}
        token = create_access_token(data=token_data)
        
        # Get the user from the token
        user = await get_current_user(db=self.db, token=token)
        self.assertEqual(user.username, "testuser")
        
        # Test with invalid token (modified payload)
        invalid_token = jwt.encode(
            {"sub": "nonexistentuser", "exp": datetime.utcnow() + timedelta(minutes=30)},
            SECRET_KEY,
            algorithm=ALGORITHM
        )
        
        # Should raise an exception for non-existent user
        with self.assertRaises(Exception):
            await get_current_user(db=self.db, token=invalid_token)
        
        # Test with expired token
        expired_token = jwt.encode(
            {"sub": "testuser", "exp": datetime.utcnow() - timedelta(minutes=5)},
            SECRET_KEY,
            algorithm=ALGORITHM
        )
        
        # Should raise an exception for expired token
        with self.assertRaises(Exception):
            await get_current_user(db=self.db, token=expired_token)

def run_tests():
    """Run the tests"""
    unittest.main(argv=['first-arg-is-ignored'])

if __name__ == "__main__":
    run_tests() 