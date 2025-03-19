import React, { useState, useRef, useEffect } from 'react';
import { FiSend } from 'react-icons/fi';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled = false }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Adjust textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-lg border border-gray-300 dark:border-gray-700 focus-within:border-black dark:focus-within:border-gray-400 overflow-hidden">
          <textarea
            ref={textareaRef}
            className="w-full py-3 pl-4 pr-12 bg-transparent resize-none focus:outline-none"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
          />
          <button
            type="submit"
            className="absolute right-2 bottom-3 text-gray-400 hover:text-black dark:hover:text-white p-1 rounded-full"
            disabled={!message.trim() || disabled}
          >
            <FiSend size={20} />
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          Press Enter to send. Shift+Enter for new line.
        </div>
      </div>
    </form>
  );
};

export default ChatInput; 