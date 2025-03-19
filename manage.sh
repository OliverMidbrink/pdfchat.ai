#!/bin/bash

# Application management script for pdfchat.ai
# Functions: start, stop, restart, status, logs, and more

# Configuration
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
LOGS_DIR="logs"
PID_FILE=".running.pid"  # Store PIDs of running processes
BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"

# ANSI color codes for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Create directories if they don't exist
mkdir -p "$LOGS_DIR"

# Print a nicely formatted header
print_header() {
    echo -e "\n${BLUE}┌─────────────────────────────────────────────┐${NC}"
    echo -e "${BLUE}│${NC}  ${CYAN}pdfchat.ai${NC} Application Manager            ${BLUE}│${NC}"
    echo -e "${BLUE}└─────────────────────────────────────────────┘${NC}\n"
}

# Check if services are running (process check only)
check_process_status() {
    if [ -f "$PID_FILE" ]; then
        read BACKEND_PID FRONTEND_PID < "$PID_FILE"
        
        BACKEND_RUNNING=0
        FRONTEND_RUNNING=0
        
        if ps -p $BACKEND_PID > /dev/null; then
            BACKEND_RUNNING=1
        fi
        
        if ps -p $FRONTEND_PID > /dev/null; then
            FRONTEND_RUNNING=1
        fi
        
        if [ $BACKEND_RUNNING -eq 1 ] && [ $FRONTEND_RUNNING -eq 1 ]; then
            return 0  # Both running
        elif [ $BACKEND_RUNNING -eq 1 ]; then
            return 1  # Only backend running
        elif [ $FRONTEND_RUNNING -eq 1 ]; then
            return 2  # Only frontend running
        else
            return 3  # Neither running but PID file exists
        fi
    else
        return 4  # PID file doesn't exist
    fi
}

# More detailed health check that checks if services are actually responding
check_health() {
    check_process_status
    PROCESS_STATUS=$?
    
    BACKEND_HEALTHY=0
    FRONTEND_HEALTHY=0
    
    # Check backend health
    if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 1 ]; then
        # Backend process is running, check if it's responding
        if curl --silent --max-time 2 "$BACKEND_URL/health" > /dev/null; then
            BACKEND_HEALTHY=1
        else
            # Try the docs endpoint as a fallback
            if curl --silent --max-time 2 "$BACKEND_URL/docs" > /dev/null; then
                BACKEND_HEALTHY=1
            fi
        fi
    fi
    
    # Check frontend health
    if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 2 ]; then
        # Frontend process is running, check if it's responding
        if curl --silent --max-time 2 "$FRONTEND_URL" > /dev/null; then
            FRONTEND_HEALTHY=1
        fi
    fi
    
    if [ $BACKEND_HEALTHY -eq 1 ] && [ $FRONTEND_HEALTHY -eq 1 ]; then
        return 0  # Both healthy
    elif [ $BACKEND_HEALTHY -eq 1 ] && [ $FRONTEND_HEALTHY -eq 0 ]; then
        return 1  # Only backend healthy
    elif [ $BACKEND_HEALTHY -eq 0 ] && [ $FRONTEND_HEALTHY -eq 1 ]; then
        return 2  # Only frontend healthy
    else
        return 3  # Neither healthy
    fi
}

# Print status of services
show_status() {
    check_process_status
    PROCESS_STATUS=$?
    
    # Optionally check health if processes are running
    if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 1 ] || [ $PROCESS_STATUS -eq 2 ]; then
        check_health
        HEALTH_STATUS=$?
    else
        HEALTH_STATUS=3  # Neither healthy if processes aren't running
    fi
    
    echo -e "${BLUE}===${NC} ${CYAN}Application Status${NC} ${BLUE}===${NC}"
    
    if [ -f "$PID_FILE" ]; then
        read BACKEND_PID FRONTEND_PID < "$PID_FILE"
        
        # Backend status
        echo -ne "Backend:  "
        if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 1 ]; then
            echo -ne "${GREEN}RUNNING${NC} (PID: $BACKEND_PID) "
            if [ $HEALTH_STATUS -eq 0 ] || [ $HEALTH_STATUS -eq 1 ]; then
                echo -e "${GREEN}[HEALTHY]${NC}"
            else
                echo -e "${RED}[NOT RESPONDING]${NC}"
            fi
        else
            echo -e "${RED}NOT RUNNING${NC}"
        fi
        
        # Frontend status
        echo -ne "Frontend: "
        if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 2 ]; then
            echo -ne "${GREEN}RUNNING${NC} (PID: $FRONTEND_PID) "
            if [ $HEALTH_STATUS -eq 0 ] || [ $HEALTH_STATUS -eq 2 ]; then
                echo -e "${GREEN}[HEALTHY]${NC}"
            else
                echo -e "${RED}[NOT RESPONDING]${NC}"
            fi
        else
            echo -e "${RED}NOT RUNNING${NC}"
        fi
        
        # Overall application status
        echo -e "\nApplication is "
        if [ $HEALTH_STATUS -eq 0 ]; then
            echo -e "${GREEN}fully operational${NC}"
        elif [ $HEALTH_STATUS -eq 1 ] || [ $HEALTH_STATUS -eq 2 ]; then
            echo -e "${YELLOW}partially operational${NC}"
        else
            if [ $PROCESS_STATUS -eq 0 ]; then
                echo -e "${RED}running but not responding${NC}"
            else
                echo -e "${RED}not running correctly${NC}"
            fi
        fi
    else
        echo -e "Backend:  ${RED}NOT RUNNING${NC}"
        echo -e "Frontend: ${RED}NOT RUNNING${NC}"
        echo -e "\nApplication is ${RED}not running${NC}"
    fi
    
    echo -e "\nEndpoints:"
    echo -e "Frontend URL: ${CYAN}$FRONTEND_URL${NC}"
    echo -e "Backend URL:  ${CYAN}$BACKEND_URL${NC}"
}

