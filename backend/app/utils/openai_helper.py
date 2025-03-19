import openai
from typing import Optional

class OpenAIHelper:
    def __init__(self, api_key: str):
        self.api_key = api_key
        openai.api_key = api_key

    def generate_response(self, messages: list, model: str = "gpt-3.5-turbo") -> Optional[str]:
        """
        Generate a response using OpenAI's API
        
        Args:
            messages: List of message objects with role and content
            model: Model to use, default is gpt-3.5-turbo
            
        Returns:
            Response text or None if there was an error
        """
        try:
            response = openai.ChatCompletion.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
                top_p=1.0,
                frequency_penalty=0.0,
                presence_penalty=0.0
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Error generating OpenAI response: {str(e)}")
            return None
            
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
            response = openai.ChatCompletion.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that creates short, descriptive titles for conversations. The title should be concise (max 5 words) and capture the essence of the user's message."},
                    {"role": "user", "content": f"Create a short, descriptive title (max 5 words) for a conversation that starts with this message: \"{message}\""}
                ],
                temperature=0.7,
                max_tokens=20,
                top_p=1.0,
                frequency_penalty=0.0,
                presence_penalty=0.0
            )
            title = response.choices[0].message.content.strip()
            # Remove quotes if they were added by the model
            title = title.strip('"\'')
            return title
        except Exception as e:
            print(f"Error generating conversation title: {str(e)}")
            # Fall back to truncated message
            return message[:40] + "..." if len(message) > 40 else message 