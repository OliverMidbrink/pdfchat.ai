# AI Chat Application

A modern chat application with OpenAI integration, similar to ChatGPT, built with React and FastAPI.

## Features

- User authentication (register, login)
- Chat with OpenAI models
- Save and manage conversation history
- Personal API key management
- Modern, responsive UI

## Tech Stack

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- Framer Motion for animations
- React Router for navigation
- Axios for API requests

### Backend
- FastAPI (Python)
- SQLAlchemy ORM
- JWT authentication
- SQLite database (can be configured for PostgreSQL)
- OpenAI API integration

## Project Structure

```
pdfchat.ai/
├── frontend/         # React frontend application
├── backend/          # FastAPI backend application
│   ├── app/          # Application code
│   │   ├── api/      # API routes
│   │   ├── core/     # Core functionality
│   │   ├── db/       # Database models and session
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   └── utils/    # Utility functions
│   └── requirements.txt  # Python dependencies
├── package.json      # Root package.json with scripts to run both services
├── manage.sh         # Management script for the application
├── setup.sh          # Setup script to initialize the project
├── start.sh          # Enhanced startup script with environment checks
├── diagnose.sh       # Diagnostic script to identify and fix common issues
```

## Getting Started

### Quick Start (Recommended)

1. Run the setup script to initialize both frontend and backend:
   ```
   ./setup.sh
   ```

2. Start both the frontend and backend servers:
   ```
   npm start
   # or
   ./manage.sh start
   ```

3. Open your browser to http://localhost:3000

### Development Mode with Hot Reloading

For faster development with automatic reloading:

```
npm run dev
# or
./manage.sh dev
```

This enables:
- Hot Module Replacement for React components (frontend)
- Automatic server restart on code changes (backend)
- Live log viewing with `./manage.sh logs`

See `README_MANAGEMENT.md` for more details on the management system.

### Git Setup

The repository is configured with:
- Comprehensive `.gitignore` for Python, Node.js, and project-specific files
- Pre-commit hook to check for common issues before committing
- Shell script permissions automatically preserved

When cloning the repository for the first time:

```
git clone <repository-url>
cd pdfchat.ai
chmod +x *.sh  # Make all shell scripts executable
```

### Troubleshooting

If you encounter any issues, run the diagnostic script:
```
./diagnose.sh
```

This will identify common problems and attempt to fix them automatically. The script will:
- Check for missing Python dependencies
- Verify the .env file is properly configured
- Ensure npm packages are installed
- Provide a detailed summary of the environment status

Alternatively, use the management script for comprehensive diagnostics:
```
./manage.sh healthcheck
```

### Manual Setup

#### Backend Setup

1. Navigate to the backend directory:
   ```
   cd pdfchat.ai/backend
   ```

2. Create and activate a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Copy the example environment file and configure it:
   ```
   cp .env.example .env
   ```
   
5. Run the development server:
   ```
   python run.py
   ```

#### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd pdfchat.ai/frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Open your browser to http://localhost:3000

## Available Scripts

- `npm start` - Start both the frontend and backend servers (macOS/Linux)
- `npm run dev` - Start application in development mode with hot reloading
- `npm run start:win` - Start both servers (Windows)
- `npm run start:frontend` - Start only the frontend server
- `npm run start:backend` - Start only the backend server (macOS/Linux)
- `npm run start:backend:win` - Start only the backend server (Windows)
- `npm run install:frontend` - Install frontend dependencies
- `npm run install:backend` - Install backend dependencies (macOS/Linux)
- `npm run install:backend:win` - Install backend dependencies (Windows)
- `./manage.sh` - Comprehensive management script with multiple commands
- `./setup.sh` - Initialize the entire project
- `./start.sh` - Start both servers with environment validation
- `./diagnose.sh` - Diagnose and fix common issues

## Usage

1. Register a new account
2. Log in with your credentials
3. Add your OpenAI API key in the settings (bottom right)
4. Start a new conversation
5. Enjoy chatting with the AI!

## License

MIT 