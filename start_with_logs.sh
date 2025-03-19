#!/bin/bash

# Clear terminal
clear

echo "🚀 Starting pdfchat.ai application with logging..."
echo "---------------------------------------------------"

# Create logs directory if it doesn't exist
mkdir -p logs

timestamp=$(date +"%Y%m%d_%H%M%S")
BACKEND_LOG="logs/backend_${timestamp}.log"
FRONTEND_LOG="logs/frontend_${timestamp}.log"
COMBINED_LOG="logs/combined_${timestamp}.log"

echo "📊 Log files:"
echo "  - Backend:  $BACKEND_LOG"
echo "  - Frontend: $FRONTEND_LOG"
echo "  - Combined: $COMBINED_LOG"
echo ""

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

# Start the backend server with logging
echo "🚀 Starting backend with logging..."
python run.py > "../$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started with PID: $BACKEND_PID"

# Return to main directory
cd ..

# Start frontend with logging
echo "🚀 Starting frontend with logging..."
cd frontend
npm start > "../$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started with PID: $FRONTEND_PID"

# Return to main directory
cd ..

echo ""
echo "✨ Application is now running!"
echo "- Backend: http://localhost:8000"
echo "- Frontend: http://localhost:3000"
echo ""

# Start combining logs in real-time
echo "📝 Starting log monitoring..."
echo "---------------------------------------------------"
echo "Press Ctrl+C to stop watching logs (servers will continue running)"
echo "Run 'kill $BACKEND_PID $FRONTEND_PID' to stop the servers"
echo "---------------------------------------------------"

# Combine logs and show them in real-time
{
  # Run these processes in parallel
  tail -f "$BACKEND_LOG" | sed 's/^/[BACKEND] /' &
  TAIL_BACKEND_PID=$!
  
  tail -f "$FRONTEND_LOG" | sed 's/^/[FRONTEND] /' &
  TAIL_FRONTEND_PID=$!
  
  # Handle Ctrl+C to stop the tail processes but keep servers running
  trap "kill $TAIL_BACKEND_PID $TAIL_FRONTEND_PID; echo ''; echo 'Stopped watching logs'; echo 'Servers are still running in the background'; echo 'Run \"kill $BACKEND_PID $FRONTEND_PID\" to stop them'; exit" INT
  
  # Wait for tail processes to complete
  wait
} | tee -a "$COMBINED_LOG"

# This point is reached if the user presses Ctrl+C
echo ""
echo "✨ Servers are still running in the background:"
echo "- Backend (PID: $BACKEND_PID)"
echo "- Frontend (PID: $FRONTEND_PID)"
echo ""
echo "🛑 To stop the servers, run: kill $BACKEND_PID $FRONTEND_PID" 