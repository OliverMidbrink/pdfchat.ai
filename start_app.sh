#!/bin/bash

echo "🚀 Starting the full application..."

# Start backend first
echo "🚀 Starting backend server..."
cd backend
if [ -d "venv" ]; then
    echo "✅ Found virtual environment"
    source venv/bin/activate
    echo "✅ Activated virtual environment"
else
    echo "❌ Virtual environment not found, creating one..."
    python -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
fi

# Start the backend server in the background
python run.py &
BACKEND_PID=$!
echo "✅ Backend started with PID: $BACKEND_PID"

# Return to main directory
cd ..

# Start frontend
echo "🚀 Starting frontend..."
cd frontend
npm start &
FRONTEND_PID=$!
echo "✅ Frontend started with PID: $FRONTEND_PID"

echo ""
echo "✨ Application is running!"
echo "- Backend: http://localhost:8000"
echo "- Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Handle graceful termination
trap "echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for any process to exit
wait $BACKEND_PID $FRONTEND_PID

# Exit with status of process that exited first
exit $? 