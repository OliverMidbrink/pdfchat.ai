#!/bin/bash

echo "🚀 Starting frontend with logging..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Run the frontend with output to log file
cd frontend
echo "📁 Working from $(pwd)"
echo "📝 Starting npm and logging to ../logs/frontend.log"
npm start > ../logs/frontend.log 2>&1 &
PID=$!

echo "✅ Frontend started with PID: $PID"
echo "📊 Tailing log file (press Ctrl+C to stop viewing logs)..."
echo ""

# Give it a second to start up
sleep 2

# Tail the log file
tail -f ../logs/frontend.log 