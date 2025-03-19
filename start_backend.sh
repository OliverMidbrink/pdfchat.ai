#!/bin/bash

echo "🚀 Starting backend server..."

cd backend
if [ -d "venv" ]; then
    # Explicitly use the Python from our venv to avoid conda conflicts
    VENV_PYTHON="$(pwd)/venv/bin/python"
    
    # Check if the venv python exists
    if [ ! -f "$VENV_PYTHON" ]; then
        echo "❌ Python not found in virtual environment at $VENV_PYTHON"
        echo "Creating a fresh environment..."
        rm -rf venv
        python -m venv venv
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
        VENV_PYTHON="$(pwd)/venv/bin/python"
    else
        echo "✅ Found Python at $VENV_PYTHON"
        source venv/bin/activate
    fi
    
    # Test imports
    echo "🔍 Testing imports..."
    $VENV_PYTHON -c "import sqlalchemy; print('SQLAlchemy version:', sqlalchemy.__version__)" && echo "✅ SQLAlchemy OK" || echo "❌ SQLAlchemy FAILED"
    $VENV_PYTHON -c "import fastapi; print('FastAPI version:', fastapi.__version__)" && echo "✅ FastAPI OK" || echo "❌ FastAPI FAILED"
    $VENV_PYTHON -c "import jose; print('Python-jose OK')" && echo "✅ Python-jose OK" || echo "❌ Python-jose FAILED"
    $VENV_PYTHON -c "import multipart; print('Python-multipart OK')" && echo "✅ Python-multipart OK" || echo "❌ Python-multipart FAILED"
    
    # Try to reinstall the problematic packages if they're not found
    $VENV_PYTHON -c "import jose" || {
        echo "🔄 Reinstalling python-jose package..."
        pip uninstall -y python-jose
        pip install --no-cache-dir python-jose==3.3.0
    }
    
    $VENV_PYTHON -c "import multipart" || {
        echo "🔄 Reinstalling python-multipart package..."
        pip uninstall -y python-multipart
        pip install --no-cache-dir python-multipart==0.0.6
    }
    
    echo "🚀 Running backend server using $VENV_PYTHON..."
    $VENV_PYTHON run.py
else
    echo "❌ Virtual environment not found at $(pwd)/venv"
    echo "Creating a fresh environment..."
    python -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    echo "🚀 Running backend server..."
    python run.py
fi 