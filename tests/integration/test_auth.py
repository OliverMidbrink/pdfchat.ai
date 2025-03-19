#!/usr/bin/env python3
"""
Authentication Test Script for pdfchat.ai
-----------------------------------------
This script tests the core authentication functionality:
1. User registration
2. User login
3. User profile retrieval
4. Token refresh
5. User deletion

Usage:
    python test_auth.py [--verbose]
"""

import argparse
import json
import random
import string
import sys
import time
import requests
from requests.exceptions import ConnectionError, Timeout
from typing import Dict, Any, Optional, Tuple

# Configuration
API_URL = "http://localhost:8000/api"
FRONTEND_URL = "http://localhost:3000"
DEFAULT_TIMEOUT = 10  # seconds

# Colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "total": 0
}

verbose_mode = False

def log(message: str, color: str = "") -> None:
    """Print a message with optional color"""
    if color:
        print(f"{color}{message}{Colors.END}")
    else:
        print(message)

def log_verbose(message: str) -> None:
    """Print a message only in verbose mode"""
    if verbose_mode:
        print(f"  {message}")

def generate_test_user() -> Dict[str, str]:
    """Generate a random test user"""
    random_string = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return {
        "username": f"testuser_{random_string}",
        "email": f"test_{random_string}@example.com",
        "password": f"Password{random_string}123!"
    }

def make_request(method: str, endpoint: str, data: Dict = None, token: str = None, expected_status: int = 200) -> Tuple[Optional[Dict], bool]:
    """Make an HTTP request to the API with proper error handling"""
    url = f"{API_URL}{endpoint}"
    headers = {}
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        start_time = time.time()
        
        if method.lower() == "get":
            response = requests.get(url, headers=headers, timeout=DEFAULT_TIMEOUT)
        elif method.lower() == "post":
            response = requests.post(url, json=data, headers=headers, timeout=DEFAULT_TIMEOUT)
        elif method.lower() == "put":
            response = requests.put(url, json=data, headers=headers, timeout=DEFAULT_TIMEOUT)
        elif method.lower() == "delete":
            response = requests.delete(url, headers=headers, timeout=DEFAULT_TIMEOUT)
        else:
            log(f"Unsupported HTTP method: {method}", Colors.RED)
            return None, False
        
        elapsed = time.time() - start_time
        
        log_verbose(f"{method.upper()} {endpoint} -> Status: {response.status_code} (Time: {elapsed:.2f}s)")
        
        # Check if status code matches expected
        if response.status_code != expected_status:
            log_verbose(f"Expected status {expected_status}, got {response.status_code}")
            if verbose_mode:
                try:
                    log_verbose(f"Response: {json.dumps(response.json(), indent=2)}")
                except:
                    log_verbose(f"Raw response: {response.text}")
            return None, False
        
        # For successful responses, try to parse JSON
        try:
            return response.json(), True
        except:
            # If response isn't JSON but status code was as expected
            if response.status_code == expected_status:
                return {"status": "success", "text": response.text}, True
            return None, False
    
    except Timeout:
        log_verbose(f"Request timeout for {endpoint}")
        return None, False
    except ConnectionError:
        log_verbose(f"Connection error for {endpoint}")
        return None, False
    except Exception as e:
        log_verbose(f"Error making request to {endpoint}: {str(e)}")
        return None, False

def run_test(name: str, test_func, *args, **kwargs) -> bool:
    """Run a test and track results"""
    test_results["total"] += 1
    
    log(f"\n{Colors.BOLD}Running test: {name}{Colors.END}")
    
    try:
        start_time = time.time()
        result = test_func(*args, **kwargs)
        elapsed = time.time() - start_time
        
        if result:
            test_results["passed"] += 1
            log(f"{Colors.GREEN}✓ PASS: {name} ({elapsed:.2f}s){Colors.END}")
            return True
        else:
            test_results["failed"] += 1
            log(f"{Colors.RED}✗ FAIL: {name} ({elapsed:.2f}s){Colors.END}")
            return False
    except Exception as e:
        test_results["failed"] += 1
        log(f"{Colors.RED}✗ ERROR: {name} - {str(e)}{Colors.END}")
        return False