# Start services and create log files
start_services() {
    # Check if already running
    check_process_status
    PROCESS_STATUS=$?
    
    if [ $PROCESS_STATUS -eq 0 ]; then
        echo -e "${YELLOW}Application is already running!${NC}"
        show_status
        return 1
    fi
    
    # Check if ports are available
    if lsof -i :8000 > /dev/null 2>&1; then
        echo -e "${RED}ERROR:${NC} Port 8000 is already in use!"
        echo -e "Use '${CYAN}lsof -i :8000${NC}' to find the process using it"
        echo -e "Use '${CYAN}./manage.sh stop${NC}' to clean up any existing processes"
        return 1
    fi
    
    if lsof -i :3000 > /dev/null 2>&1; then
        echo -e "${RED}ERROR:${NC} Port 3000 is already in use!"
        echo -e "Use '${CYAN}lsof -i :3000${NC}' to find the process using it"
        echo -e "Use '${CYAN}./manage.sh stop${NC}' to clean up any existing processes"
        return 1
    fi
    
    echo -e "${BLUE}Starting application services...${NC}"
    
    # Generate log file names with timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    BACKEND_LOG="$LOGS_DIR/backend_${timestamp}.log"
    FRONTEND_LOG="$LOGS_DIR/frontend_${timestamp}.log"
    
    echo -e "📊 Log files:"
    echo -e "  - Backend:  ${CYAN}$BACKEND_LOG${NC}"
    echo -e "  - Frontend: ${CYAN}$FRONTEND_LOG${NC}"
    
    # Start backend
    echo -e "\n${BLUE}Starting backend server...${NC}"
    cd "$BACKEND_DIR"
    
    # Check for virtual environment
    if [ -d "venv" ]; then
        echo -e "${GREEN}✓${NC} Found virtual environment"
        source venv/bin/activate
    else
        echo -e "${YELLOW}!${NC} Virtual environment not found, creating one..."
        python -m venv venv
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
    fi
    
    # Start backend with logging
    python run.py > "../$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    echo -e "${GREEN}✓${NC} Backend started with PID: ${CYAN}$BACKEND_PID${NC}"
    
    # Return to main directory
    cd ..
    
    # Start frontend
    echo -e "\n${BLUE}Starting frontend...${NC}"
    cd "$FRONTEND_DIR"
    npm start > "../$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo -e "${GREEN}✓${NC} Frontend started with PID: ${CYAN}$FRONTEND_PID${NC}"
    
    # Return to main directory
    cd ..
    
    # Save PIDs to file
    echo "$BACKEND_PID $FRONTEND_PID" > "$PID_FILE"
    echo "$BACKEND_LOG $FRONTEND_LOG" >> "$PID_FILE"
    
    echo -e "\n${GREEN}✓${NC} Application is now running in the background!"
    echo -e "  - Frontend URL: ${CYAN}$FRONTEND_URL${NC}"
    echo -e "  - Backend URL:  ${CYAN}$BACKEND_URL${NC}"
    echo -e "\nTo monitor logs: ${CYAN}./manage.sh logs${NC}"
    echo -e "To check status: ${CYAN}./manage.sh status${NC}"
    echo -e "To monitor health: ${CYAN}./manage.sh monitor${NC}"
    echo -e "To stop servers: ${CYAN}./manage.sh stop${NC}"
}

# Stop services
stop_services() {
    echo -e "${BLUE}Stopping application services...${NC}"
    
    if [ -f "$PID_FILE" ]; then
        read BACKEND_PID FRONTEND_PID < "$PID_FILE"
        
        # Stop backend
        if ps -p $BACKEND_PID > /dev/null; then
            echo -e "Stopping backend (PID: ${CYAN}$BACKEND_PID${NC})..."
            kill $BACKEND_PID
            echo -e "${GREEN}✓${NC} Backend stopped"
        else
            echo -e "${YELLOW}!${NC} Backend was not running"
        fi
        
        # Stop frontend
        if ps -p $FRONTEND_PID > /dev/null; then
            echo -e "Stopping frontend (PID: ${CYAN}$FRONTEND_PID${NC})..."
            kill $FRONTEND_PID
            echo -e "${GREEN}✓${NC} Frontend stopped"
        else
            echo -e "${YELLOW}!${NC} Frontend was not running"
        fi
        
        rm "$PID_FILE"
    else
        echo -e "${YELLOW}!${NC} No running application found in PID file"
    fi
    
    # Check for any lingering processes on ports 3000 and 8000
    echo -e "\n${BLUE}Checking for lingering processes...${NC}"
    
    # Check port 3000 (Frontend)
    FRONTEND_PIDS=$(lsof -i :3000 -t 2>/dev/null)
    if [ -n "$FRONTEND_PIDS" ]; then
        echo -e "Found lingering process(es) on port 3000: ${CYAN}$FRONTEND_PIDS${NC}"
        echo -e "Terminating..."
        kill -9 $FRONTEND_PIDS 2>/dev/null
        echo -e "${GREEN}✓${NC} Terminated frontend processes"
    else
        echo -e "No lingering processes on port 3000"
    fi
    
    # Check port 8000 (Backend)
    BACKEND_PIDS=$(lsof -i :8000 -t 2>/dev/null)
    if [ -n "$BACKEND_PIDS" ]; then
        echo -e "Found lingering process(es) on port 8000: ${CYAN}$BACKEND_PIDS${NC}"
        echo -e "Terminating..."
        kill -9 $BACKEND_PIDS 2>/dev/null
        echo -e "${GREEN}✓${NC} Terminated backend processes"
    else
        echo -e "No lingering processes on port 8000"
    fi
    
    echo -e "\n${GREEN}✓${NC} Application stopped successfully"
}

