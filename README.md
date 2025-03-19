# AI Chat Application

A modern chat application with OpenAI integration, similar to ChatGPT, built with React and FastAPI.

## Features

- User authentication (register, login)
- Chat with OpenAI models
- Save and manage conversation history
- Personal API key management
- Modern, responsive UI
- Automatic conversation title generation

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
│   ├── src/          # Source code
│   │   ├── components/  # React components
│   │   ├── contexts/    # Context providers (Auth, etc.)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── pages/       # Page components
│   │   ├── services/    # API services
│   │   └── types/       # TypeScript type definitions
├── backend/          # FastAPI backend application
│   ├── app/          # Application code
│   │   ├── api/      # API routes
│   │   ├── core/     # Core functionality
│   │   ├── db/       # Database models and session
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   └── utils/    # Utility functions
│   └── requirements.txt  # Python dependencies
├── tests/            # Test files for both frontend and backend
├── logs/             # Application logs directory
├── package.json      # Root package.json with scripts to run both services
├── manage.sh         # Management script for the application
├── start.sh          # Enhanced startup script with environment checks
└── README_MANAGEMENT.md  # Detailed documentation for management scripts
```

## Getting Started

### Quick Start (Recommended)

1. Clone the repository:
   ```
   git clone https://github.com/OliverMidbrink/pdfchat.ai.git
   cd pdfchat.ai
   chmod +x *.sh  # Make all shell scripts executable
   ```

2. Start both the frontend and backend servers:
   ```
   ./manage.sh start
   # or
   npm start
   ```

3. Open your browser to http://localhost:3000

### Development Mode with Hot Reloading

For faster development with automatic reloading:

```
./manage.sh dev
# or
npm run dev
```

This enables:
- Hot Module Replacement for React components (frontend)
- Automatic server restart on code changes (backend)
- Live log viewing

## Management Scripts

The application includes a comprehensive management system through the `manage.sh` script:

```
./manage.sh <command>
```

Available commands:

- `start` - Start both the frontend and backend servers
- `stop` - Stop all application services
- `restart` - Restart all application services
- `status` - Show the current status of all services
- `logs` - View real-time application logs
- `healthcheck` - Perform a comprehensive health check of the application
- `fix` - Attempt to fix common issues automatically
- `view-frontend` - View only frontend logs
- `view-backend` - View only backend logs
- `clean-logs` - Clear old log files

For more detailed information about the management system, see `README_MANAGEMENT.md`.

### Troubleshooting

If you encounter any issues, check the application status and logs:

```
./manage.sh status
./manage.sh logs
```

For a comprehensive health check:
```
./manage.sh healthcheck
```

## Manual Setup

If you prefer to set up components manually:

### Backend Setup

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

### Frontend Setup

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

## NPM Scripts

The following scripts are available through npm:

- `npm start` - Start both the frontend and backend servers
- `npm run dev` - Start application in development mode with hot reloading
- `npm run stop` - Stop all application services
- `npm run restart` - Restart all application services
- `npm run status` - Show the current status of all services
- `npm run logs` - View real-time application logs
- `npm run healthcheck` - Perform a comprehensive health check
- `npm run fix` - Fix common issues automatically

## Usage

1. Register a new account
2. Log in with your credentials
3. Add your OpenAI API key in the settings (bottom right)
4. Start a new conversation
5. Enjoy chatting with the AI!

### OpenAI API Key

This application requires users to provide their own OpenAI API key for full functionality. The key is stored securely in the database and used for generating responses and conversation titles.

## License

MIT 