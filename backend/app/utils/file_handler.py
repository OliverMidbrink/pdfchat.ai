import os
import shutil
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException, status

# Define the upload directory - make sure it exists
UPLOAD_DIR = Path("uploads")
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
    
    # Save the file
    with file_path.open("wb") as buffer:
        # Check file size as we read
        file_size = 0
        while chunk := await upload_file.read(8192):  # Read in 8kb chunks
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE:
                # Clean up the partial file
                if file_path.exists():
                    os.remove(file_path)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File size exceeds the {MAX_FILE_SIZE/1024/1024}MB limit"
                )
            buffer.write(chunk)
    
    # Return the storage path and unique filename
    return str(file_path), unique_filename

def get_file_url(file_path: str, user_id: int, document_id: int) -> str:
    """
    Generate a URL for accessing the file
    """
    # This is a simple example - in production you'd likely have a more complex URL structure
    # and possibly serve files from a cloud storage service like S3
    return f"/api/documents/{document_id}/download"

def delete_file(file_path: str) -> bool:
    """
    Delete a file from disk
    """
    try:
        path = Path(file_path)
        if path.exists():
            os.remove(path)
        return True
    except Exception as e:
        print(f"Error deleting file: {e}")
        return False 