# View logs
view_logs() {
    if [ -f "$PID_FILE" ]; then
        read BACKEND_PID FRONTEND_PID < "$PID_FILE"
        
        # Read the second line for log files
        BACKEND_LOG=$(sed -n '2p' "$PID_FILE" | awk '{print $1}')
        FRONTEND_LOG=$(sed -n '2p' "$PID_FILE" | awk '{print $2}')
        
        echo -e "${BLUE}Showing live logs from:${NC}"
        echo -e "  - Backend:  ${CYAN}$BACKEND_LOG${NC}"
        echo -e "  - Frontend: ${CYAN}$FRONTEND_LOG${NC}"
        echo -e "\n${YELLOW}Press Ctrl+C to stop watching logs${NC}\n"
        
        # Use different colored prefixes for backend and frontend logs
        {
            tail -f "$BACKEND_LOG" | sed -e "s/^/${BLUE}[BACKEND]${NC} /" &
            TAIL_BACKEND_PID=$!
            
            tail -f "$FRONTEND_LOG" | sed -e "s/^/${GREEN}[FRONTEND]${NC} /" &
            TAIL_FRONTEND_PID=$!
            
            # Just kill the tail processes when Ctrl+C is pressed
            trap "kill $TAIL_BACKEND_PID $TAIL_FRONTEND_PID; exit" INT
            
            wait
        }
    else
        echo -e "${YELLOW}!${NC} No running application found with logs"
        
        # Show the most recent log files if they exist
        BACKEND_LOG=$(ls -t $LOGS_DIR/backend_*.log 2>/dev/null | head -1)
        FRONTEND_LOG=$(ls -t $LOGS_DIR/frontend_*.log 2>/dev/null | head -1)
        
        if [ -n "$BACKEND_LOG" ] || [ -n "$FRONTEND_LOG" ]; then
            echo -e "However, you can view the most recent logs:"
            
            if [ -n "$BACKEND_LOG" ]; then
                echo -e "  Backend:  ${CYAN}$BACKEND_LOG${NC}"
                echo -e "           ${CYAN}./manage.sh view-backend${NC}"
            fi
            
            if [ -n "$FRONTEND_LOG" ]; then
                echo -e "  Frontend: ${CYAN}$FRONTEND_LOG${NC}"
                echo -e "           ${CYAN}./manage.sh view-frontend${NC}"
            fi
        fi
    fi
}

# View the most recent backend log
view_backend_log() {
    BACKEND_LOG=$(ls -t $LOGS_DIR/backend_*.log 2>/dev/null | head -1)
    if [ -n "$BACKEND_LOG" ]; then
        echo -e "${BLUE}Showing most recent backend log:${NC} ${CYAN}$BACKEND_LOG${NC}\n"
        less "$BACKEND_LOG"
    else
        echo -e "${YELLOW}!${NC} No backend logs found"
    fi
}

# View the most recent frontend log
view_frontend_log() {
    FRONTEND_LOG=$(ls -t $LOGS_DIR/frontend_*.log 2>/dev/null | head -1)
    if [ -n "$FRONTEND_LOG" ]; then
        echo -e "${BLUE}Showing most recent frontend log:${NC} ${CYAN}$FRONTEND_LOG${NC}\n"
        less "$FRONTEND_LOG"
    else
        echo -e "${YELLOW}!${NC} No frontend logs found"
    fi
}

# List all log files
list_logs() {
    echo -e "${BLUE}Available log files:${NC}\n"
    
    echo -e "${CYAN}Backend logs:${NC}"
    ls -lt $LOGS_DIR/backend_*.log 2>/dev/null | head -5 | awk '{print "  " $9 " (" $5 " bytes, " $6 " " $7 " " $8 ")"}'
    
    echo -e "\n${CYAN}Frontend logs:${NC}"
    ls -lt $LOGS_DIR/frontend_*.log 2>/dev/null | head -5 | awk '{print "  " $9 " (" $5 " bytes, " $6 " " $7 " " $8 ")"}'
}

# Clean old log files (keep the 5 most recent of each type)
clean_logs() {
    echo -e "${BLUE}Cleaning old log files...${NC}"
    
    # Keep the 5 most recent backend logs
    BACKEND_LOGS=$(ls -t $LOGS_DIR/backend_*.log 2>/dev/null)
    COUNT=0
    for log in $BACKEND_LOGS; do
        COUNT=$((COUNT+1))
        if [ $COUNT -gt 5 ]; then
            echo "Removing $log"
            rm "$log"
        fi
    done
    
    # Keep the 5 most recent frontend logs
    FRONTEND_LOGS=$(ls -t $LOGS_DIR/frontend_*.log 2>/dev/null)
    COUNT=0
    for log in $FRONTEND_LOGS; do
        COUNT=$((COUNT+1))
        if [ $COUNT -gt 5 ]; then
            echo "Removing $log"
            rm "$log"
        fi
    done
    
    echo -e "${GREEN}✓${NC} Log cleanup complete"
}

