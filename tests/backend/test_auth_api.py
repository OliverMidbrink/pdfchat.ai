#!/usr/bin/env python3
"""
Backend API Tests for Authentication Endpoints
---------------------------------------------
This script tests the backend authentication API endpoints including:
1. User registration with valid and invalid data
2. Login with correct and incorrect credentials
3. Token refresh
4. Authentication edge cases

Usage:
    python -m tests.backend.test_auth_api
"""

import sys
import os
import pytest
import random
import string
import asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from fastapi import status
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Import app and models
from backend.app.main import app
from backend.app.db.session import Base, get_db
from backend.app.models.user import User

# Create an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool  # Use StaticPool for in-memory database
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override the get_db dependency
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

# Create the tables
Base.metadata.create_all(bind=engine)

# Create testing client
client = TestClient(app)

# Helper Functions
def generate_random_string(length=8):
    """Generate a random string of specified length"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def generate_test_user():
    """Generate a random test user"""
    return {
        "username": f"testuser_{generate_random_string()}",
        "email": f"test_{generate_random_string()}@example.com",
        "password": f"Password{generate_random_string()}123!"
    }

def register_test_user():
    """Register a test user and return the user data and access token"""
    user_data = generate_test_user()
    response = client.post("/api/auth/register", json=user_data)
    
    if response.status_code == 200:
        return user_data, response.json().get("access_token")
    return None, None

# Test Cases
def test_register_valid_user():
    """Test registering a user with valid data"""
    # Generate random user data
    user_data = generate_test_user()
    
    # Register the user
    response = client.post("/api/auth/register", json=user_data)
    
    # Check the response
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"

def test_register_duplicate_username():
    """Test registering a user with a duplicate username"""
    # Register a user
    user_data, _ = register_test_user()
    
    if not user_data:
        pytest.fail("Failed to register initial test user")
    
    # Try to register another user with the same username
    duplicate_user = {
        "username": user_data["username"],
        "email": f"different_{generate_random_string()}@example.com",
        "password": "Password123!"
    }
    
    response = client.post("/api/auth/register", json=duplicate_user)
    
    # Check that the registration fails
    assert response.status_code == 400
    assert "detail" in response.json()
    assert "already registered" in response.json()["detail"]

def test_register_duplicate_email():
    """Test registering a user with a duplicate email"""
    # Register a user
    user_data, _ = register_test_user()
    
    if not user_data:
        pytest.fail("Failed to register initial test user")
    
    # Try to register another user with the same email
    duplicate_user = {
        "username": f"different_{generate_random_string()}",
        "email": user_data["email"],
        "password": "Password123!"
    }
    
    response = client.post("/api/auth/register", json=duplicate_user)
    
    # Check that the registration fails
    assert response.status_code == 400
    assert "detail" in response.json()
    assert "already registered" in response.json()["detail"]

def test_register_invalid_password():
    """Test registering a user with an invalid password"""
    # Generate user data with a short password
    user_data = generate_test_user()
    user_data["password"] = "short"
    
    # Try to register
    response = client.post("/api/auth/register", json=user_data)
    
    # Check that the registration fails
    assert response.status_code == 422  # Validation error

def test_login_valid_credentials():
    """Test logging in with valid credentials"""
    # Register a user
    user_data, _ = register_test_user()
    
    if not user_data:
        pytest.fail("Failed to register test user")
    
    # Login with the registered user
    login_data = {
        "username": user_data["username"],
        "password": user_data["password"]
    }
    
    response = client.post("/api/auth/login", json=login_data)
    
    # Check the response
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"

def test_login_wrong_password():
    """Test logging in with wrong password"""
    # Register a user
    user_data, _ = register_test_user()
    
    if not user_data:
        pytest.fail("Failed to register test user")
    
    # Login with wrong password
    login_data = {
        "username": user_data["username"],
        "password": f"wrong{user_data['password']}"
    }
    
    response = client.post("/api/auth/login", json=login_data)
    
    # Check that the login fails
    assert response.status_code == 401
    assert "detail" in response.json()
    assert "Incorrect username or password" in response.json()["detail"]

def test_login_nonexistent_user():
    """Test logging in with a non-existent username"""
    # Login with a random username
    login_data = {
        "username": f"nonexistent_{generate_random_string()}",
        "password": "Password123!"
    }
    
    response = client.post("/api/auth/login", json=login_data)
    
    # Check that the login fails
    assert response.status_code == 401
    assert "detail" in response.json()
    assert "Incorrect username or password" in response.json()["detail"]

def test_get_user_profile():
    """Test getting the user profile with a valid token"""
    # Register a user
    user_data, token = register_test_user()
    
    if not token:
        pytest.fail("Failed to register test user")
    
    # Get the user profile
    response = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    # Check the response
    assert response.status_code == 200
    assert response.json()["username"] == user_data["username"]
    assert response.json()["email"] == user_data["email"]
    assert "has_openai_api_key" in response.json()

def test_get_user_profile_invalid_token():
    """Test getting the user profile with an invalid token"""
    # Try to get the user profile with an invalid token
    response = client.get(
        "/api/users/me",
        headers={"Authorization": "Bearer invalid.token.here"}
    )
    
    # Check that the request fails
    assert response.status_code == 401
    assert "detail" in response.json()
    assert "Could not validate credentials" in response.json()["detail"]

def test_refresh_token():
    """Test refreshing a valid token"""
    # Register a user
    _, token = register_test_user()
    
    if not token:
        pytest.fail("Failed to register test user")
    
    # Refresh the token
    response = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    # Check the response
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"
    
    # The new token should be different from the original
    assert response.json()["access_token"] != token

def test_full_auth_flow():
    """Test the complete authentication flow: register, login, get profile, refresh token"""
    # 1. Register a user
    user_data = generate_test_user()
    register_response = client.post("/api/auth/register", json=user_data)
    assert register_response.status_code == 200
    register_token = register_response.json()["access_token"]
    
    # 2. Get user profile with the registration token
    profile_response = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {register_token}"}
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["username"] == user_data["username"]
    
    # 3. Log out (simulate by not using the token)
    
    # 4. Log in again
    login_response = client.post("/api/auth/login", json={
        "username": user_data["username"],
        "password": user_data["password"]
    })
    assert login_response.status_code == 200
    login_token = login_response.json()["access_token"]
    
    # 5. Refresh the token
    refresh_response = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {login_token}"}
    )
    assert refresh_response.status_code == 200
    refresh_token = refresh_response.json()["access_token"]
    
    # 6. Get user profile with the refreshed token
    final_profile_response = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {refresh_token}"}
    )
    assert final_profile_response.status_code == 200
    assert final_profile_response.json()["username"] == user_data["username"]

def test_login_performance():
    """Test login performance with multiple attempts"""
    # Register a user
    user_data, _ = register_test_user()
    
    if not user_data:
        pytest.fail("Failed to register test user")
    
    # Login multiple times and measure performance
    login_data = {
        "username": user_data["username"],
        "password": user_data["password"]
    }
    
    import time
    login_times = []
    
    for _ in range(3):
        start_time = time.time()
        response = client.post("/api/auth/login", json=login_data)
        elapsed = time.time() - start_time
        
        assert response.status_code == 200
        login_times.append(elapsed)
    
    # Calculate average login time
    avg_time = sum(login_times) / len(login_times)
    print(f"Average login time: {avg_time:.2f}s")
    
    # For this test, we consider it passed if average login time is under 1 second
    # This threshold can be adjusted based on the expected performance
    assert avg_time < 1.0, f"Login is too slow: {avg_time:.2f}s"

def test_concurrent_logins():
    """Test multiple concurrent login attempts"""
    # Register several users
    users = []
    for _ in range(5):
        user_data, _ = register_test_user()
        if user_data:
            users.append(user_data)
    
    if not users:
        pytest.fail("Failed to register test users")
    
    async def login_user(user_data):
        login_data = {
            "username": user_data["username"],
            "password": user_data["password"]
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.post("/api/auth/login", json=login_data)
            return response.status_code
    
    # Login concurrently with all users
    async def run_concurrent_logins():
        tasks = [login_user(user) for user in users]
        results = await asyncio.gather(*tasks)
        return results
    
    results = asyncio.run(run_concurrent_logins())
    
    # Check that all logins were successful
    assert all(status_code == 200 for status_code in results)

# Run the tests
if __name__ == "__main__":
    pytest.main(["-xvs", __file__]) 