def check_server_health() -> bool:
    """Check if the backend is running"""
    log("Checking backend health...")
    
    try:
        response = requests.get(f"{API_URL.split('/api')[0]}/health", timeout=DEFAULT_TIMEOUT)
        if response.status_code == 200:
            log(f"{Colors.GREEN}Backend is running.{Colors.END}")
            return True
        else:
            log(f"{Colors.RED}Backend returned status code {response.status_code}.{Colors.END}")
            return False
    except Exception as e:
        log(f"{Colors.RED}Backend connection error: {str(e)}{Colors.END}")
        return False

def check_frontend_health() -> bool:
    """Check if the frontend is running"""
    log("Checking frontend health...")
    
    try:
        response = requests.get(FRONTEND_URL, timeout=DEFAULT_TIMEOUT)
        if response.status_code == 200:
            log(f"{Colors.GREEN}Frontend is running.{Colors.END}")
            return True
        else:
            log(f"{Colors.RED}Frontend returned status code {response.status_code}.{Colors.END}")
            return False
    except Exception as e:
        log(f"{Colors.RED}Frontend connection error: {str(e)}{Colors.END}")
        return False

def test_register_user(test_user: Dict[str, str]) -> Optional[str]:
    """Test user registration"""
    log_verbose(f"Registering user: {test_user['username']}")
    
    response, success = make_request(
        "post", 
        "/auth/register", 
        data=test_user,
        expected_status=200
    )
    
    if not success:
        return None
    
    # Verify that we got back a token
    if "access_token" not in response:
        log_verbose("No access token in response")
        return None
    
    log_verbose(f"Registered user {test_user['username']} successfully")
    return response["access_token"]

def test_login_user(username: str, password: str) -> Optional[str]:
    """Test user login"""
    log_verbose(f"Logging in as: {username}")
    
    response, success = make_request(
        "post", 
        "/auth/login", 
        data={"username": username, "password": password},
        expected_status=200
    )
    
    if not success:
        return None
    
    # Verify that we got back a token
    if "access_token" not in response:
        log_verbose("No access token in response")
        return None
    
    log_verbose(f"Logged in as {username} successfully")
    return response["access_token"]

def test_get_user_profile(token: str) -> Optional[Dict]:
    """Test retrieving the user profile"""
    log_verbose("Getting user profile")
    
    response, success = make_request(
        "get", 
        "/users/me", 
        token=token,
        expected_status=200
    )
    
    if not success:
        return None
    
    # Verify that we got back user data
    if "username" not in response:
        log_verbose("No username in profile response")
        return None
    
    log_verbose(f"Retrieved profile for {response['username']} successfully")
    return response

def test_refresh_token(token: str) -> Optional[str]:
    """Test refreshing the auth token"""
    log_verbose("Refreshing token")
    
    response, success = make_request(
        "post", 
        "/auth/refresh", 
        token=token,
        expected_status=200
    )
    
    if not success:
        return None
    
    # Verify that we got back a token
    if "access_token" not in response:
        log_verbose("No access token in refresh response")
        return None
    
    log_verbose("Refreshed token successfully")
    return response["access_token"]

def test_complete_user_flow() -> bool:
    """Test the complete user flow including registration, login, profile, and refresh"""
    # Generate test user
    test_user = generate_test_user()
    
    # Test registration
    token = test_register_user(test_user)
    if not token:
        log_verbose("Registration failed")
        return False
    
    # Test profile retrieval
    user_profile = test_get_user_profile(token)
    if not user_profile:
        log_verbose("Profile retrieval failed")
        return False
    
    # Verify user details
    if user_profile["username"] != test_user["username"]:
        log_verbose(f"Username mismatch: {user_profile['username']} vs {test_user['username']}")
        return False
    
    # Test token refresh
    new_token = test_refresh_token(token)
    if not new_token:
        log_verbose("Token refresh failed")
        return False
    
    # Test login
    login_token = test_login_user(test_user["username"], test_user["password"])
    if not login_token:
        log_verbose("Login failed")
        return False
    
    return True

