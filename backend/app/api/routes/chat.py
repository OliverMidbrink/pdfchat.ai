from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.chat import Conversation, Message
from app.schemas.chat import Conversation as ConversationSchema
from app.schemas.chat import ConversationCreate, ConversationUpdate
from app.schemas.chat import Message as MessageSchema
from app.schemas.chat import MessageCreate, ChatRequest, ChatResponse
from app.utils.openai_helper import OpenAIHelper

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
    
    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        content=chat_request.message,
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
    ai_response = openai_helper.generate_response(messages)
    
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
            shortened_title = chat_request.message[:40] + "..." if len(chat_request.message) > 40 else chat_request.message
            conversation.title = shortened_title
    
    db.commit()
    
    return ChatResponse(
        message=ai_response,
        conversation_id=conversation.id
    ) 