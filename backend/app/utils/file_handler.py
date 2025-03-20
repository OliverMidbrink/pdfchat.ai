import os
import shutil
import uuid
import logging
from pathlib import Path
from fastapi import UploadFile, HTTPException, status

# Configure logging
logger = logging.getLogger(__name__)

# Define the upload directory - make sure it exists
# Use an absolute path by default, or get from environment variable
BASE_DIR = Path(os.getenv('UPLOAD_BASE_DIR', os.path.abspath('uploads')))
UPLOAD_DIR = BASE_DIR
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Define allowed file types and size limit
ALLOWED_CONTENT_TYPES = ["application/pdf"]
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

async def save_upload_file(upload_file: UploadFile, user_id: int) -> tuple[str, str]:
    """
    Save an uploaded file to disk and return its storage path and unique filename
    """
    # Validate content type
    if upload_file.content_type not in ALLOWED_CONTENT_TYPES:
        logger.warning(f"Unsupported file type attempted: {upload_file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {upload_file.content_type}. Only PDF files are allowed."
        )
    
    # Create user directory if it doesn't exist
    user_dir = UPLOAD_DIR / f"user_{user_id}"
    user_dir.mkdir(exist_ok=True)
    
    # Generate a unique filename
    file_ext = os.path.splitext(upload_file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    
    # Define the file path
    file_path = user_dir / unique_filename
    
    # Create a temp file first to avoid partial writes
    temp_path = file_path.with_suffix('.tmp')
    
    try:
        # Save the file
        with temp_path.open("wb") as buffer:
            # Check file size as we read
            file_size = 0
            while chunk := await upload_file.read(8192):  # Read in 8kb chunks
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    # Clean up the partial file
                    if temp_path.exists():
                        os.remove(temp_path)
                    logger.warning(f"File size exceeded limit: {file_size} bytes")
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File size exceeds the {MAX_FILE_SIZE/1024/1024}MB limit"
                    )
                buffer.write(chunk)
        
        # File saved successfully, rename from temp to final name
        temp_path.rename(file_path)
        logger.info(f"File saved successfully: {file_path}")
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Clean up any partial files
        if temp_path.exists():
            os.remove(temp_path)
        logger.error(f"Error saving file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save file. Please try again."
        )
    
    # Return the storage path and unique filename
    return str(file_path), unique_filename

def get_file_url(file_path: str, user_id: int, document_id: int) -> str:
    """
    Generate a URL for accessing the file
    """
    # Add a cache-busting parameter to help avoid caching issues
    cache_buster = uuid.uuid4().hex[:8]
    return f"/api/documents/{document_id}/download?v={cache_buster}"

def verify_file_exists(file_path: str) -> bool:
    """
    Verify that a file exists at the given path
    """
    path = Path(file_path)
    return path.exists() and path.is_file()

def delete_file(file_path: str) -> bool:
    """
    Delete a file from disk
    """
    try:
        path = Path(file_path)
        if path.exists():
            os.remove(path)
            logger.info(f"File deleted: {file_path}")
            return True
        else:
            logger.warning(f"File not found for deletion: {file_path}")
            return False
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return False 