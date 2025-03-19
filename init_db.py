#!/usr/bin/env python3
"""
Initialize Database Script
-------------------------
This script explicitly initializes the database by creating all necessary tables.
Run this after setting up the application but before starting it.
"""

import os
import sys
import importlib.util

# Set up sys.path to include the backend directory
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, 'backend')
sys.path.insert(0, backend_dir)

def main():
    """Main function to initialize the database"""
    print("==================================")
    print("  Database Initialization Script")
    print("==================================")
    print()
    
    # Check if the backend directory exists
    if not os.path.isdir(backend_dir):
        print(f"❌ Backend directory not found at: {backend_dir}")
        print("Make sure you're running this script from the project root directory.")
        return False
    
    try:
        # Try to import the required modules
        print("Importing required modules...")
        from app.db.session import create_tables, engine, Base
        from app.models.user import User
        from app.models.chat import Chat
        
        print(f"✅ Successfully imported the necessary modules.")
        
        # Create the database tables
        print("Creating database tables...")
        create_tables()
        
        # Verify the tables were created
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        print(f"Tables created: {', '.join(tables)}")
        
        # Check if the users table exists
        if 'users' in tables:
            print("✅ Users table created successfully.")
        else:
            print("❌ Failed to create users table.")
            return False
            
        print("\nDatabase initialization complete!")
        print("You can now create an initial user with create_initial_user.py")
        return True
        
    except ImportError as e:
        print(f"❌ Failed to import required modules: {str(e)}")
        print("Make sure you have installed all requirements and have the correct directory structure.")
        print("Try activating the Python virtual environment: source backend/venv/bin/activate")
        return False
    except Exception as e:
        print(f"❌ Error initializing database: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1) 