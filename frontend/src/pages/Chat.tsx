import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import Settings from '../components/Settings';
import { FiLogOut } from 'react-icons/fi';

interface Message {
  id: number;
  content: string;
  is_user: boolean;
}

interface Conversation {
  id: number;
  title: string;
  messages: Message[];
}

const API_URL = 'http://localhost:8000/api';

const Chat: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user has API key
  const hasApiKey = user?.has_openai_api_key;

  // Fetch conversations on component mount
  useEffect(() => {
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, activeConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API_URL}/conversations`);
      setConversations(response.data);
      
      // If there are conversations and none is active, set the most recent one as active
      if (response.data.length > 0 && activeConversation === null) {
        setActiveConversation(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Failed to load conversations');
    }
  };

  const handleCreateConversation = async () => {
    try {
      const response = await axios.post(`${API_URL}/conversations`, {
        title: 'New Conversation'
      });
      
      const newConversation = response.data;
      setConversations([newConversation, ...conversations]);
      setActiveConversation(newConversation.id);
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError('Failed to create new conversation');
    }
  };

  const handleDeleteConversation = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/conversations/${id}`);
      
      // Update state
      const updatedConversations = conversations.filter(conv => conv.id !== id);
      setConversations(updatedConversations);
      
      // If the active conversation was deleted, set a new active conversation
      if (activeConversation === id) {
        setActiveConversation(updatedConversations.length > 0 ? updatedConversations[0].id : null);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setError('Failed to delete conversation');
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!hasApiKey) {
      setError('Please add your OpenAI API key in settings');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Send message to backend
      const response = await axios.post(`${API_URL}/chat`, {
        message: content,
        conversation_id: activeConversation
      });
      
      // Refresh the current conversation to show the new messages
      const convResponse = await axios.get(`${API_URL}/conversations/${response.data.conversation_id}`);
      
      // Update state
      const updatedConversations = conversations.map(conv => 
        conv.id === convResponse.data.id ? convResponse.data : conv
      );
      
      // If this was a new conversation (no active conversation before), add it to the list
      if (!activeConversation) {
        setConversations([convResponse.data, ...updatedConversations]);
      } else {
        setConversations(updatedConversations);
      }
      
      setActiveConversation(convResponse.data.id);
    } catch (error: any) {
      console.error('Error sending message:', error);
      let errorMessage = 'Failed to send message';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get current conversation
  const currentConversation = conversations.find(conv => conv.id === activeConversation);

  // Determine if we're using mobile layout
  // // // const isMobile = window.innerWidth < 768;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="hidden md:block h-full">
        <Sidebar
          conversations={conversations}
          activeConversation={activeConversation}
          onSelectConversation={setActiveConversation}
          onNewConversation={handleCreateConversation}
          onDeleteConversation={handleDeleteConversation}
        />
      </div>

      {/* Mobile Sidebar */}
      <div className="md:hidden">
        <Sidebar
          conversations={conversations}
          activeConversation={activeConversation}
          onSelectConversation={setActiveConversation}
          onNewConversation={handleCreateConversation}
          onDeleteConversation={handleDeleteConversation}
          isMobile={true}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Chat Header */}
        <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center">
          <h1 
            className="text-xl font-semibold truncate max-w-md"
            title={currentConversation?.title || 'AI Chat'}
          >
            {currentConversation?.title || 'AI Chat'}
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center text-gray-500 hover:text-black dark:hover:text-white"
            aria-label="Logout"
          >
            <FiLogOut size={20} className="mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-black">
          {currentConversation && currentConversation.messages.length > 0 ? (
            currentConversation.messages.map((message) => (
              <ChatMessage
                key={message.id}
                content={message.content}
                isUser={message.is_user}
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-4">
                <h2 className="text-xl font-semibold mb-2">Start a new conversation</h2>
                <p className="text-gray-500 max-w-md">
                  {hasApiKey
                    ? 'Send a message to start chatting with the AI.'
                    : 'Please add your OpenAI API key in settings first.'}
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 p-3 text-sm">
            {error}
          </div>
        )}

        {/* Chat Input */}
        <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
      </div>

      {/* Settings */}
      <Settings />
    </div>
  );
};

export default Chat; 