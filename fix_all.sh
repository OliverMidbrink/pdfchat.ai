#!/bin/bash

echo "🔧 Running comprehensive fix script for all issues..."

# Root directory
ROOT_DIR=$(pwd)
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "📁 Working with directories:"
echo "  - Root: $ROOT_DIR"
echo "  - Backend: $BACKEND_DIR"
echo "  - Frontend: $FRONTEND_DIR"

# Fix backend issues
echo "🔧 Fixing backend issues..."

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Error: Backend directory not found at $BACKEND_DIR"
    echo "Please check the path and run this script from the correct location."
    exit 1
fi

# Create and set up virtual environment
cd "$BACKEND_DIR"
echo "🐍 Setting up virtual environment..."
python -m venv venv

# Activate virtual environment
source venv/bin/activate || { echo "❌ Failed to activate virtual environment"; exit 1; }

echo "📦 Installing backend dependencies..."
pip install --upgrade pip

# Install dependencies one by one
echo "🔄 Installing Python packages..."
pip install fastapi==0.103.1
pip install uvicorn==0.23.2
pip install sqlalchemy==2.0.20
pip install pydantic==2.3.0
pip install passlib==1.7.4
pip install python-jose==3.3.0
pip install python-multipart==0.0.6
pip install bcrypt==4.0.1
pip install openai==0.28.0
pip install python-dotenv==1.0.0
pip install email-validator==2.0.0.post2
pip install alembic==1.12.0

# Verify SQLAlchemy installation
echo "🔍 Verifying SQLAlchemy installation..."
python -c "import sqlalchemy; print('SQLAlchemy version:', sqlalchemy.__version__)" || {
    echo "❌ SQLAlchemy still not installed, trying again with no cache..."
    pip install --no-cache-dir sqlalchemy==2.0.20
}

# Create .env file if it doesn't exist
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
    # Generate a random key
    SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
    sed -i '' "s/your_secret_key_here/$SECRET_KEY/g" .env
fi

# Fix frontend issues
echo "🔧 Fixing frontend issues..."

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Error: Frontend directory not found at $FRONTEND_DIR"
    echo "Please check the path and run this script from the correct location."
    exit 1
fi

cd "$FRONTEND_DIR"

# Fix Tailwind CSS issues
echo "🔧 Fixing Tailwind CSS configuration..."

# Update postcss.config.js
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Install proper versions of tailwind
echo "📦 Installing correct Tailwind CSS packages..."
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest

# Update tailwind.config.js
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

# Fix TypeScript issues with react-icons
echo "🔧 Fixing TypeScript issues with react-icons..."

# Create types directory if it doesn't exist
mkdir -p src/types

# Create type definition file for react-icons
cat > src/types/react-icons.d.ts << 'EOF'
import { ComponentType, SVGProps } from 'react';

declare module 'react-icons/fi' {
  export interface IconBaseProps extends SVGProps<SVGElement> {
    size?: string | number;
    color?: string;
    title?: string;
  }
  
  export type IconType = ComponentType<IconBaseProps>;
  
  export const FiPlus: IconType;
  export const FiMenu: IconType;
  export const FiX: IconType;
  export const FiTrash2: IconType;
  export const FiUser: IconType;
  export const FiZap: IconType;
  export const FiSend: IconType;
  export const FiSettings: IconType;
  export const FiKey: IconType;
  export const FiLogOut: IconType;
}
EOF

# Return to root directory and update package.json to fix start scripts
cd "$ROOT_DIR"
echo "🔧 Updating package.json scripts..."

# Create a better start script
cat > start.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting application..."

ROOT_DIR=$(pwd)
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Start backend
echo "🚀 Starting backend server..."
cd "$BACKEND_DIR"
if [ -d "venv" ]; then
    source venv/bin/activate || { echo "❌ Failed to activate virtual environment"; exit 1; }
    python run.py &
    BACKEND_PID=$!
    echo "✅ Backend started with PID: $BACKEND_PID"
else
    echo "❌ Virtual environment not found. Run ./fix_all.sh first."
    exit 1
fi

# Start frontend
echo "🚀 Starting frontend server..."
cd "$FRONTEND_DIR"
npm start &
FRONTEND_PID=$!
echo "✅ Frontend started with PID: $FRONTEND_PID"

# Handle termination
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait
EOF

chmod +x start.sh

# Fix package.json scripts
echo "🔧 Updating package.json start scripts..."
cat > temp_package.json << EOF
{
  "name": "pdfchat-ai",
  "version": "1.0.0",
  "description": "AI Chat App with React frontend and FastAPI backend",
  "main": "index.js",
  "scripts": {
    "start:frontend": "cd frontend && npm start",
    "start:backend": "cd backend && source venv/bin/activate && python run.py",
    "start:backend:win": "cd backend && .\\venv\\Scripts\\activate && python run.py",
    "install:frontend": "cd frontend && npm install",
    "install:backend": "cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt",
    "install:backend:win": "cd backend && python -m venv venv && .\\venv\\Scripts\\activate && pip install -r requirements.txt",
    "install": "npm run install:frontend && npm run install:backend",
    "start": "concurrently \"npm run start:backend\" \"npm run start:frontend\"",
    "start:win": "concurrently \"npm run start:backend:win\" \"npm run start:frontend\""
  },
  "keywords": [
    "react",
    "fastapi",
    "openai",
    "chat"
  ],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
EOF

mv temp_package.json package.json

echo "✨ Fix script completed!"
echo ""
echo "To start the application, run either:"
echo "./start.sh"
echo "or"
echo "npm start"
echo ""
echo "This will start both the backend and frontend servers." 