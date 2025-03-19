import React, { useState, useEffect } from 'react';
import { FiSettings, FiX, FiKey } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

interface SettingsProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  isOpen: externalIsOpen, 
  onClose 
}) => {
  const [isOpen, setIsOpen] = useState(externalIsOpen || false);
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const { user, updateUserApiKey } = useAuth();

  // Sync with external open state
  useEffect(() => {
    if (externalIsOpen !== undefined) {
      setIsOpen(externalIsOpen);
    }
  }, [externalIsOpen]);

  const toggleSettings = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    // If closing and there's an external control, call it
    if (!newIsOpen && onClose) {
      onClose();
    }
    
    setMessage(null);
    // If a user already has an API key, don't display it for security reasons
    setApiKey('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setMessage({ text: 'API key cannot be empty', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      await updateUserApiKey(apiKey);
      setMessage({ text: 'API key saved successfully', type: 'success' });
      setApiKey('');
    } catch (error) {
      setMessage({ text: 'Failed to save API key', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Settings button - only show if not externally controlled */}
      {externalIsOpen === undefined && (
        <button
          className="fixed bottom-4 right-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-full shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={toggleSettings}
          aria-label="Settings"
        >
          <FiSettings size={20} />
        </button>
      )}

      {/* Settings panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSettings}
          >
            <motion.div
              className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md m-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-semibold">Settings</h2>
                <button
                  onClick={toggleSettings}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  aria-label="Close settings"
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="p-4">
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label htmlFor="apiKey" className="block text-sm font-medium mb-2">
                      OpenAI API Key
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <FiKey size={16} />
                      </div>
                      <input
                        type="password"
                        id="apiKey"
                        placeholder="Enter your OpenAI API key"
                        className="pl-10 w-full py-2 px-4 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-gray-400 bg-white dark:bg-gray-800"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {user?.has_openai_api_key 
                        ? "You already have an API key saved. Enter a new one to update it." 
                        : "You need to provide your OpenAI API key to use the chat."}
                    </p>
                  </div>

                  {message && (
                    <div className={`p-3 mb-4 rounded-md ${
                      message.type === 'success' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                    }`}>
                      {message.text}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Saving...' : 'Save API Key'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Settings; 