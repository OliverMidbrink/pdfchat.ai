#!/bin/bash

# Exit on error
set -e

echo "🔍 Running diagnostics for pdfchat.ai..."

# Root directory
ROOT_DIR=$(pwd)
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Check if we're in the right directory
if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Error: Not in the project root directory."
    echo "Please run this script from the root of the pdfchat.ai project."
    exit 1
fi

echo "✅ Running from correct directory: $ROOT_DIR"

# Check if the virtual environment exists
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "❌ Error: Python virtual environment not found."
    echo "Running setup to create virtual environment..."
    ./setup.sh
else
    echo "✅ Python virtual environment exists"
    
    # Check if key Python packages are installed
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    echo "🔍 Checking Python dependencies..."
    
    # Array of key packages to check
    packages=("fastapi" "uvicorn" "sqlalchemy" "pydantic" "passlib" "python-jose" "python-multipart" "bcrypt" "openai")
    missing_packages=()
    
    for package in "${packages[@]}"; do
        if ! python -c "import $package" &>/dev/null; then
            echo "❌ Package not found: $package"
            missing_packages+=("$package")
        else
            echo "✅ Found package: $package"
        fi
    done
    
    # If there are missing packages, reinstall requirements
    if [ ${#missing_packages[@]} -gt 0 ]; then
        echo "🔄 Reinstalling Python requirements to fix missing packages..."
        pip install --upgrade pip
        pip install -r requirements.txt -v
        
        # Check again after installation
        for package in "${missing_packages[@]}"; do
            if ! python -c "import $package" &>/dev/null; then
                echo "❌ Failed to install: $package"
                echo "Try manually installing with: pip install $package"
            else
                echo "✅ Successfully installed: $package"
            fi
        done
    fi
    
    deactivate
    cd "$ROOT_DIR"
fi

# Check if backend .env file exists
if [ ! -f "$BACKEND_DIR/.env" ]; then
    if [ -f "$BACKEND_DIR/.env.example" ]; then
        echo "❌ Backend .env file missing. Creating from example..."
        cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
        
        # Generate a random secret key
        SECRET_KEY=$(openssl rand -hex 32)
        sed -i '' "s/your_secret_key_here/$SECRET_KEY/" "$BACKEND_DIR/.env"
        
        echo "✅ Created .env file with a generated secret key"
    else
        echo "❌ Error: Both .env and .env.example are missing!"
        echo "Please create a .env file in the backend directory."
    fi
else
    echo "✅ Backend .env file exists"
fi

# Check for npm in frontend and root
echo "🔍 Checking npm packages..."

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "❌ Frontend node_modules not found."
    echo "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm install
    cd "$ROOT_DIR"
else
    echo "✅ Frontend dependencies installed"
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
    echo "❌ Root node_modules not found."
    echo "Installing root dependencies..."
    npm install
else
    echo "✅ Root dependencies installed"
fi

echo ""
echo "🔍 Diagnosis Summary:"
echo "======================"

cd "$BACKEND_DIR"
source venv/bin/activate
SQLALCHEMY_INSTALLED=$(python -c "import sqlalchemy; print('Yes')" 2>/dev/null || echo "No")
FASTAPI_INSTALLED=$(python -c "import fastapi; print('Yes')" 2>/dev/null || echo "No")
UVICORN_INSTALLED=$(python -c "import uvicorn; print('Yes')" 2>/dev/null || echo "No")
deactivate
cd "$ROOT_DIR"

FRONTEND_READY=$([ -d "$FRONTEND_DIR/node_modules" ] && echo "Yes" || echo "No")
ROOT_READY=$([ -d "$ROOT_DIR/node_modules" ] && echo "Yes" || echo "No")
ENV_READY=$([ -f "$BACKEND_DIR/.env" ] && echo "Yes" || echo "No")

echo "Backend:"
echo "  - SQLAlchemy installed: $SQLALCHEMY_INSTALLED"
echo "  - FastAPI installed: $FASTAPI_INSTALLED"
echo "  - Uvicorn installed: $UVICORN_INSTALLED"
echo "  - Environment file (.env): $ENV_READY"
echo ""
echo "Frontend:"
echo "  - Dependencies installed: $FRONTEND_READY"
echo ""
echo "Root:"
echo "  - Dependencies installed: $ROOT_READY"
echo ""

# Final advice
if [[ "$SQLALCHEMY_INSTALLED" == "Yes" && 
      "$FASTAPI_INSTALLED" == "Yes" && 
      "$UVICORN_INSTALLED" == "Yes" && 
      "$ENV_READY" == "Yes" && 
      "$FRONTEND_READY" == "Yes" && 
      "$ROOT_READY" == "Yes" ]]; then
    echo "✅ All checks passed! Your environment appears to be configured correctly."
    echo ""
    echo "To start the application, run:"
    echo "./start.sh"
else
    echo "❌ Some issues were found. Please review the diagnostics above."
    echo ""
    echo "Try running the setup script first:"
    echo "./setup.sh"
    echo ""
    echo "If problems persist, please check the specific error messages and fix accordingly."
fi 