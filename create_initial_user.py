#!/usr/bin/env python3
"""
Create Initial User Script
--------------------------
This script creates an initial user in the database, which is needed for authentication.
Run this after setting up the application but before trying to use it.
"""

import requests
import json
import sys
import os

# Configuration
API_URL = "http://localhost:8000/api"
DEFAULT_USERNAME = "admin"
DEFAULT_EMAIL = "admin@example.com"
DEFAULT_PASSWORD = "Password123!"

def create_user(username, email, password):
    """Create a new user using the registration endpoint"""
    print(f"Creating user: {username}...")
    
    # Prepare the user data
    user_data = {
        "username": username,
        "email": email,
        "password": password
    }
    
    try:
        # Send the registration request
        response = requests.post(
            f"{API_URL}/auth/register", 
            json=user_data,
            headers={"Content-Type": "application/json"}
        )
        
        # Check the response
        if response.status_code == 200:
            token_data = response.json()
            print(f"✅ User {username} created successfully!")
            print(f"Access token: {token_data.get('access_token')[:20]}...")
            return True
        else:
            print(f"❌ Failed to create user. Status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection error. Is the backend server running?")
        print("   Make sure you start the backend server before running this script.")
        return False
    except Exception as e:
        print(f"❌ Error creating user: {str(e)}")
        return False

def main():
    """Main function to create the initial user"""
    print("==================================")
    print("  Initial User Creation Script")
    print("==================================")
    print()
    print("This script will create an initial user for the application.")
    print("The user can then be used to log in to the application.")
    print()
    
    # Check if command-line arguments were provided
    if len(sys.argv) > 1:
        username = sys.argv[1]
        email = sys.argv[2] if len(sys.argv) > 2 else f"{username}@example.com"
        password = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_PASSWORD
    else:
        # Use default values
        username = DEFAULT_USERNAME
        email = DEFAULT_EMAIL
        password = DEFAULT_PASSWORD
        
        # Confirm with the user
        print(f"No arguments provided. Using default values:")
        print(f"  Username: {username}")
        print(f"  Email: {email}")
        print(f"  Password: {password}")
        print()
        
        confirm = input("Do you want to continue with these values? (y/n): ")
        if confirm.lower() != 'y':
            print("Please run the script again with your preferred values:")
            print("python create_initial_user.py <username> <email> <password>")
            return
    
    # Create the user
    print("\nMaking sure the backend is running...")
    success = create_user(username, email, password)
    
    if success:
        print("\n✅ Initial user created successfully!")
        print("You can now log in to the application using these credentials.")
    else:
        print("\n❌ Failed to create the initial user.")
        print("Please check the error messages above and try again.")

if __name__ == "__main__":
    main() 