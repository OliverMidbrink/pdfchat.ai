from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
import re
import logging

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.chat import Conversation, Message
from app.models.document import Document
from app.schemas.chat import Conversation as ConversationSchema
from app.schemas.chat import ConversationCreate, ConversationUpdate
from app.schemas.chat import Message as MessageSchema
from app.schemas.chat import MessageCreate, ChatRequest, ChatResponse
from app.utils.openai_helper import OpenAIHelper
from app.utils.file_handler import verify_file_exists

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

@router.get("/conversations", response_model=List[ConversationSchema])
async def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    conversations = db.query(Conversation).filter(
        Conversation.user_id == current_user.id
    ).order_by(Conversation.updated_at.desc()).all()
    return conversations

@router.post("/conversations", response_model=ConversationSchema)
async def create_conversation(
    conversation: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_conversation = Conversation(
        title=conversation.title,
        user_id=current_user.id
    )
    db.add(db_conversation)
    db.commit()
    db.refresh(db_conversation)
    return db_conversation

@router.get("/conversations/{conversation_id}", response_model=ConversationSchema)
async def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return conversation

@router.put("/conversations/{conversation_id}", response_model=ConversationSchema)
async def update_conversation(
    conversation_id: int,
    conversation_update: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not db_conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if conversation_update.title is not None:
        db_conversation.title = conversation_update.title
    
    db.commit()
    db.refresh(db_conversation)
    return db_conversation

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not db_conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    db.delete(db_conversation)
    db.commit()
    return None

@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Check if user has API key
    if not current_user.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OpenAI API key not found in user settings"
        )
    
    # Extract document references and get the processed message
    message_text, doc_references = extract_document_references(chat_request.message)
    
    # Get or create conversation
    if chat_request.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == chat_request.conversation_id,
            Conversation.user_id == current_user.id
        ).first()
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
    else:
        conversation = Conversation(
            title="New Conversation",
            user_id=current_user.id
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Fetch referenced documents
    document_context = ""
    referenced_documents = []
    
    if doc_references:
        # Get documents from database - now returns all matching documents
        referenced_documents = get_referenced_documents(db, doc_references, current_user.id)
        
        # Create lists of document names for feedback
        found_docs = [doc["name"] for doc in referenced_documents]
        not_found_refs = [ref for ref in doc_references if not any(doc["name"] == ref or ref in doc["name"] for doc in referenced_documents)]
        
        # Add feedback about which documents were found/not found
        if referenced_documents:
            # Add information about which documents are being used
            if len(referenced_documents) == 1:
                found_msg = f"Using document: {found_docs[0]}"
            else:
                found_msg = f"Using {len(referenced_documents)} documents: {', '.join(found_docs[:5])}"
                if len(found_docs) > 5:
                    found_msg += f" and {len(found_docs) - 5} more"
            
            # Add this information to the message for clarity
            if message_text == chat_request.message:
                # If no processing happened yet, start fresh
                message_text = f"{found_msg}\n\n{chat_request.message}"
            else:
                # If already processed, add to beginning
                message_text = f"{found_msg}\n\n{message_text}"
                
        # If any referenced documents couldn't be found, include that in the message
        if not_found_refs:
            not_found_msg = f"Note: Could not find these referenced documents: {', '.join(not_found_refs)}"
            message_text = f"{message_text}\n\n{not_found_msg}"
    
    # Save user message - always save original with brackets
    user_message = Message(
        conversation_id=conversation.id,
        content=chat_request.message,  # Save the original message with brackets
        is_user=True
    )
    db.add(user_message)
    db.commit()
    
    # Prepare message history
    messages = []
    conversation_messages = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at).all()
    
    # Format messages for OpenAI
    for msg in conversation_messages:
        role = "user" if msg.is_user else "assistant"
        messages.append({"role": role, "content": msg.content})
    
    # Generate AI response
    openai_helper = OpenAIHelper(current_user.openai_api_key)
    
    # If we have documents, prepare the document context
    if referenced_documents:
        document_context = openai_helper.prepare_document_context(referenced_documents)
    
    # Generate response including document context
    ai_response = openai_helper.generate_response(messages, document_context=document_context)
    
    if ai_response is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate AI response"
        )
    
    # Save AI response
    ai_message = Message(
        conversation_id=conversation.id,
        content=ai_response,
        is_user=False
    )
    db.add(ai_message)
    
    # Update conversation title if it's a new conversation
    if conversation.title == "New Conversation" and len(conversation_messages) <= 1:
        try:
            # Generate a descriptive title using OpenAI
            generated_title = openai_helper.generate_title(chat_request.message)
            conversation.title = generated_title
        except Exception as e:
            print(f"Error generating title: {str(e)}")
            # Fall back to truncated message as title
            shortened_title = message_text[:40] + "..." if len(message_text) > 40 else message_text
            conversation.title = shortened_title
    
    db.commit()
    
    return ChatResponse(
        message=ai_response,
        conversation_id=conversation.id
    )

