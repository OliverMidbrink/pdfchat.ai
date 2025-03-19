import React, { useState } from 'react';
import { FiPlus, FiMenu, FiX, FiTrash2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface Conversation {
  id: number;
  title: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConversation: number | null;
  onSelectConversation: (id: number) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: number) => void;
  isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isMobile = false
}) => {
  const [isOpen, setIsOpen] = useState(!isMobile);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Mobile toggle button */}
      {isMobile && (
        <button
          className="fixed top-4 left-4 z-50 p-2 bg-gray-100 dark:bg-gray-800 rounded-md"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="w-64 h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col"
            initial={isMobile ? { x: -320 } : { x: 0 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <button
                className="w-full py-2 px-4 bg-black text-white rounded-md flex items-center justify-center"
                onClick={onNewConversation}
              >
                <FiPlus className="mr-2" />
                New Conversation
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="py-2">
                {conversations.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                    No conversations yet
                  </div>
                ) : (
                  <ul>
                    {conversations.map((conversation) => (
                      <li key={conversation.id} className="px-2">
                        <div
                          className={`flex items-center justify-between py-2 px-3 rounded-md cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-800 ${
                            activeConversation === conversation.id
                              ? 'bg-gray-200 dark:bg-gray-800'
                              : ''
                          }`}
                          onClick={() => onSelectConversation(conversation.id)}
                        >
                          <span 
                            className="truncate"
                            title={conversation.title}
                          >
                            {conversation.title}
                          </span>
                          <button
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conversation.id);
                            }}
                            aria-label="Delete conversation"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar; 