# Continuous health monitoring
monitor_health() {
    echo -e "${BLUE}Starting health monitoring...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}\n"
    
    # Trap to capture Ctrl+C and exit cleanly
    trap "echo -e '\n${GREEN}Monitoring stopped${NC}'; exit" INT
    
    while true; do
        echo -e "\n${BLUE}[$(date +"%H:%M:%S")]${NC} Checking application health..."
        
        check_process_status
        PROCESS_STATUS=$?
        
        if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 1 ] || [ $PROCESS_STATUS -eq 2 ]; then
            check_health
            HEALTH_STATUS=$?
            
            # Backend status
            echo -ne "Backend:  "
            if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 1 ]; then
                if [ $HEALTH_STATUS -eq 0 ] || [ $HEALTH_STATUS -eq 1 ]; then
                    echo -e "${GREEN}HEALTHY${NC}"
                else
                    echo -e "${RED}RUNNING BUT NOT RESPONDING${NC}"
                fi
            else
                echo -e "${RED}NOT RUNNING${NC}"
            fi
            
            # Frontend status
            echo -ne "Frontend: "
            if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 2 ]; then
                if [ $HEALTH_STATUS -eq 0 ] || [ $HEALTH_STATUS -eq 2 ]; then
                    echo -e "${GREEN}HEALTHY${NC}"
                else
                    echo -e "${RED}RUNNING BUT NOT RESPONDING${NC}"
                fi
            else
                echo -e "${RED}NOT RUNNING${NC}"
            fi
        else
            echo -e "Backend:  ${RED}NOT RUNNING${NC}"
            echo -e "Frontend: ${RED}NOT RUNNING${NC}"
        fi
        
        # Sleep for 10 seconds before next check
        sleep 10
    done
}

# Show help menu
show_help() {
    echo -e "${BLUE}Available commands:${NC}"
    echo -e "  ${CYAN}start${NC}        - Start the application in the background"
    echo -e "  ${CYAN}dev${NC}          - Start application in development mode with hot reloading"
    echo -e "  ${CYAN}stop${NC}         - Stop the running application"
    echo -e "  ${CYAN}restart${NC}      - Restart the application"
    echo -e "  ${CYAN}status${NC}       - Check if the application is running"
    echo -e "  ${CYAN}healthcheck${NC}  - Perform a detailed health check"
    echo -e "  ${CYAN}monitor${NC}      - Continuously monitor application health"
    echo -e "  ${CYAN}logs${NC}         - View live logs from running services"
    echo -e "  ${CYAN}view-backend${NC}  - View the most recent backend log"
    echo -e "  ${CYAN}view-frontend${NC} - View the most recent frontend log"
    echo -e "  ${CYAN}list-logs${NC}    - List available log files"
    echo -e "  ${CYAN}clean-logs${NC}   - Remove old log files (keeps 5 most recent)"
    echo -e "  ${CYAN}debug-auth${NC}   - Debug authentication system"
    echo -e "  ${CYAN}test-auth${NC}    - Test authentication with specific credentials"
    echo -e "  ${CYAN}test-login-performance${NC} - Run comprehensive login performance tests"
    echo -e "  ${CYAN}help${NC}         - Show this help menu"
}

