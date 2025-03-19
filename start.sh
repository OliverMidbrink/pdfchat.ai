#!/bin/bash

echo "🚀 Starting pdfchat.ai application..."

# Run backend in background
echo "🚀 Starting backend server..."
./start_backend.sh &
BACKEND_PID=$!
echo "✅ Backend started with PID $BACKEND_PID"

# Wait a bit for backend to initialize
sleep 2

# Run frontend in background
echo "🚀 Starting frontend..."
./start_frontend.sh &
FRONTEND_PID=$!
echo "✅ Frontend started with PID $FRONTEND_PID"

echo ""
echo "✨ Application is now running!"
echo "- Backend: http://localhost:8000"
echo "- Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Handle termination
trap "echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for any process to exit
wait $BACKEND_PID $FRONTEND_PID

# Exit with status of process that exited first
exit $?
