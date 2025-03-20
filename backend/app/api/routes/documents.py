from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from fastapi.responses import FileResponse
import logging
import urllib.parse

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.document import Document
from app.schemas.document import DocumentResponse, DocumentUpdate
from app.utils.file_handler import save_upload_file, get_file_url, delete_file, verify_file_exists

router = APIRouter(tags=["documents"])

logger = logging.getLogger(__name__)

@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    conversation_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload a PDF document and associate it with a conversation (optional)
    """
    # Save the uploaded file
    try:
        file_path, unique_filename = await save_upload_file(file, current_user.id)
        
        # Create a document record in the database
        db_document = Document(
            name=file.filename,
            path=file_path,
            size=os.path.getsize(file_path),
            content_type=file.content_type,
            user_id=current_user.id,
            conversation_id=conversation_id
        )
        
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        
        # Generate a URL for accessing the file
        file_url = get_file_url(file_path, current_user.id, db_document.id)
        
        # Return the document information
        return {
            "id": db_document.id,
            "name": db_document.name,
            "size": db_document.size,
            "url": file_url,
            "created_at": db_document.created_at
        }
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise e
    except Exception as e:
        # Log the error
        print(f"Error uploading document: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload document. Please try again."
        )

@router.get("/documents", response_model=List[DocumentResponse])
async def get_documents(
    conversation_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all documents for the current user, optionally filtered by conversation_id
    """
    query = db.query(Document).filter(Document.user_id == current_user.id)
    
    if conversation_id:
        query = query.filter(Document.conversation_id == conversation_id)
    
    documents = query.order_by(Document.created_at.desc()).all()
    
    # Add URLs to the documents
    for doc in documents:
        doc.url = get_file_url(doc.path, current_user.id, doc.id)
    
    return documents

@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific document by ID
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Add URL to the document
    document.url = get_file_url(document.path, current_user.id, document.id)
    
    return document

@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Download a document
    """
    # Log the document download request
    logger.info(f"Document download request for ID {document_id} by user {current_user.id}")
    
    try:
        # Get the document from the database
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.user_id == current_user.id
        ).first()
        
        if not document:
            logger.warning(f"Document not found: ID {document_id} for user {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        file_path = document.path
        
        # Use the utility function to verify the file exists
        if not verify_file_exists(file_path):
            logger.error(f"File not found on server: {file_path}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found on server"
            )
        
        # Handle special characters in filename by using proper encoding
        # URL-encode the filename to make it safe for headers
        safe_filename = urllib.parse.quote(document.name)
        
        # Set appropriate headers for PDF content
        headers = {
            "Content-Disposition": f'inline; filename="{safe_filename}"',
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache, no-store, must-revalidate",  # Prevent caching
            "Pragma": "no-cache",
            "Expires": "0"
        }
        
        # Return the file response
        return FileResponse(
            path=file_path,
            filename=safe_filename,
            media_type=document.content_type,
            headers=headers
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log unexpected errors
        logger.error(f"Error while serving document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the document"
        )

@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a document
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Delete the file from storage
    delete_file(document.path)
    
    # Delete the document record from the database
    db.delete(document)
    db.commit()
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.patch("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a document (name or conversation association)
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Update the document properties
    if document_update.name is not None:
        document.name = document_update.name
    
    if document_update.conversation_id is not None:
        document.conversation_id = document_update.conversation_id
    
    db.commit()
    db.refresh(document)
    
    # Add URL to the document
    document.url = get_file_url(document.path, current_user.id, document.id)
    
    return document 