def extract_document_references(message: str) -> Tuple[str, List[str]]:
    """
    Extract document references in [doc name] format from message
    
    Args:
        message: Original message
        
    Returns:
        Tuple of (processed message, list of document references)
    """
    if not message:
        return "", []
    
    # Regex to match [any text] pattern
    pattern = r'\[(.*?)\]'
    
    # Find all matches
    matches = re.findall(pattern, message)
    
    # Sanitize matches to prevent injection
    sanitized_matches = []
    for match in matches:
        doc_name = match.strip()
        if doc_name:
            # Validate and sanitize document names
            # Max length check to prevent overly long references
            if len(doc_name) > 255:
                doc_name = doc_name[:255]
            sanitized_matches.append(doc_name)
    
    # Create a processed message where we replace [doc] with "Using document: doc"
    processed_message = message
    for match in matches:
        doc_name = match.strip()
        if doc_name:
            # Use a safer string replacement approach
            safe_name = doc_name
            if len(safe_name) > 255:
                safe_name = safe_name[:255]
            processed_message = processed_message.replace(f"[{match}]", f"Using document: {safe_name}")
    
    return processed_message, sanitized_matches

def get_referenced_documents(db: Session, doc_references: List[str], user_id: int) -> List[dict]:
    """
    Get referenced documents from the database
    
    Args:
        db: Database session
        doc_references: List of document references
        user_id: User ID
        
    Returns:
        List of document objects with path and name
    """
    documents = []
    
    # Set a reasonable limit for total documents
    max_total_documents = 10
    
    # If no specific references, return empty list
    if not doc_references:
        return documents
    
    # Process each document reference
    for doc_ref in doc_references:
        try:
            matched_docs = []
            
            # Try to find all documents with exact name match first
            exact_matches = db.query(Document).filter(
                Document.user_id == user_id,
                Document.name == doc_ref
            ).all()
            
            if exact_matches:
                matched_docs.extend(exact_matches)
            else:
                # If no exact matches, find all partial matches
                partial_matches = db.query(Document).filter(
                    Document.user_id == user_id,
                    Document.name.ilike(f"%{doc_ref}%")
                ).all()
                matched_docs.extend(partial_matches)
            
            # Process all matched documents
            for document in matched_docs:
                # Verify file exists on disk before including
                if verify_file_exists(document.path):
                    doc_data = {
                        "path": document.path,
                        "name": document.name,
                        "id": document.id
                    }
                    
                    # Only add if not already in the list (avoid duplicates)
                    if not any(doc["id"] == document.id for doc in documents):
                        documents.append(doc_data)
                else:
                    logger.warning(f"Document file not found on disk: {document.path}")
                    
            # Check if we've reached the maximum total documents
            if len(documents) >= max_total_documents:
                logger.warning(f"Maximum number of documents ({max_total_documents}) reached")
                break
                
        except Exception as e:
            logger.error(f"Error processing document reference '{doc_ref}': {str(e)}")
            continue
    
    # Log how many documents were found
    logger.info(f"Found {len(documents)} documents matching references: {doc_references}")
    
    return documents 