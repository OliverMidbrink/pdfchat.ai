#!/bin/bash

echo "🔧 Running dependency fix script..."

# Root directory
ROOT_DIR=$(pwd)
BACKEND_DIR="$ROOT_DIR/backend"

# Go to backend directory and activate virtual environment
cd "$BACKEND_DIR"

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "❌ Error: Virtual environment not found. Creating a new one..."
    python -m venv venv
fi

# Activate the virtual environment
source venv/bin/activate

echo "🔄 Upgrading pip..."
pip install --upgrade pip

echo "🔄 Forcefully reinstalling SQLAlchemy..."
pip uninstall -y sqlalchemy
pip install sqlalchemy==2.0.20 --no-cache-dir

echo "🔄 Installing specific required packages one by one..."
pip install fastapi==0.103.1 --no-cache-dir
pip install uvicorn==0.23.2 --no-cache-dir
pip install pydantic==2.3.0 --no-cache-dir
pip install passlib==1.7.4 --no-cache-dir
pip install python-jose==3.3.0 --no-cache-dir
pip install python-multipart==0.0.6 --no-cache-dir
pip install bcrypt==4.0.1 --no-cache-dir
pip install openai==0.28.0 --no-cache-dir
pip install python-dotenv==1.0.0 --no-cache-dir
pip install email-validator==2.0.0.post2 --no-cache-dir
pip install alembic==1.12.0 --no-cache-dir

# Try installing without version constraints if specific versions don't work
echo "🔄 Installing any remaining packages from requirements.txt..."
pip install -r requirements.txt

# Verify that SQLAlchemy is properly installed
echo "🔍 Verifying SQLAlchemy installation..."
if python -c "import sqlalchemy; print('SQLAlchemy version:', sqlalchemy.__version__)" &>/dev/null; then
    echo "✅ SQLAlchemy installed successfully!"
else
    echo "❌ SQLAlchemy still not installed correctly. Trying a different approach..."
    pip install --upgrade sqlalchemy
    
    # Check again
    if python -c "import sqlalchemy; print('SQLAlchemy version:', sqlalchemy.__version__)" &>/dev/null; then
        echo "✅ SQLAlchemy installed successfully on second attempt!"
    else
        echo "❌ SQLAlchemy installation failed. Please try installing manually with 'pip install sqlalchemy'"
    fi
fi

# Go back to root directory
cd "$ROOT_DIR"

echo "🔧 Fixing frontend TypeScript issues..."
cd "$FRONTEND_DIR"

# Create a proper type declaration file for react-icons
mkdir -p src/types
cat > src/types/react-icons.d.ts << 'EOF'
declare module 'react-icons/fi' {
  import { ComponentType, SVGAttributes } from 'react';
  
  export interface IconBaseProps extends SVGAttributes<SVGElement> {
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

echo "✅ Created type declaration file for react-icons"

# Go back to root directory
cd "$ROOT_DIR"

echo "✨ Fix script completed! Try running the app now with:"
echo "./start.sh" 