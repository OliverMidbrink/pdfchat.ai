import openai
import logging
from typing import Optional, List, Dict, Any
from app.utils.pdf_processor import PDFProcessor

logger = logging.getLogger(__name__)

class OpenAIHelper:
    def __init__(self, api_key: str):
        self.api_key = api_key
        openai.api_key = api_key

    def generate_response(self, messages: list, model: str = "gpt-3.5-turbo", document_context: str = None) -> Optional[str]:
        """
        Generate a response using OpenAI's API
        
        Args:
            messages: List of message objects with role and content
            model: Model to use, default is gpt-3.5-turbo
            document_context: Optional document context to include
            
        Returns:
            Response text or None if there was an error
        """
        try:
            # Input validation
            if not isinstance(messages, list) or not messages:
                logger.error("Invalid messages format: must be a non-empty list")
                return "Error: Invalid request format"
            
            # Clean message content to prevent potential issues
            cleaned_messages = self._sanitize_messages(messages)
            
            # If we have document context, prepend a system message with the context
            processed_messages = cleaned_messages.copy()
            
            if document_context:
                # Add a system message at the beginning with document context
                system_msg = {
                    "role": "system", 
                    "content": f"You are a helpful assistant with access to the following documents. "
                               f"When answering the user's question, use only information found in these documents. "
                               f"If the information isn't in the documents, say you don't have that information. "
                               f"When quoting from the documents, cite the specific page number as 'Document Name [Page X]'.\n\n"
                               f"{document_context}"
                }
                
                # Add system message at the beginning if there isn't one, or after the first one
                has_system = any(msg.get("role") == "system" for msg in processed_messages)
                if not has_system:
                    processed_messages.insert(0, system_msg)
                else:
                    # Find the index of the first non-system message
                    first_non_system = next((i for i, msg in enumerate(processed_messages) 
                                           if msg.get("role") != "system"), 0)
                    processed_messages.insert(first_non_system, system_msg)
            
            # Enforce token limits to prevent unnecessarily large requests
            processed_messages = self._enforce_token_limits(processed_messages)
            
            # Make API call with timeout
            response = openai.ChatCompletion.create(
                model=model,
                messages=processed_messages,
                temperature=0.7,
                max_tokens=2000,  # Increased for document analysis
                top_p=1.0,
                frequency_penalty=0.0,
                presence_penalty=0.0,
                timeout=30,  # Timeout in seconds
            )
            
            # Process and return response
            if not response.choices or not response.choices[0].message:
                logger.error("API returned an empty response")
                return "Error: Empty response from API"
                
            return response.choices[0].message.content.strip()
            
        except openai.error.OpenAIError as e:
            logger.error(f"OpenAI API error: {str(e)}")
            return f"Error communicating with AI service: {str(e)}"
        except Exception as e:
            logger.error(f"Error generating OpenAI response: {str(e)}")
            return None
    
    def _sanitize_messages(self, messages: list) -> list:
        """
        Sanitize messages to prevent potential security issues
        
        Args:
            messages: List of message objects
            
        Returns:
            Sanitized messages
        """
        sanitized = []
        for msg in messages:
            if not isinstance(msg, dict):
                continue
                
            role = msg.get("role", "")
            content = msg.get("content", "")
            
            # Only allow valid roles and content
            if role not in ["system", "user", "assistant"] or not isinstance(content, str):
                continue
            
            # Add sanitized message
            sanitized.append({
                "role": role,
                "content": content
            })
        
        return sanitized
    
    def _enforce_token_limits(self, messages: list) -> list:
        """
        Enforce token limits to prevent unnecessarily large requests
        This is a simplified version - in production you'd use tiktoken for actual token counting
        
        Args:
            messages: List of message objects
            
        Returns:
            Messages with enforced token limits
        """
        # Rough character-to-token ratio for GPT models
        CHARS_PER_TOKEN = 4
        MAX_TOKENS = 16000  # For gpt-3.5-turbo-16k
        
        # Apply a simple character-based limit for demonstration
        total_chars = sum(len(msg.get("content", "")) for msg in messages)
        
        # If we're under the limit, return as is
        if total_chars < MAX_TOKENS * CHARS_PER_TOKEN:
            return messages
        
        # Otherwise, truncate messages from the beginning, preserving the most recent ones
        # Always keep the system message if present
        truncated_messages = []
        current_chars = 0
        
        # Keep the system message(s) if they exist
        system_messages = [msg for msg in messages if msg.get("role") == "system"]
        non_system_messages = [msg for msg in messages if msg.get("role") != "system"]
        
        # Add most recent messages until we hit the limit, leaving room for system messages
        system_chars = sum(len(msg.get("content", "")) for msg in system_messages)
        remaining_chars = MAX_TOKENS * CHARS_PER_TOKEN - system_chars
        
        # Add non-system messages from newest to oldest until we hit the limit
        for msg in reversed(non_system_messages):
            msg_chars = len(msg.get("content", ""))
            if current_chars + msg_chars > remaining_chars:
                # If this message would put us over the limit, skip it
                continue
            
            truncated_messages.insert(0, msg)
            current_chars += msg_chars
        
        # Add system messages at the beginning
        return system_messages + truncated_messages
            
    def generate_title(self, message: str, model: str = "gpt-3.5-turbo") -> Optional[str]:
        """
        Generate a conversation title based on the first message
        
        Args:
            message: The first message in the conversation
            model: Model to use, default is gpt-3.5-turbo
            
        Returns:
            Generated title or None if there was an error
        """
        try:
            # Basic input validation
            if not message or not isinstance(message, str):
                return "New Conversation"
                
            # Truncate if necessary
            input_msg = message[:1000] if len(message) > 1000 else message
            
            response = openai.ChatCompletion.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that creates short, descriptive titles for conversations. The title should be concise (max 5 words) and capture the essence of the user's message."},
                    {"role": "user", "content": f"Create a short, descriptive title (max 5 words) for a conversation that starts with this message: \"{input_msg}\""}
                ],
                temperature=0.7,
                max_tokens=20,
                top_p=1.0,
                frequency_penalty=0.0,
                presence_penalty=0.0,
                timeout=10  # Shorter timeout for title generation
            )
            
            title = response.choices[0].message.content.strip()
            
            # Remove quotes if they were added by the model
            title = title.strip('"\'')
            
            # Sanitize title to prevent potential security issues
            title = PDFProcessor.sanitize_text(title)
            
            # Ensure title isn't empty or too long
            if not title or len(title) > 100:
                return message[:40] + "..." if len(message) > 40 else message
                
            return title
            
        except Exception as e:
            logger.error(f"Error generating conversation title: {str(e)}")
            # Fall back to truncated message
            return message[:40] + "..." if len(message) > 40 else message
    
    def prepare_document_context(self, documents: List[Dict[str, Any]]) -> str:
        """
        Prepare document context for inclusion in the OpenAI prompt
        
        Args:
            documents: List of document objects with paths and names
            
        Returns:
            Formatted document context string
        """
        if not documents:
            return ""
        
        # Enforce document limit to prevent overloading the API
        MAX_DOCUMENTS = 5
        if len(documents) > MAX_DOCUMENTS:
            logger.warning(f"Too many documents provided ({len(documents)}), limiting to {MAX_DOCUMENTS}")
            documents = documents[:MAX_DOCUMENTS]
            
        context_parts = []
        total_size = 0
        MAX_CONTEXT_SIZE = 50000  # Approx char limit to avoid exceeding token limits
        
        try:
            for doc in documents:
                # Validate required fields
                if "path" not in doc or "name" not in doc:
                    logger.warning(f"Invalid document format: {doc}")
                    continue
                    
                text, success = PDFProcessor.format_document_for_prompt(doc["path"], doc["name"])
                
                # Check if adding this document would exceed the context size
                if total_size + len(text) > MAX_CONTEXT_SIZE and context_parts:
                    logger.warning(f"Document context size limit reached, truncating")
                    # Add a warning about truncation
                    context_parts.append("\n[Note: Some document content was truncated due to size limits]")
                    break
                    
                if success:
                    context_parts.append(text)
                    total_size += len(text)
                else:
                    # Still include even if there was an issue, so we can inform the user
                    context_parts.append(text)
                    total_size += len(text)
                    
        except Exception as e:
            logger.error(f"Error preparing document context: {str(e)}")
            return f"Error processing documents: {str(e)}"
                
        return "\n\n".join(context_parts) 