# Application Management System

The pdfchat.ai application comes with a robust management system that makes it easy to start, stop, and monitor the application services. This document explains how to use the management system effectively.

## Quick Start

To start the application in the background with automatic logging:

```bash
npm start
# or directly
./manage.sh start
```

This will:
- Start the backend server (Python/FastAPI)
- Start the frontend server (React)
- Create timestamped log files for both services
- Store process IDs for easy management
- Run everything in the background

## Management Commands

All commands can be run using either npm scripts or directly via the management script.

### Core Operations

| npm Command | Direct Command | Description |
|-------------|----------------|-------------|
| `npm start` | `./manage.sh start` | Start backend and frontend in background |
| `npm stop` | `./manage.sh stop` | Stop both backend and frontend |
| `npm run restart` | `./manage.sh restart` | Restart both services |
| `npm run status` | `./manage.sh status` | Check if services are running and responding |
| `npm run fix` | `./manage.sh fix` | Automatically detect and fix crashed services |

### Health Monitoring

| npm Command | Direct Command | Description |
|-------------|----------------|-------------|
| `npm run healthcheck` | `./manage.sh healthcheck` | Perform a detailed health check of all services |
| `npm run monitor` | `./manage.sh monitor` | Continuously monitor application health (every 10 seconds) |

### Log Management

| npm Command | Direct Command | Description |
|-------------|----------------|-------------|
| `npm run logs` | `./manage.sh logs` | View live logs from both services |
| `npm run view:backend` | `./manage.sh view-backend` | View the most recent backend log |
| `npm run view:frontend` | `./manage.sh view-frontend` | View the most recent frontend log |
| `npm run list:logs` | `./manage.sh list-logs` | List all available log files |
| `npm run clean:logs` | `./manage.sh clean-logs` | Remove old log files (keeps 5 most recent) |

### Authentication Debugging

| npm Command | Direct Command | Description |
|-------------|----------------|-------------|
| `npm run debug:auth` | `./manage.sh debug-auth` | Debug authentication system issues |
| `npm run test:auth` | `./manage.sh test-auth` | Test authentication with specific credentials |
| `npm run test:login-performance` | `./manage.sh test-login-performance` | Run comprehensive login performance tests |

## Workflow Tips

### Development Workflow

The optimal workflow for development is:

1. Start the application: `npm start`
2. View application status: `npm run status`
3. Monitor logs while working: `npm run logs` or health: `npm run monitor`
4. When done, stop all services: `npm stop`

#### Development Mode with Hot Reloading

For faster development cycles, you can use the development mode which enables hot reloading:

```bash
npm run dev
# or directly
./manage.sh dev
```

This starts both the frontend and backend with hot reloading enabled:

- **Frontend**: Uses React's Hot Module Replacement (HMR) - changes to React components are applied instantly without losing component state or requiring a page refresh
- **Backend**: Uses FastAPI's auto-reload feature - changes to Python files trigger an automatic server restart

With hot reloading, you can:
1. Make changes to your frontend code (React components, CSS, etc.)
2. Make changes to your backend code (API routes, database models, etc.)
3. See changes applied instantly, with the state preserved where possible

This eliminates the need to manually restart the application after code changes, significantly speeding up the development process.

### Enhanced Process Management

The management system includes robust process management features:

- **Port Conflict Prevention**: Automatically checks if ports 3000 and 8000 are available before starting
- **Lingering Process Cleanup**: When stopping, checks for and terminates any lingering processes on the required ports
- **Complete Application Shutdown**: Ensures all related processes are properly terminated

### Persistent User Sessions

The application features enhanced session management:

- **Extended Token Lifetime**: User sessions last for 7 days before requiring re-login
- **Session Persistence**: Users remain logged in after page refreshes and browser restarts
- **Automatic Token Refresh**: Tokens are refreshed automatically when needed
- **Multi-layer Storage**: Authentication tokens are stored in both cookies and localStorage for reliability

### Crash Detection and Recovery

The management system can automatically detect and recover from crashed services:

1. Check application health: `npm run healthcheck`
2. If any service has crashed, fix it: `npm run fix`

The system does not just check if processes exist - it also verifies they're actually responding to requests. This means it can detect:
- Processes that have crashed completely
- Processes that are running but frozen/not responding
- Services that are running but not available on their expected ports

### Troubleshooting

If you encounter issues:

1. Check application status: `npm run status`
2. Perform a detailed health check: `npm run healthcheck`
3. Review logs: `npm run logs` (for running services) or `npm run view:backend`/`npm run view:frontend` (for recent logs)
4. Automatically fix crashed services: `npm run fix`
5. Restart if needed: `npm run restart`
6. Clean up old logs: `npm run clean:logs`

#### Common Issues and Solutions

- **Port Already in Use**: If you see errors about ports 3000 or 8000 being in use, run `./manage.sh stop` to clean up lingering processes
- **Session Timeout**: If you're unexpectedly logged out, check the backend logs to see if there's an issue with the token refresh system
- **Application Not Responding**: Run `./manage.sh healthcheck` for detailed diagnostics

#### Authentication Issues

If you're experiencing login problems:

1. **Basic Debugging**: Run `./manage.sh debug-auth` to check authentication-related logs and timing information
2. **Test Specific Credentials**: Use `./manage.sh test-auth` to test login with specific credentials
3. **Comprehensive Performance Testing**: Run `./manage.sh test-login-performance` to execute a series of tests including:
   - Full authentication flow with a test user
   - Login benchmark tests
   - Load testing with concurrent login requests
   - Detailed diagnostics on login performance

The authentication debugging tools provide detailed timing information to help diagnose slow login operations, including:
- Password verification time
- Token generation and validation time
- Network response time
- Login speed under load

### Understanding Log Files

Log files are stored in the `logs/` directory with timestamped filenames:
- Backend logs: `logs/backend_YYYYMMDD_HHMMSS.log`
- Frontend logs: `logs/frontend_YYYYMMDD_HHMMSS.log`

Each time you start the application, new log files are created with the current timestamp.

## Advanced Usage

### Continuous Health Monitoring

To continuously monitor the health of your application:

```bash
./manage.sh monitor
# or
npm run monitor
```

This will check the status of both services every 10 seconds and display their health. This is useful for:
- Detecting and fixing intermittent issues
- Verifying that services are stable over time
- Identifying performance problems

### Detailed Health Checks

For a comprehensive health check that includes:
- Process statistics (CPU, memory usage)
- Response verification for both services
- Recent log entries
- Service status

Run:
```bash
./manage.sh healthcheck
# or
npm run healthcheck
```

### Authentication Performance Debugging

To diagnose authentication performance issues, particularly slow login:

```bash
./manage.sh test-login-performance
```

This runs a series of tools that:
1. Tests the full authentication flow (register, login, profile, token refresh)
2. Benchmarks login performance with multiple attempts
3. Tests the system under concurrent load
4. Performs detailed diagnostics to identify bottlenecks
5. Analyzes authentication logs

For more targeted testing, use:
- `debug_login_speed.py` - Python script for detailed login performance testing
- `test_auth_flow.py` - Python script to test the entire authentication flow

### Legacy Start Scripts

The application includes several legacy start scripts that you can use if needed:

- `npm run start:legacy` - Runs the old start script with combined logging
- `npm run start:frontend` - Runs only the frontend in the foreground
- `npm run start:backend` - Runs only the backend in the foreground 