def test_login_with_wrong_password() -> bool:
    """Test login with wrong password"""
    # Generate test user
    test_user = generate_test_user()
    
    # Register user
    token = test_register_user(test_user)
    if not token:
        log_verbose("Registration failed")
        return False
    
    # Try to login with wrong password
    wrong_password = test_user["password"] + "wrong"
    login_result = test_login_user(test_user["username"], wrong_password)
    
    # If login succeeds with wrong password, that's a security issue
    if login_result:
        log_verbose("Login succeeded with wrong password! Security issue!")
        return False
    
    return True

def test_login_nonexistent_user() -> bool:
    """Test login with non-existent user"""
    nonexistent_user = generate_test_user()
    
    # Try to login with non-existent user
    login_result = test_login_user(nonexistent_user["username"], nonexistent_user["password"])
    
    # If login succeeds with non-existent user, that's a security issue
    if login_result:
        log_verbose("Login succeeded with non-existent user! Security issue!")
        return False
    
    return True

def test_login_performance() -> bool:
    """Test login performance"""
    # Generate test user
    test_user = generate_test_user()
    
    # Register user first
    token = test_register_user(test_user)
    if not token:
        log_verbose("Registration failed")
        return False
    
    # Test login performance with multiple attempts
    login_times = []
    
    for i in range(3):
        start_time = time.time()
        login_token = test_login_user(test_user["username"], test_user["password"])
        elapsed = time.time() - start_time
        login_times.append(elapsed)
        
        if not login_token:
            log_verbose(f"Login attempt {i+1} failed")
            return False
        
        log_verbose(f"Login attempt {i+1} took {elapsed:.2f}s")
        
        # Brief pause between attempts
        time.sleep(0.5)
    
    # Calculate average login time
    avg_time = sum(login_times) / len(login_times)
    log_verbose(f"Average login time: {avg_time:.2f}s")
    
    # For this test, we'll consider it passed if average login time is under 2 seconds
    # Adjust as needed for your environment
    return avg_time < 2.0

def test_token_validation() -> bool:
    """Test that invalid tokens are rejected"""
    # Try to get user profile with invalid token
    invalid_token = "invalid.token.here"
    
    response, success = make_request(
        "get", 
        "/users/me", 
        token=invalid_token,
        expected_status=401  # We expect a 401 Unauthorized
    )
    
    # If we get a 401, that's the expected behavior for an invalid token
    return success

def run_all_tests() -> None:
    """Run all authentication tests"""
    log(f"\n{Colors.HEADER}Running Authentication Tests{Colors.END}")
    
    # Check if services are running
    backend_running = check_server_health()
    frontend_running = check_frontend_health()
    
    if not backend_running:
        log(f"{Colors.RED}Backend is not running. Tests cannot proceed.{Colors.END}")
        return
    
    # We can still run most tests even if frontend is not responding
    if not frontend_running:
        log(f"{Colors.YELLOW}Warning: Frontend is not responding but we'll continue with backend tests.{Colors.END}")
    
    # Run all tests
    run_test("Complete user flow (register, profile, refresh, login)", test_complete_user_flow)
    run_test("Login with wrong password (should fail)", test_login_with_wrong_password)
    run_test("Login with non-existent user (should fail)", test_login_nonexistent_user)
    run_test("Login performance test", test_login_performance)
    run_test("Token validation test", test_token_validation)
    
    # Summary
    print("\n" + "="*50)
    log(f"{Colors.BOLD}Test Summary:{Colors.END}")
    log(f"Total tests: {test_results['total']}")
    log(f"{Colors.GREEN}Passed: {test_results['passed']}{Colors.END}")
    log(f"{Colors.RED}Failed: {test_results['failed']}{Colors.END}")
    log(f"{Colors.YELLOW}Skipped: {test_results['skipped']}{Colors.END}")
    
    if test_results['failed'] == 0:
        log(f"\n{Colors.GREEN}All tests passed!{Colors.END}")
    else:
        log(f"\n{Colors.RED}Some tests failed.{Colors.END}")

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Test authentication functionality")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show verbose output")
    args = parser.parse_args()
    
    verbose_mode = args.verbose
    
    run_all_tests() 