#!/usr/bin/env python3
"""
Authentication System Test Script
--------------------------------
This script helps diagnose authentication issues by creating a test user 
and performing a complete authentication flow through register, login, and profile fetch.
"""

import requests
import json
import time
import os
import random
import string
import sys
import argparse

# API configuration
API_URL = "http://localhost:8000/api"

def generate_test_credentials():
    """Generate random test user credentials"""
    # Generate a random username with timestamp to avoid conflicts
    timestamp = int(time.time())
    username = f"testuser_{timestamp}"
    password = "".join(random.choices(string.ascii_letters + string.digits, k=12))
    email = f"{username}@example.com"
    
    return {
        "username": username,
        "password": password,
        "email": email
    }

def time_request(func):
    """Decorator to time API requests"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        elapsed_time = time.time() - start_time
        print(f"Request took {elapsed_time:.4f}s")
        return result
    return wrapper

@time_request
def register_user(credentials):
    """Register a new user and return the access token"""
    print(f"Registering new test user: {credentials['username']}")
    
    try:
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "username": credentials["username"],
                "password": credentials["password"],
                "email": credentials["email"]
            },
            timeout=10
        )
        
        response.raise_for_status()
        data = response.json()
        print(f"✅ Registration successful")
        
        access_token = data.get("access_token")
        if access_token:
            print(f"🔑 Access token received")
            return access_token
        else:
            print(f"❌ No access token in response")
            return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Registration failed: {str(e)}")
        if hasattr(e, 'response') and e.response:
            try:
                error_data = e.response.json()
                print(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Status code: {e.response.status_code}")
                print(f"Response content: {e.response.text}")
        return None

@time_request
def login_user(credentials):
    """Login with user credentials and return the access token"""
    print(f"Logging in with user: {credentials['username']}")
    
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json={
                "username": credentials["username"],
                "password": credentials["password"]
            },
            timeout=10
        )
        
        response.raise_for_status()
        data = response.json()
        print(f"✅ Login successful")
        
        access_token = data.get("access_token")
        if access_token:
            print(f"🔑 Access token received")
            return access_token
        else:
            print(f"❌ No access token in response")
            return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Login failed: {str(e)}")
        if hasattr(e, 'response') and e.response:
            try:
                error_data = e.response.json()
                print(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Status code: {e.response.status_code}")
                print(f"Response content: {e.response.text}")
        return None

@time_request
def fetch_user_profile(access_token):
    """Fetch the user profile using the given access token"""
    print("Fetching user profile...")
    
    try:
        response = requests.get(
            f"{API_URL}/users/me",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10
        )
        
        response.raise_for_status()
        data = response.json()
        print(f"✅ Profile fetch successful")
        print(f"User profile: {json.dumps(data, indent=2)}")
        return data
    except requests.exceptions.RequestException as e:
        print(f"❌ Profile fetch failed: {str(e)}")
        if hasattr(e, 'response') and e.response:
            try:
                error_data = e.response.json()
                print(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Status code: {e.response.status_code}")
                print(f"Response content: {e.response.text}")
        return None

@time_request
def refresh_token(access_token):
    """Refresh the access token"""
    print("Refreshing access token...")
    
    try:
        response = requests.post(
            f"{API_URL}/auth/refresh",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10
        )
        
        response.raise_for_status()
        data = response.json()
        print(f"✅ Token refresh successful")
        
        new_access_token = data.get("access_token")
        if new_access_token:
            print(f"🔑 New access token received")
            return new_access_token
        else:
            print(f"❌ No access token in response")
            return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Token refresh failed: {str(e)}")
        if hasattr(e, 'response') and e.response:
            try:
                error_data = e.response.json()
                print(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Status code: {e.response.status_code}")
                print(f"Response content: {e.response.text}")
        return None

def test_full_authentication_flow():
    """Test the full authentication flow"""
    print("\n========== TESTING FULL AUTHENTICATION FLOW ==========\n")
    
    # Generate test credentials
    credentials = generate_test_credentials()
    print(f"Generated test credentials:")
    print(f"Username: {credentials['username']}")
    print(f"Password: {credentials['password']}")
    print(f"Email: {credentials['email']}")
    print()
    
    # Register user
    print("\n----- STEP 1: REGISTER USER -----\n")
    register_token = register_user(credentials)
    if not register_token:
        print("❌ Registration failed, cannot continue test")
        return False
    
    # Login
    print("\n----- STEP 2: LOGIN USER -----\n")
    login_token = login_user(credentials)
    if not login_token:
        print("❌ Login failed, cannot continue test")
        return False
    
    # Fetch profile
    print("\n----- STEP 3: FETCH USER PROFILE -----\n")
    user_profile = fetch_user_profile(login_token)
    if not user_profile:
        print("❌ Profile fetch failed, cannot continue test")
        return False
    
    # Refresh token
    print("\n----- STEP 4: REFRESH TOKEN -----\n")
    refreshed_token = refresh_token(login_token)
    if not refreshed_token:
        print("❌ Token refresh failed")
        return False
    
    # Fetch profile with refreshed token
    print("\n----- STEP 5: FETCH PROFILE WITH REFRESHED TOKEN -----\n")
    refreshed_profile = fetch_user_profile(refreshed_token)
    if not refreshed_profile:
        print("❌ Profile fetch with refreshed token failed")
        return False
    
    print("\n✅ FULL AUTHENTICATION FLOW TEST PASSED!")
    print(f"Test user '{credentials['username']}' successfully created and tested.")
    
    # Save test credentials to file for future use
    with open('test_user_credentials.json', 'w') as f:
        json.dump(credentials, f, indent=2)
    print(f"Test credentials saved to test_user_credentials.json")
    
    return True

def login_test_with_credentials(username, password):
    """Test login with provided credentials"""
    print(f"\n========== TESTING LOGIN WITH PROVIDED CREDENTIALS ==========\n")
    
    credentials = {
        "username": username,
        "password": password,
        "email": None  # Not needed for login
    }
    
    # Login
    login_token = login_user(credentials)
    if not login_token:
        print("❌ Login failed")
        return False
    
    # Fetch profile
    user_profile = fetch_user_profile(login_token)
    if not user_profile:
        print("❌ Profile fetch failed")
        return False
    
    print("\n✅ LOGIN TEST PASSED!")
    return True

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Test authentication flow')
    parser.add_argument('--username', help='Username for login test')
    parser.add_argument('--password', help='Password for login test')
    parser.add_argument('--new', action='store_true', help='Create a new test user')
    args = parser.parse_args()
    
    # Check if we should create a new user or use existing credentials
    if args.username and args.password:
        login_test_with_credentials(args.username, args.password)
    elif args.new or (not args.username and not args.password):
        test_full_authentication_flow()
    else:
        parser.print_help()

if __name__ == "__main__":
    main() 