# Perform a single health check
perform_healthcheck() {
    print_header
    echo -e "${BLUE}Performing detailed health check...${NC}\n"
    
    check_process_status
    PROCESS_STATUS=$?
    
    # If processes are running, check if they're responding
    if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 1 ] || [ $PROCESS_STATUS -eq 2 ]; then
        if [ -f "$PID_FILE" ]; then
            read BACKEND_PID FRONTEND_PID < "$PID_FILE"
            read _ _ BACKEND_LOG FRONTEND_LOG < "$PID_FILE"
            
            # Check process stats
            echo -e "${BLUE}Process Statistics:${NC}"
            if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 1 ]; then
                echo -e "\n${CYAN}Backend Process (PID: $BACKEND_PID):${NC}"
                ps -p $BACKEND_PID -o pid,ppid,user,%cpu,%mem,vsz,rss,tt,stat,start,time,command | head -1
                ps -p $BACKEND_PID -o pid,ppid,user,%cpu,%mem,vsz,rss,tt,stat,start,time,command | grep -v PID
                
                # Check if it's responding
                echo -e "\n${CYAN}Backend Response Check:${NC}"
                BACKEND_RESPONSE=$(curl --silent --max-time 2 -w "\nStatus Code: %{http_code}\n" "$BACKEND_URL/docs" || echo "Connection failed")
                if [[ "$BACKEND_RESPONSE" == *"Status Code: 200"* ]]; then
                    echo -e "${GREEN}✓${NC} Backend is responding (200 OK)"
                else
                    echo -e "${RED}✗${NC} Backend is not responding properly"
                    echo -e "Response: $BACKEND_RESPONSE"
                fi
            fi
            
            if [ $PROCESS_STATUS -eq 0 ] || [ $PROCESS_STATUS -eq 2 ]; then
                echo -e "\n${CYAN}Frontend Process (PID: $FRONTEND_PID):${NC}"
                ps -p $FRONTEND_PID -o pid,ppid,user,%cpu,%mem,vsz,rss,tt,stat,start,time,command | head -1
                ps -p $FRONTEND_PID -o pid,ppid,user,%cpu,%mem,vsz,rss,tt,stat,start,time,command | grep -v PID
                
                # Check if it's responding
                echo -e "\n${CYAN}Frontend Response Check:${NC}"
                FRONTEND_RESPONSE=$(curl --silent --max-time 2 -w "\nStatus Code: %{http_code}\n" "$FRONTEND_URL" || echo "Connection failed")
                if [[ "$FRONTEND_RESPONSE" == *"Status Code: 200"* ]]; then
                    echo -e "${GREEN}✓${NC} Frontend is responding (200 OK)"
                else
                    echo -e "${RED}✗${NC} Frontend is not responding properly"
                    echo -e "Response: $FRONTEND_RESPONSE"
                fi
            fi
            
            # Check most recent log entries
            echo -e "\n${BLUE}Recent Log Entries:${NC}"
            
            if [ -f "$BACKEND_LOG" ]; then
                echo -e "\n${CYAN}Backend Log (last 5 lines):${NC}"
                tail -5 "$BACKEND_LOG"
            fi
            
            if [ -f "$FRONTEND_LOG" ]; then
                echo -e "\n${CYAN}Frontend Log (last 5 lines):${NC}"
                tail -5 "$FRONTEND_LOG"
            fi
        fi
    else
        echo -e "${RED}No application processes are running${NC}"
        
        if [ -f "$PID_FILE" ]; then
            echo -e "${YELLOW}PID file exists but processes are not running. This could indicate a crash.${NC}"
            read _ _ BACKEND_LOG FRONTEND_LOG < "$PID_FILE"
            
            echo -e "\n${CYAN}Last Backend Log Entries:${NC}"
            if [ -f "$BACKEND_LOG" ]; then
                echo -e "Log file: $BACKEND_LOG"
                echo -e "Last 10 lines:"
                tail -10 "$BACKEND_LOG"
            else
                echo -e "${RED}Backend log file not found: $BACKEND_LOG${NC}"
            fi
            
            echo -e "\n${CYAN}Last Frontend Log Entries:${NC}"
            if [ -f "$FRONTEND_LOG" ]; then
                echo -e "Log file: $FRONTEND_LOG"
                echo -e "Last 10 lines:"
                tail -10 "$FRONTEND_LOG"
            else
                echo -e "${RED}Frontend log file not found: $FRONTEND_LOG${NC}"
            fi
            
            echo -e "\n${YELLOW}Recommend running 'manage.sh restart' to restart the application${NC}"
        else
            echo -e "${RED}Application is not running${NC}"
        fi
    fi
}

# Fix crashed services
fix_crashed_services() {
    check_process_status
    PROCESS_STATUS=$?
    
    # If PID file exists but one or both services are not running
    if [ -f "$PID_FILE" ] && [ $PROCESS_STATUS -ne 0 ]; then
        read BACKEND_PID FRONTEND_PID < "$PID_FILE"
        
        echo -e "${YELLOW}Detected crashed services, attempting to fix...${NC}"
        
        # If backend is down but frontend is up
        if [ $PROCESS_STATUS -eq 2 ]; then
            echo -e "Backend is down but frontend is running. Restarting backend..."
            cd "$BACKEND_DIR"
            
            if [ -d "venv" ]; then
                source venv/bin/activate
            else
                python -m venv venv
                source venv/bin/activate
                pip install --upgrade pip
                pip install -r requirements.txt
            fi
            
            # Start backend with logging to the same log file
            read _ _ BACKEND_LOG _ < "$PID_FILE"
            python run.py > "../$BACKEND_LOG" 2>&1 &
            NEW_BACKEND_PID=$!
            
            cd ..
            
            # Update PID in file
            sed -i.bak "s/$BACKEND_PID/$NEW_BACKEND_PID/" "$PID_FILE"
            rm -f "$PID_FILE.bak"
            
            echo -e "${GREEN}✓${NC} Backend restarted with PID: ${CYAN}$NEW_BACKEND_PID${NC}"
        fi
        
        # If frontend is down but backend is up
        if [ $PROCESS_STATUS -eq 1 ]; then
            echo -e "Frontend is down but backend is running. Restarting frontend..."
            cd "$FRONTEND_DIR"
            
            # Start frontend with logging to the same log file
            read _ _ _ FRONTEND_LOG < "$PID_FILE"
            npm start > "../$FRONTEND_LOG" 2>&1 &
            NEW_FRONTEND_PID=$!
            
            cd ..
            
            # Update PID in file
            sed -i.bak "s/$FRONTEND_PID/$NEW_FRONTEND_PID/" "$PID_FILE"
            rm -f "$PID_FILE.bak"
            
            echo -e "${GREEN}✓${NC} Frontend restarted with PID: ${CYAN}$NEW_FRONTEND_PID${NC}"
        fi
        
        # If both are down
        if [ $PROCESS_STATUS -eq 3 ]; then
            echo -e "Both services are down. Doing a full restart..."
            rm "$PID_FILE"
            start_services
        fi
        
        echo -e "${GREEN}✓${NC} Recovery attempt completed"
        show_status
    else
        if [ $PROCESS_STATUS -eq 0 ]; then
            echo -e "${GREEN}Both services are running correctly, no fix needed${NC}"
        else
            echo -e "${YELLOW}No PID file found, cannot determine what needs fixing${NC}"
            echo -e "Run ${CYAN}./manage.sh start${NC} to start the application"
        fi
    fi
}

