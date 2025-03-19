import React, { useState, useEffect } from 'react';
import { FiPlus, FiMenu, FiX, FiTrash2, FiChevronLeft, FiChevronRight, FiFile, FiSettings } from 'react-icons/fi';
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
  onToggleDocuments: () => void;
  onOpenSettings?: () => void;
  isMobile?: boolean;
  isSidebarOpen?: boolean;
  onSidebarToggle?: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onToggleDocuments,
  onOpenSettings,
  isMobile = false,
  isSidebarOpen,
  onSidebarToggle
}) => {
  const [isOpen, setIsOpen] = useState(isSidebarOpen !== undefined ? isSidebarOpen : !isMobile);

  // Sync with external state
  useEffect(() => {
    if (isSidebarOpen !== undefined && isOpen !== isSidebarOpen) {
      setIsOpen(isSidebarOpen);
    }
  }, [isSidebarOpen, isOpen]);

  const toggleSidebar = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (onSidebarToggle) {
      onSidebarToggle(newIsOpen);
    }
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
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col relative h-full"
            initial={isMobile ? { x: -64, opacity: 0 } : { x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={isMobile ? { x: -64, opacity: 0 } : { x: -20, opacity: 0 }}
            transition={{ 
              type: 'tween', 
              duration: isMobile ? 0.25 : 0.2,
              ease: 'easeOut'
            }}
            style={{ 
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)'
            }}
          >
            {/* Desktop collapse button */}
            {!isMobile && (
              <button
                className="absolute -right-3 top-1/2 transform -translate-y-1/2 z-10 p-1 bg-gray-100 dark:bg-gray-800 rounded-full shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-110 border border-gray-200 dark:border-gray-700 transition-all duration-200"
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
              >
                <FiChevronLeft size={16} />
              </button>
            )}

            {/* Sidebar content with staggered animation */}
            <motion.div 
              className="flex flex-col h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <button
                  className="w-full py-2 px-4 bg-black text-white rounded-md flex items-center justify-center"
                  onClick={onNewConversation}
                >
                  <FiPlus className="mr-2" />
                  New Conversation
                </button>
                
                <button
                  className="w-full mt-2 py-2 px-4 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-md flex items-center justify-center"
                  onClick={onToggleDocuments}
                >
                  <FiFile className="mr-2" />
                  Documents
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

              {/* Settings button at the bottom */}
              <div className="p-3 border-t border-gray-200 dark:border-gray-800 mt-auto">
                <button
                  className="w-full py-2 px-4 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md flex items-center transition-colors"
                  onClick={onOpenSettings}
                  aria-label="Open settings"
                >
                  <FiSettings className="mr-3" />
                  <span>Settings</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed sidebar indicator for desktop */}
      {!isMobile && !isOpen && (
        <div 
          className="h-full flex-shrink-0 relative bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 w-10 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          onClick={toggleSidebar}
          aria-label="Expand sidebar"
        >
          <button
            className="absolute top-1/2 left-1/2 transform -translate-y-1/2 -translate-x-1/2 p-1 bg-gray-100 dark:bg-gray-800 rounded-full shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-110 border border-gray-200 dark:border-gray-700 transition-all duration-200 pointer-events-none"
            aria-hidden="true"
          >
            <FiChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
};

export default Sidebar; 