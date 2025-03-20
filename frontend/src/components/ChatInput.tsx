import React, { useState, useRef, useEffect, RefObject } from 'react';
import { FiSend } from 'react-icons/fi';
import DocumentSelector from './DocumentSelector';

// Define a more flexible ref type that works with useRef<HTMLTextAreaElement>(null)
type FlexibleTextAreaRef = RefObject<HTMLTextAreaElement> | RefObject<HTMLTextAreaElement | null>;

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  inputRef?: FlexibleTextAreaRef;
  documents?: Array<{id: string | number, name: string}>;
  pinnedDocIds?: Set<string | number>;
  onTogglePinned?: (docId: string | number) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  disabled = false,
  value,
  onChange,
  inputRef,
  documents = [],
  pinnedDocIds,
  onTogglePinned
}) => {
  const [message, setMessage] = useState('');
  const defaultTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Use a type assertion here to make TypeScript happy
  const textareaRef = (inputRef || defaultTextareaRef) as RefObject<HTMLTextAreaElement>;
  
  // Use controlled or uncontrolled based on whether value/onChange are provided
  const isControlled = value !== undefined && onChange !== undefined;

  // Adjust textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isControlled ? value : message, textareaRef]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentToSend = isControlled ? value : message;
    
    if (contentToSend && contentToSend.trim() && !disabled) {
      onSendMessage(contentToSend);
      
      // Only update internal state if uncontrolled
      if (!isControlled) {
        setMessage('');
      } else if (onChange) {
        // Call onChange with empty value if controlled
        const event = {
          target: { value: '' }
        } as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(event);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isControlled && onChange) {
      onChange(e);
    } else {
      setMessage(e.target.value);
    }
  };
  
  // Insert multiple document references at once
  const insertMultipleDocumentReferences = (documentNames: string[]) => {
    if (!textareaRef.current || documentNames.length === 0) return;
    
    const startPos = textareaRef.current.selectionStart;
    const endPos = textareaRef.current.selectionEnd;
    
    // Create references string with each document in its own brackets
    const references = documentNames.map(name => `[${name}]`).join(" ");
    
    // Add a space before references if there's existing text and it doesn't end with a space
    const currentValue = isControlled ? value || '' : message;
    const needsSpace = startPos > 0 && 
                      currentValue.length > 0 && 
                      !currentValue.substring(startPos - 1, startPos).match(/\s/);
    
    const prefix = needsSpace ? ' ' : '';
    const newValue = currentValue.substring(0, startPos) + prefix + references + currentValue.substring(endPos);
    
    if (isControlled && onChange) {
      const event = {
        target: { value: newValue }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(event);
    } else {
      setMessage(newValue);
    }
    
    // Focus back on textarea and place cursor after insertion
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = startPos + prefix.length + references.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-2">
          <DocumentSelector 
            documents={documents}
            onInsertReferences={insertMultipleDocumentReferences}
            pinnedDocIds={pinnedDocIds}
            onTogglePinned={onTogglePinned}
          />
        </div>
        
        <div className="relative rounded-lg border border-gray-300 dark:border-gray-700 focus-within:border-black dark:focus-within:border-gray-400 overflow-hidden">
          <div className="flex items-center">
            <textarea
              ref={textareaRef}
              className="flex-grow py-3 pl-4 pr-12 bg-transparent resize-none focus:outline-none"
              placeholder="Type a message..."
              value={isControlled ? value : message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={disabled}
            />
            <button
              type="submit"
              className="absolute right-2 bottom-3 text-gray-400 hover:text-black dark:hover:text-white p-1 rounded-full"
              disabled={!(isControlled ? value : message).trim() || disabled}
            >
              <FiSend size={20} />
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          Press Enter to send. Shift+Enter for new line.
        </div>
      </div>
    </form>
  );
};

export default ChatInput; 