# Debug authentication issues
debug_auth() {
    print_header
    echo -e "${BLUE}Debugging Authentication System...${NC}\n"
    
    # First check if services are running
    check_process_status
    PROCESS_STATUS=$?
    
    if [ $PROCESS_STATUS -ne 0 ] && [ $PROCESS_STATUS -ne 1 ]; then
        echo -e "${RED}Backend service is not running!${NC}"
        echo -e "Please start the application first with: ${CYAN}./manage.sh start${NC}"
        return 1
    fi
    
    # Get backend logs
    BACKEND_LOG=$(ls -t $LOGS_DIR/backend_*.log 2>/dev/null | head -1)
    if [ -z "$BACKEND_LOG" ]; then
        echo -e "${RED}No backend logs found!${NC}"
        return 1
    fi
    
    echo -e "${BLUE}=== Backend Authentication Component Health ====${NC}"
    
    # Check backend health endpoint
    echo -e "\n${CYAN}Checking backend health...${NC}"
    HEALTH_RESPONSE=$(curl --silent --max-time 2 "$BACKEND_URL/health" || echo "Connection failed")
    if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
        echo -e "${GREEN}✓${NC} Backend health endpoint is responding"
    else
        echo -e "${RED}✗${NC} Backend health endpoint is not responding"
        echo -e "Response: $HEALTH_RESPONSE"
    fi
    
    # Check for auth-related errors in logs
    echo -e "\n${CYAN}Checking authentication logs...${NC}"
    
    echo -e "\n${BLUE}Login Attempts:${NC}"
    grep -i "login" "$BACKEND_LOG" | tail -10
    
    echo -e "\n${BLUE}Authentication Time Statistics:${NC}"
    grep -i "authentication took" "$BACKEND_LOG" | tail -5
    
    echo -e "\n${BLUE}Password Verification Time:${NC}"
    grep -i "password verification took" "$BACKEND_LOG" | tail -5
    
    echo -e "\n${BLUE}Token Generation Time:${NC}"
    grep -i "token generation took" "$BACKEND_LOG" | tail -5
    
    echo -e "\n${BLUE}Total Login Process Time:${NC}"
    grep -i "total login process took" "$BACKEND_LOG" | tail -5
    
    echo -e "\n${BLUE}JWT Token Validation Time:${NC}"
    grep -i "get_current_user took" "$BACKEND_LOG" | tail -5
    
    echo -e "\n${BLUE}Authentication Errors:${NC}"
    grep -i "error\|exception\|failed\|timeout" "$BACKEND_LOG" | grep -i "auth\|login\|token\|password" | tail -10
    
    # Check frontend logs for auth issues
    FRONTEND_LOG=$(ls -t $LOGS_DIR/frontend_*.log 2>/dev/null | head -1)
    
    if [ -n "$FRONTEND_LOG" ]; then
        echo -e "\n${BLUE}=== Frontend Authentication Component Health ====${NC}"
        
        echo -e "\n${BLUE}Frontend Network Errors:${NC}"
        grep -i "failed\|error\|exception\|timeout" "$FRONTEND_LOG" | grep -i "auth\|login\|token" | tail -10
        
        echo -e "\n${BLUE}Authentication Requests:${NC}"
        grep -i "auth\|login\|token" "$FRONTEND_LOG" | tail -10
    else
        echo -e "\n${YELLOW}No frontend logs found${NC}"
    fi
    
    # Test actual login endpoint
    echo -e "\n${CYAN}Testing login endpoint response time...${NC}"
    
    # Use curl's timing feature to check response time for the auth endpoint
    echo -e "Connection timing to $BACKEND_URL/api/auth/login:"
    curl -o /dev/null -s -w "\n%{time_connect}s - Connect time\n%{time_starttransfer}s - Time to first byte\n%{time_total}s - Total time\n" "$BACKEND_URL/api/auth/login"
    
    echo -e "\n${BLUE}=== Authentication Debug Complete ====${NC}"
    echo -e "\nIf you're experiencing login timeouts, check for:\n"
    echo -e "1. Long password verification times (> 0.5s)"
    echo -e "2. Network timeouts or connection issues"
    echo -e "3. Database connection delays"
    echo -e "4. JWT token validation performance"
    echo -e "\nYou can run detailed profiling by using Python profiling tools on the backend."
}

