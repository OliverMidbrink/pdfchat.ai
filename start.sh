#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting pdfchat.ai application..."

# Root directory
ROOT_DIR=$(pwd)
BACKEND_DIR="$ROOT_DIR/backend"

# First check if backend dependencies are installed
cd "$BACKEND_DIR"
source venv/bin/activate

# Quick dependency check
echo "🔍 Checking backend dependencies..."
if ! python -c "import sqlalchemy" &>/dev/null; then
    echo "❌ SQLAlchemy not found. Please run setup.sh first."
    exit 1
fi

# Return to root directory
cd "$ROOT_DIR"

# Start the application
echo "🚀 Starting frontend and backend servers..."
npm start
