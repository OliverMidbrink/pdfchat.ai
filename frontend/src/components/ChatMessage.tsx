import React from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiZap } from 'react-icons/fi';

interface ChatMessageProps {
  content: string;
  isUser: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ content, isUser }) => {
  return (
    <motion.div
      className={`py-6 ${isUser ? 'bg-white dark:bg-black' : 'bg-gray-50 dark:bg-gray-900'}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-start gap-4">
        <div className={`w-8 h-8 mt-1 flex-shrink-0 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-gray-200 text-black dark:bg-gray-800 dark:text-white' 
            : 'bg-black text-white'
        }`}>
          {isUser ? <FiUser size={16} /> : <FiZap size={16} />}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium mb-1">
            {isUser ? 'You' : 'AI Assistant'}
          </div>
          <div className="prose prose-gray dark:prose-invert prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:text-sm max-w-none">
            {content.split('\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessage; 