# Test authentication with specific credentials
test_auth() {
    print_header
    echo -e "${BLUE}Testing Authentication Flow...${NC}\n"
    
    # Check if services are running
    check_process_status
    PROCESS_STATUS=$?
    
    if [ $PROCESS_STATUS -ne 0 ] && [ $PROCESS_STATUS -ne 1 ]; then
        echo -e "${RED}Backend service is not running!${NC}"
        echo -e "Please start the application first with: ${CYAN}./manage.sh start${NC}"
        return 1
    fi
    
    # Get username and password from arguments or prompt
    USERNAME=$2
    PASSWORD=$3
    
    if [ -z "$USERNAME" ]; then
        read -p "Enter username to test: " USERNAME
    fi
    
    if [ -z "$PASSWORD" ]; then
        read -s -p "Enter password to test: " PASSWORD
        echo ""
    fi
    
    if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
        echo -e "${RED}Username and password are required${NC}"
        return 1
    fi
    
    echo -e "\n${CYAN}Testing login with username '${USERNAME}'...${NC}"
    
    # Create a JSON file for the request body
    JSON_DATA=$(cat <<EOF
{
    "username": "$USERNAME",
    "password": "$PASSWORD"
}
EOF
)
    
    # Temporary file for JSON data
    TEMP_JSON_FILE=$(mktemp)
    echo "$JSON_DATA" > "$TEMP_JSON_FILE"
    
    # First make sure we're logging at debug level by touching an environment file
    echo -e "\n${CYAN}Ensuring debug logging is enabled...${NC}"
    
    # Test the connection to the backend health endpoint
    echo -e "\n${CYAN}Testing backend connectivity...${NC}"
    HEALTH_RESPONSE=$(curl --silent --max-time 2 "$BACKEND_URL/health" || echo "Connection failed")
    if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
        echo -e "${GREEN}✓${NC} Backend health endpoint is responding"
    else
        echo -e "${RED}✗${NC} Backend health endpoint is not responding"
        echo -e "Response: $HEALTH_RESPONSE"
        rm "$TEMP_JSON_FILE"
        return 1
    fi
    
    # Time the login request with verbose output
    echo -e "\n${CYAN}Making login request...${NC}"
    echo -e "Request to: ${CYAN}$BACKEND_URL/api/auth/login${NC}"
    echo -e "Request body: ${CYAN}$JSON_DATA${NC}"
    echo -e "\n${YELLOW}Response:${NC}"
    
    # Make the request with detailed timing and verbose output
    curl -v -X POST "$BACKEND_URL/api/auth/login" \
      -H "Content-Type: application/json" \
      -d @"$TEMP_JSON_FILE" \
      -w "\n\n${CYAN}Timing:${NC}\n%{time_namelookup}s - DNS Lookup\n%{time_connect}s - TCP Connect\n%{time_appconnect}s - App Connect\n%{time_pretransfer}s - Pre-transfer\n%{time_redirect}s - Redirect\n%{time_starttransfer}s - Start Transfer\n%{time_total}s - Total\n"
    
    echo -e "\n${CYAN}Testing user profile request...${NC}"
    # Extract token from the response (assuming success)
    echo -e "\nEnter the access_token from the response above:"
    read ACCESS_TOKEN
    
    if [ -n "$ACCESS_TOKEN" ]; then
        echo -e "Making user profile request with token..."
        curl -v -X GET "$BACKEND_URL/api/users/me" \
          -H "Authorization: Bearer $ACCESS_TOKEN" \
          -w "\n\n${CYAN}Timing:${NC}\n%{time_total}s - Total time\n"
    fi
    
    # Clean up
    rm "$TEMP_JSON_FILE"
    
    echo -e "\n${BLUE}=== Authentication Test Complete ====${NC}"
}

# Test login performance using advanced debugging tools
test_login_performance() {
    print_header
    echo -e "${BLUE}Testing Login Performance...${NC}\n"
    
    # Check if services are running
    check_process_status
    PROCESS_STATUS=$?
    
    if [ $PROCESS_STATUS -ne 0 ] && [ $PROCESS_STATUS -ne 1 ]; then
        echo -e "${RED}Backend service is not running!${NC}"
        echo -e "Please start the application first with: ${CYAN}./manage.sh start${NC}"
        return 1
    fi
    
    # Check if our Python test scripts exist
    if [ ! -f "test_auth_flow.py" ] || [ ! -f "debug_login_speed.py" ]; then
        echo -e "${RED}Test scripts not found!${NC}"
        echo -e "The required files 'test_auth_flow.py' and 'debug_login_speed.py' must exist."
        return 1
    fi
    
    # Check if credentials file exists, and if not create a test user
    CRED_FILE="test_user_credentials.json"
    if [ ! -f "$CRED_FILE" ]; then
        echo -e "${YELLOW}No test credentials found. Creating a test user...${NC}"
        python test_auth_flow.py --new
        
        if [ ! -f "$CRED_FILE" ]; then
            echo -e "${RED}Failed to create test user credentials!${NC}"
            return 1
        fi
    fi
    
    # Run the full test flow
    echo -e "\n${CYAN}Step 1: Testing Authentication Flow...${NC}"
    python test_auth_flow.py
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Authentication flow test failed!${NC}"
        echo -e "If login is failing, consider creating a new test user:"
        echo -e "${CYAN}python test_auth_flow.py --new${NC}"
        return 1
    fi
    
    echo -e "\n${CYAN}Step 2: Running Login Benchmark Test...${NC}"
    python debug_login_speed.py --credentials-file "$CRED_FILE" --benchmark
    
    echo -e "\n${CYAN}Step 3: Running Load Test (5 concurrent users)...${NC}"
    python debug_login_speed.py --credentials-file "$CRED_FILE" --load-test 5
    
    echo -e "\n${CYAN}Step 4: Running Detailed Diagnostics...${NC}"
    python debug_login_speed.py --credentials-file "$CRED_FILE" --diagnose
    
    # Also run the built-in debug command for good measure
    echo -e "\n${CYAN}Step 5: Running Built-in Auth Debugging...${NC}"
    debug_auth
    
    echo -e "\n${GREEN}✓${NC} Login Performance Testing Complete!"
    echo -e "\n${BLUE}=== Summary ====${NC}"
    echo -e "1. Tested full authentication flow with test user"
    echo -e "2. Benchmarked login performance"
    echo -e "3. Tested system under concurrent load"
    echo -e "4. Ran detailed diagnostics on the login process"
    echo -e "5. Checked authentication logs for issues"
    echo -e "\nYou can find the detailed results in the output above."
    echo -e "If you're still experiencing issues, check the backend logs for more details:"
    echo -e "${CYAN}./manage.sh view-backend${NC}"
}

