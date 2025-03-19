# Database Setup Guide

This guide explains how to properly set up the database when cloning the pdfchat.ai repository.

## Problem

When cloning the repository and running `./setup.sh`, you might encounter an issue where the application is stuck in the "verifying authentication" state, no matter how much you refresh. This happens because:

1. The `setup.sh` script installs dependencies but doesn't explicitly initialize the database with tables
2. No initial user is created, so authentication fails
3. The database tables should be created when the application starts, but if there's an issue with this process, authentication will fail

## Solution

Follow these steps to ensure your database is properly set up:

### 1. Run the provided initialization scripts

This repository includes two helper scripts to initialize the database and create an initial user:

```bash
# Initialize the database (creates tables)
python init_db.py

# Create an initial admin user
python create_initial_user.py admin admin@example.com yourpassword
```

The first script will create all necessary database tables, and the second will create an admin user that you can use to log in.

### 2. Alternative manual approach

If the scripts don't work for you, you can manually initialize the database:

1. Start the backend server:
   ```bash
   cd backend
   source venv/bin/activate
   python run.py
   ```

2. In a new terminal, register a user using curl:
   ```bash
   curl -X POST http://localhost:8000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","email":"admin@example.com","password":"Password123!"}'
   ```

3. You should get a response with an access token if the registration was successful.

### 3. Verify database creation

You can verify that the database was created by checking for the `app.db` file in the backend directory:

```bash
ls -la backend/app.db
```

You should see the SQLite database file.

## Troubleshooting

If you're still experiencing issues:

1. **Database Connection**: Make sure the `.env` file in the backend directory has the correct database connection string:
   ```
   DATABASE_URL=sqlite:///./app.db
   ```

2. **Clean Start**: If you're still having issues, you can delete the database and start fresh:
   ```bash
   rm backend/app.db
   python init_db.py
   python create_initial_user.py
   ```

3. **Logs**: Check the application logs for any errors:
   ```bash
   cat logs/backend.log
   ```

4. **Dependencies**: Make sure all dependencies are installed correctly:
   ```bash
   cd backend
   source venv/bin/activate
   pip install -r requirements.txt
   ```

## Technical Details

- The application uses SQLite as the default database, with the database file located at `backend/app.db`
- The database tables are defined in `backend/app/models/` directory
- The table creation happens in the `create_tables()` function in `backend/app/db/session.py`
- This function is called when the application starts in `backend/app/main.py` 