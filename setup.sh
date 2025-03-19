#!/bin/bash

# Exit on error
set -e

echo "🚀 Setting up pdfchat.ai..."

# Root directory
ROOT_DIR=$(pwd)
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "📁 Root directory: $ROOT_DIR"

# Create .env file for backend from example
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "📝 Creating .env file for backend..."
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    
    # Generate a random secret key
    SECRET_KEY=$(openssl rand -hex 32)
    sed -i '' "s/your_secret_key_here/$SECRET_KEY/" "$BACKEND_DIR/.env"
    
    echo "✅ Created .env file with a generated secret key"
else
    echo "✅ Backend .env file already exists"
fi

# Set up Python virtual environment for backend
echo "🐍 Setting up Python virtual environment..."
cd "$BACKEND_DIR"

# Check if venv exists
if [ ! -d "venv" ]; then
    python -m venv venv
    echo "✅ Created virtual environment"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment and install dependencies
echo "📦 Installing backend dependencies..."
source venv/bin/activate

# Make sure pip is up to date
pip install --upgrade pip

# Install dependencies with verbose output to track progress
echo "⏳ Installing Python packages (this might take a few minutes)..."
pip install -r requirements.txt -v

# Verify key dependencies are installed
echo "🔍 Verifying key dependencies..."
python -c "import sqlalchemy" || (echo "❌ SQLAlchemy not installed correctly!" && exit 1)
python -c "import fastapi" || (echo "❌ FastAPI not installed correctly!" && exit 1)
python -c "import uvicorn" || (echo "❌ Uvicorn not installed correctly!" && exit 1)

echo "✅ Python dependencies verified successfully!"

# Create a startup script for the backend
echo "📝 Creating backend startup script..."
cat > start_backend.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
python run.py
EOF

chmod +x start_backend.sh
echo "✅ Created backend startup script: start_backend.sh"

echo "🔙 Going back to root directory..."
cd "$ROOT_DIR"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install

echo "🔙 Going back to root directory..."
cd "$ROOT_DIR"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Create an enhanced start script
echo "📝 Creating enhanced start script..."
cat > start.sh << 'EOF'
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
EOF

chmod +x start.sh
echo "✅ Created enhanced start script: start.sh"

echo "✨ Setup completed successfully!"
echo ""
echo "To start the application, run:"
echo "./start.sh"
echo ""
echo "This will verify dependencies and start both the backend and frontend servers." 