# Start services in development mode with hot reloading
start_dev_mode() {
    # Check if already running
    check_process_status
    PROCESS_STATUS=$?
    
    if [ $PROCESS_STATUS -eq 0 ]; then
        echo -e "${YELLOW}Application is already running!${NC}"
        echo -e "Please stop it first: ${CYAN}./manage.sh stop${NC}"
        show_status
        return 1
    fi
    
    # Check if ports are available
    if lsof -i :8000 > /dev/null 2>&1; then
        echo -e "${RED}ERROR:${NC} Port 8000 is already in use!"
        echo -e "Use '${CYAN}lsof -i :8000${NC}' to find the process using it"
        echo -e "Use '${CYAN}./manage.sh stop${NC}' to clean up any existing processes"
        return 1
    fi
    
    if lsof -i :3000 > /dev/null 2>&1; then
        echo -e "${RED}ERROR:${NC} Port 3000 is already in use!"
        echo -e "Use '${CYAN}lsof -i :3000${NC}' to find the process using it"
        echo -e "Use '${CYAN}./manage.sh stop${NC}' to clean up any existing processes"
        return 1
    fi
    
    echo -e "${BLUE}Starting application in development mode with hot reloading...${NC}"
    
    # Generate log file names with timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    BACKEND_LOG="$LOGS_DIR/backend_dev_${timestamp}.log"
    FRONTEND_LOG="$LOGS_DIR/frontend_dev_${timestamp}.log"
    
    echo -e "📊 Log files:"
    echo -e "  - Backend:  ${CYAN}$BACKEND_LOG${NC}"
    echo -e "  - Frontend: ${CYAN}$FRONTEND_LOG${NC}"
    
    # Start backend in development mode with auto-reload
    echo -e "\n${BLUE}Starting backend server with hot reloading...${NC}"
    cd "$BACKEND_DIR"
    
    # Check for virtual environment
    if [ -d "venv" ]; then
        echo -e "${GREEN}✓${NC} Found virtual environment"
        source venv/bin/activate
    else
        echo -e "${YELLOW}!${NC} Virtual environment not found, creating one..."
        python -m venv venv
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
    fi
    
    # Start backend with uvicorn's reload flag
    echo -e "Starting uvicorn with reload flag..."
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > "../$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    echo -e "${GREEN}✓${NC} Backend started with PID: ${CYAN}$BACKEND_PID${NC}"
    
    # Return to main directory
    cd ..
    
    # Start frontend in development mode (it has hot reload by default)
    echo -e "\n${BLUE}Starting frontend with hot module replacement...${NC}"
    cd "$FRONTEND_DIR"
    
    # Make sure frontend dependencies are installed
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}!${NC} node_modules not found, installing dependencies..."
        npm install
    fi
    
    # Start frontend with npm start (includes hot reload)
    BROWSER=none npm start > "../$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo -e "${GREEN}✓${NC} Frontend started with PID: ${CYAN}$FRONTEND_PID${NC}"
    
    # Return to main directory
    cd ..
    
    # Save PIDs to file
    echo "$BACKEND_PID $FRONTEND_PID" > "$PID_FILE"
    echo "$BACKEND_LOG $FRONTEND_LOG" >> "$PID_FILE"
    
    echo -e "\n${GREEN}✓${NC} Application is running in development mode with hot reloading!"
    echo -e "  - Frontend URL: ${CYAN}$FRONTEND_URL${NC}"
    echo -e "  - Backend URL:  ${CYAN}$BACKEND_URL${NC}"
    echo -e "\n${YELLOW}Hot Reload Information:${NC}"
    echo -e "  - Frontend: React's hot module replacement is active. Changes to React files"
    echo -e "    will be applied automatically without a full page refresh."
    echo -e "  - Backend: FastAPI's auto-reload is active. Changes to Python files"
    echo -e "    will trigger an automatic server restart."
    echo -e "\nTo see the changes in real-time: ${CYAN}./manage.sh logs${NC}"
    echo -e "To stop the development server: ${CYAN}./manage.sh stop${NC}"
}

# Main execution
print_header

case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        start_services
        ;;
    dev)
        start_dev_mode
        ;;
    status)
        show_status
        ;;
    healthcheck)
        perform_healthcheck
        ;;
    fix)
        fix_crashed_services
        ;;
    monitor)
        monitor_health
        ;;
    logs)
        view_logs
        ;;
    view-backend)
        view_backend_log
        ;;
    view-frontend)
        view_frontend_log
        ;;
    list-logs)
        list_logs
        ;;
    clean-logs)
        clean_logs
        ;;
    debug-auth)
        debug_auth
        ;;
    test-auth)
        test_auth "$@"
        ;;
    test-login-performance)
        test_login_performance
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command:${NC} $1"
        show_help
        exit 1
        ;;
esac

exit 0 