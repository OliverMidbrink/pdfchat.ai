#!/bin/bash

# Exit on error
set -e

echo "===================================="
echo "  Database and User Setup Script"
echo "===================================="
echo ""

# Root directory
ROOT_DIR=$(pwd)
BACKEND_DIR="$ROOT_DIR/backend"

echo "1. Activating Python virtual environment..."
cd "$BACKEND_DIR"
source venv/bin/activate || {
    echo "❌ Failed to activate virtual environment. Make sure setup.sh was run successfully."
    exit 1
}

# Go back to root directory
cd "$ROOT_DIR"

echo ""
echo "2. Initializing database (creating tables)..."
python init_db.py || {
    echo "❌ Failed to initialize database. See error message above."
    exit 1
}

echo ""
echo "3. Creating initial admin user..."
if [ "$#" -ge 3 ]; then
    # Use provided arguments
    python create_initial_user.py "$1" "$2" "$3"
else
    # Use default values
    python create_initial_user.py
fi

echo ""
echo "4. Verifying database file exists..."
if [ -f "$BACKEND_DIR/app.db" ]; then
    echo "✅ Database file exists at: $BACKEND_DIR/app.db"
    
    # Get file size
    DB_SIZE=$(du -h "$BACKEND_DIR/app.db" | cut -f1)
    echo "   File size: $DB_SIZE"
else
    echo "❌ Database file not found at: $BACKEND_DIR/app.db"
    echo "   This is unexpected. Please check the logs for errors."
fi

echo ""
echo "===================================="
echo "  Setup Complete"
echo "===================================="
echo ""
echo "You can now start the application with:"
echo "./start.sh"
echo ""
echo "If you experience any issues, please refer to DATABASE_SETUP.md for troubleshooting." 