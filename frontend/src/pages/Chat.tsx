import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import Settings from '../components/Settings';
import Resizer from '../components/Resizer';
import { FiLogOut, FiFile, FiX, FiUpload, FiCheck, FiEdit2, FiPlus, FiFileText, FiTrash, FiUploadCloud, FiMessageSquare, FiChevronLeft, FiChevronRight, FiZoomIn, FiZoomOut } from 'react-icons/fi';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker with specific version
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`;

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const [showDocumentPanel, setShowDocumentPanel] = useState<boolean>(false);
  
  // Panel size state
  const [documentPanelWidth, setDocumentPanelWidth] = useState(33); // 33% of remaining width

  // Check if user has API key
  const hasApiKey = user?.has_openai_api_key;

  // Add state to track sidebar open state from within Chat component
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // State for conversation title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // State for document management
  const [documents, setDocuments] = useState<Array<{
    id: string;
    name: string;
    size: number;
    uploadDate: Date;
    url?: string;
  }>>([]);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);

  // Additional state for document management
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  // Add current message state and input ref
  const [currentMessage, setCurrentMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // State for document deletion
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Add state for document list collapsed mode
  const [isDocumentListCollapsed, setIsDocumentListCollapsed] = useState(false);

  // Add state for PDF viewer
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  // Add state for PDF.js initialization
  const [isPdfReady, setIsPdfReady] = useState(false);

  // Function to update sidebar state that will be passed to Sidebar component
  const handleSidebarToggle = (isOpen: boolean) => {
    setIsSidebarOpen(isOpen);
  };

  // Toggle settings panel
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  // Effect for handling window resize
  useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      setIsMobile(newIsMobile);
      
      // Auto-hide document panel on small screens
      if (newIsMobile && showDocumentPanel) {
        setShowDocumentPanel(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showDocumentPanel]);

  // Fetch conversations on component mount
  useEffect(() => {
    fetchConversations();
    fetchDocuments();
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

  // Add helper function to ensure document URLs are properly formatted
  const getDocumentUrl = (url?: string): string => {
    if (!url) return '';
    
    // If the URL is already absolute (starts with http or https), return it as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If it's a relative API path, ensure it has the full API_URL
    if (url.startsWith('/api/')) {
      return `http://localhost:8000${url}`;
    }
    
    // Otherwise, prefix it with the API URL
    return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API_URL}/documents`);
      const formattedDocuments = response.data.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        size: doc.size,
        uploadDate: new Date(doc.created_at),
        url: getDocumentUrl(doc.url)
      }));
      setDocuments(formattedDocuments);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocumentError('Failed to load documents');
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
    if (!content.trim()) return;
    
    // Clear the current message
    setCurrentMessage('');
    
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

  // Handler for starting title edit
  const handleStartTitleEdit = () => {
    if (currentConversation) {
      setEditedTitle(currentConversation.title);
      setIsEditingTitle(true);
    }
  };

  // Handler for saving title edit
  const handleSaveTitleEdit = async () => {
    if (!currentConversation || !editedTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }

    try {
      // Call the API to update the conversation title
      await axios.patch(`${API_URL}/conversations/${currentConversation.id}`, {
        title: editedTitle.trim()
      });
      
      // Update the conversation in the state
      const updatedConversations = conversations.map(conv => 
        conv.id === currentConversation.id 
          ? { ...conv, title: editedTitle.trim() } 
          : conv
      );
      
      setConversations(updatedConversations);
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Error updating conversation title:', error);
      // Update local state anyway for better UX
      const updatedConversations = conversations.map(conv => 
        conv.id === currentConversation.id 
          ? { ...conv, title: editedTitle.trim() } 
          : conv
      );
      
      setConversations(updatedConversations);
      setIsEditingTitle(false);
    }
  };

  // Handler for canceling title edit
  const handleCancelTitleEdit = () => {
    setIsEditingTitle(false);
  };

  // Handler for title input keydown
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitleEdit();
    } else if (e.key === 'Escape') {
      handleCancelTitleEdit();
    }
  };

  // Toggle document panel visibility
  const toggleDocumentPanel = () => {
    setShowDocumentPanel(!showDocumentPanel);
  };

  // Handle resizing document panel
  const handleDocumentPanelResize = (delta: number) => {
    setDocumentPanelWidth((prevWidth) => {
      // Calculate the container width (accounting for sidebar width)
      const sidebarWidth = isSidebarOpen ? 256 : 40; // 256px when open, 40px when collapsed
      const containerWidth = window.innerWidth - sidebarWidth;
      
      // Calculate the current document panel width in pixels
      const currentWidthPx = (containerWidth * prevWidth) / 100;
      
      // Calculate the new width in pixels
      const newWidthPx = Math.max(200, Math.min(containerWidth - 300, currentWidthPx + delta));
      
      // Convert back to percentage
      const newWidth = (newWidthPx / containerWidth) * 100;
      return newWidth;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Check if file is a PDF
    if (file.type !== 'application/pdf') {
      setDocumentError('Only PDF files are supported');
      return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setDocumentError('File size should not exceed 10MB');
      return;
    }
    
    setIsUploadingDocument(true);
    setDocumentError(null);
    
    try {
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('file', file);
      
      // If we have an active conversation, associate the document with it
      if (activeConversation) {
        formData.append('conversation_id', activeConversation.toString());
      }
      
      // Upload the file to the server
      const response = await axios.post(`${API_URL}/documents/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Add the uploaded document to the state with properly formatted URL
      const newDocument = {
        id: response.data.id,
        name: file.name,
        size: file.size,
        uploadDate: new Date(response.data.created_at),
        url: getDocumentUrl(response.data.url)
      };
      
      setDocuments(prev => [newDocument, ...prev]);
      
    } catch (error) {
      console.error('Error uploading document:', error);
      setDocumentError('Failed to upload document. Please try again.');
    } finally {
      setIsUploadingDocument(false);
      // Reset the file input
      e.target.value = '';
    }
  };

  const handleRemoveDocument = async (id: string) => {
    try {
      // Call the API to delete the document
      await axios.delete(`${API_URL}/documents/${id}`);
      
      // Remove the document from state
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      
      // If this was the selected document, clear the selection
      if (selectedDocument === id) {
        setSelectedDocument(null);
      }
      
      // Close confirmation dialog
      setShowDeleteConfirm(false);
      setDocumentToDelete(null);
      
    } catch (error) {
      console.error('Error removing document:', error);
      setDocumentError('Failed to remove document. Please try again.');
      
      // Close confirmation dialog even on error
      setShowDeleteConfirm(false);
      setDocumentToDelete(null);
    }
  };

  // Function to handle document selection with collapsing effect
  const handleSelectDocument = (id: string) => {
    if (selectedDocument === id) {
      // If clicking the same document, just toggle collapsed state
      setIsDocumentListCollapsed(!isDocumentListCollapsed);
    } else {
      // If selecting a different document, select it and ensure list is collapsed
      setSelectedDocument(id);
      setIsDocumentListCollapsed(true);
      // Reset PDF state when switching documents
      setPageNumber(1);
      setNumPages(null);
    }
  };

  // Function to toggle document list collapsed state
  const toggleDocumentList = () => {
    setIsDocumentListCollapsed(!isDocumentListCollapsed);
  };
  
  // Get the currently selected document
  const currentDocument = documents.find(doc => doc.id === selectedDocument);

  const handleUseDocumentInChat = (id: string) => {
    // Get the document from state
    const document = documents.find(doc => doc.id === id);
    if (!document) return;
    
    // Append document reference to the current message
    setCurrentMessage(prev => 
      `${prev ? prev + '\n\n' : ''}Using document: ${document.name}`
    );
    
    // Focus on the input after adding the document reference
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Optionally close the document panel on mobile
    if (window.innerWidth <= 768) {
      setShowDocumentPanel(false);
    }
  };

  const initiateDocumentDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocumentToDelete(id);
    setShowDeleteConfirm(true);
  };
  
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDocumentToDelete(null);
  };

  // PDF viewer handlers
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };
  
  const changePage = (offset: number) => {
    if (!numPages) return;
    setPageNumber(prevPageNumber => {
      const newPageNumber = prevPageNumber + offset;
      return Math.max(1, Math.min(numPages, newPageNumber));
    });
  };
  
  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);
  
  const zoomIn = () => setScale(prevScale => Math.min(prevScale + 0.2, 2.5));
  const zoomOut = () => setScale(prevScale => Math.max(prevScale - 0.2, 0.5));

  // Updated useEffect for PDF.js initialization
  useEffect(() => {
    // Initialize PDF.js worker with multiple fallbacks
    const initPdfWorker = async () => {
      try {
        // Use specific version instead of dynamic version
        const workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`;
        
        // Set the worker source
        console.log(`Setting PDF.js worker to: ${workerSrc}`);
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        
        // Mark PDF.js as ready
        setIsPdfReady(true);
      } catch (error) {
        console.error("Error initializing PDF.js worker:", error);
        // Fallback to unpkg if CDN fails
        try {
          // Use specific version for fallback
          const fallbackSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;
          pdfjs.GlobalWorkerOptions.workerSrc = fallbackSrc;
          console.log(`Using fallback PDF.js worker: ${fallbackSrc}`);
          setIsPdfReady(true);
        } catch (fallbackError) {
          console.error("Error initializing fallback PDF.js worker:", fallbackError);
        }
      }
    };

    initPdfWorker();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
              Confirm Deletion
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete this document? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-gray-800 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => documentToDelete && handleRemoveDocument(documentToDelete)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar - for all views (both mobile and desktop) */}
        <Sidebar
          conversations={conversations}
          activeConversation={activeConversation}
          onSelectConversation={setActiveConversation}
          onNewConversation={handleCreateConversation}
          onDeleteConversation={handleDeleteConversation}
        onToggleDocuments={toggleDocumentPanel}
        onOpenSettings={toggleSettings}
        isMobile={isMobile}
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={handleSidebarToggle}
      />

      {/* Main content wrapper - takes all remaining space */}
      <div className="flex flex-1 h-full">
        {/* Document Panel */}
        {showDocumentPanel && (
          <>
            <div style={{ width: `${documentPanelWidth}%` }} className="flex flex-col h-full overflow-hidden border-r border-gray-200 dark:border-gray-800">
              <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Documents</h1>
                </div>
                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="pdf-upload"
                    className="cursor-pointer p-2 text-gray-500 hover:text-black dark:hover:text-white rounded-md flex items-center transition-colors"
                    title="Upload PDF"
                  >
                    <FiUpload size={18} />
                    <input 
                      type="file" 
                      id="pdf-upload" 
                      className="hidden" 
                      accept=".pdf"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <button 
                    className="p-2 text-gray-500 hover:text-black dark:hover:text-white rounded flex items-center"
                    onClick={toggleDocumentPanel}
                    aria-label="Close document panel"
                  >
                    <FiX size={18} />
                  </button>
                </div>
              </div>
              <div className="flex-1 flex flex-col bg-white dark:bg-black">
                <div className="p-4 flex-1 flex">
                  {/* Error message - full width when shown */}
                  {documentError && (
                    <div className="mb-4 p-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg w-full">
                      <p className="text-sm text-red-600 dark:text-red-400">{documentError}</p>
                    </div>
                  )}
                  
                  {/* Upload status - full width when shown */}
                  {isUploadingDocument && (
                    <div className="mb-4 p-3 border border-gray-200 dark:border-gray-800 rounded-lg w-full">
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 dark:border-gray-300 mr-2"></div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">Uploading document...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Document list and preview flex container */}
                  {!documentError && !isUploadingDocument && (
                    <div className="flex flex-1 h-full">
                      {/* Document list - collapsible sidebar */}
                      <div className={`h-full border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out ${
                        isDocumentListCollapsed ? 'w-16' : 'w-64'
                      }`}>
                        {/* Document list header */}
                        <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-800">
                          {!isDocumentListCollapsed && (
                            <h3 className="font-medium text-gray-800 dark:text-gray-200">Documents</h3>
                          )}
                          <button
                            onClick={toggleDocumentList}
                            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
                          >
                            {isDocumentListCollapsed ? (
                              <FiChevronRight size={16} />
                            ) : (
                              <FiChevronLeft size={16} />
                            )}
                          </button>
                        </div>
                      
                        {/* Document list items */}
                        {documents.length > 0 ? (
                          <div className={`overflow-y-auto h-[calc(100%-44px)]`}>
                            <ul className={`${isDocumentListCollapsed ? 'space-y-1 p-2' : 'space-y-2 p-3'}`}>
                              {documents.map((doc) => (
                                <li 
                                  key={doc.id} 
                                  className={`rounded-lg border transition-colors cursor-pointer ${
                                    selectedDocument === doc.id 
                                      ? 'bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700' 
                                      : 'bg-white dark:bg-black border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'
                                  } ${isDocumentListCollapsed ? 'p-2 flex justify-center' : 'p-3'}`}
                                  onClick={() => handleSelectDocument(doc.id)}
                                  title={isDocumentListCollapsed ? doc.name : undefined}
                                >
                                  {isDocumentListCollapsed ? (
                                    // Collapsed view - just show icon
                                    <FiFileText 
                                      size={20} 
                                      className={selectedDocument === doc.id 
                                        ? 'text-black dark:text-white' 
                                        : 'text-gray-500 dark:text-gray-400'
                                      } 
                                    />
                                  ) : (
                                    // Expanded view - show details
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-center space-x-2">
                                        <FiFileText className={`${
                                          selectedDocument === doc.id 
                                            ? 'text-black dark:text-white' 
                                            : 'text-gray-500 dark:text-gray-400'
                                        }`} />
                                        <div>
                                          <h4 className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate max-w-[120px]">{doc.name}</h4>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {Math.round(doc.size / 1024)} KB
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex space-x-1">
                                        <button 
                                          className="p-1 text-gray-700 hover:text-black dark:text-gray-300 dark:hover:text-white transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleUseDocumentInChat(doc.id);
                                          }}
                                          aria-label="Use in chat"
                                          title="Use in chat"
                                        >
                                          <FiMessageSquare size={14} />
                                        </button>
                                        <button 
                                          className="p-1 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
                                          onClick={(e) => initiateDocumentDelete(doc.id, e)}
                                          aria-label="Remove document"
                                          title="Remove document"
                                        >
                                          <FiTrash size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[calc(100%-44px)] p-4">
                            {!isDocumentListCollapsed && (
                              <>
                                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">No documents</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
                                  Upload a PDF document
                                </p>
                              </>
                            )}
                            <label className={`cursor-pointer ${
                              isDocumentListCollapsed 
                                ? 'p-2 text-gray-500 hover:text-black dark:hover:text-white'
                                : 'inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg font-medium text-sm transition-colors'
                            }`}>
                              <FiUpload className={isDocumentListCollapsed ? '' : 'mr-2'} size={isDocumentListCollapsed ? 20 : 16} />
                              {!isDocumentListCollapsed && 'Upload'}
                              <input 
                                type="file" 
                                accept=".pdf" 
                                className="hidden" 
                                onChange={handleFileUpload} 
                              />
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Document preview panel */}
                      {selectedDocument ? (
                        <div className="flex-1 flex flex-col h-full p-3">
                          {/* Document preview header */}
                          <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 truncate">
                              {currentDocument?.name}
                            </h2>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleUseDocumentInChat(selectedDocument)}
                                className="px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black rounded-md text-sm font-medium flex items-center"
                              >
                                <FiMessageSquare className="mr-1.5" size={14} />
                                Use in Chat
                              </button>
                            </div>
                          </div>
                          
                          {/* PDF Viewer */}
                          <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex flex-col">
                            {currentDocument?.url ? (
                              <>
                                {/* Toolbar */}
                                <div className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={previousPage}
                                      disabled={pageNumber <= 1}
                                      className={`p-1 rounded ${pageNumber <= 1 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                      aria-label="Previous page"
                                    >
                                      ←
                                    </button>
                                    <span className="text-sm">
                                      Page {pageNumber} of {numPages || '...'}
                                    </span>
                                    <button
                                      onClick={nextPage}
                                      disabled={numPages !== null && pageNumber >= numPages}
                                      className={`p-1 rounded ${numPages !== null && pageNumber >= numPages ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                      aria-label="Next page"
                                    >
                                      →
                                    </button>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={zoomOut}
                                      className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                      aria-label="Zoom out"
                                    >
                                      <FiZoomOut size={14} />
                                    </button>
                                    <span className="text-sm">{Math.round(scale * 100)}%</span>
                                    <button
                                      onClick={zoomIn}
                                      className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                      aria-label="Zoom in"
                                    >
                                      <FiZoomIn size={14} />
                                    </button>
                                    <a
                                      href={currentDocument.url}
                                      download
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-2 p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                      aria-label="Download PDF"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                    </a>
                                  </div>
                                </div>
                                <div className="flex-1 overflow-auto flex justify-center p-4">
                                  {/* PDF Document with initialization check */}
                                  {isPdfReady && currentDocument && currentDocument.url ? (
                                    <Document
                                      file={currentDocument.url}
                                      onLoadSuccess={onDocumentLoadSuccess}
                                      loading={
                                        <div className="flex items-center justify-center h-full">
                                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700"></div>
                                        </div>
                                      }
                                      error={
                                        <div className="flex items-center justify-center h-full text-center">
                                          <div>
                                            <p className="text-red-500 mb-2">Failed to load PDF</p>
                                            <p className="text-sm text-gray-500 mb-4">Please try the options below</p>
                                            <div className="flex flex-col gap-2">
                                              <button 
                                                onClick={() => window.open(currentDocument.url, '_blank')}
                                                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm font-medium"
                                              >
                                                Open in browser
                                              </button>
                                              <a 
                                                href={currentDocument.url}
                                                download
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm font-medium text-center"
                                              >
                                                Download PDF
                                              </a>
                                            </div>
                                          </div>
                                        </div>
                                      }
                                    >
                                      <Page 
                                        pageNumber={pageNumber}
                                        scale={scale}
                                      />
                                    </Document>
                                  ) : (
                                    <div className="flex items-center justify-center h-full">
                                      <div className="text-center">
                                        {isPdfReady ? (
                                          <p className="text-gray-600 dark:text-gray-400">
                                            {currentDocument ? 'PDF source not available' : 'Select a document to view'}
                                          </p>
                                        ) : (
                                          <>
                                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-700 mb-3 mx-auto"></div>
                                            <p className="text-gray-600 dark:text-gray-400">Loading PDF viewer...</p>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <p className="text-gray-500 dark:text-gray-400">PDF source not available</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center">
                            <FiFileText size={48} className="mx-auto mb-4 text-gray-400" />
                            <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Select a document to preview</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Click on a document from the list to view it
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Empty state when no documents and not uploading */}
                  {!documentError && !isUploadingDocument && documents.length === 0 && !isDocumentListCollapsed && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">No documents yet</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Upload a PDF document to chat with your documents
                      </p>
                      <label className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg font-medium text-sm cursor-pointer transition-colors">
                        <FiUpload className="mr-2" size={16} />
                        Upload a Document
                        <input 
                          type="file" 
                          accept=".pdf" 
                          className="hidden" 
                          onChange={handleFileUpload} 
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Document Panel Resizer */}
            <Resizer onResize={handleDocumentPanelResize} className="group" />
          </>
        )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Chat Header */}
        <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center">
            <div className="flex items-center space-x-2 max-w-md">
              {isEditingTitle && currentConversation ? (
                <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1">
                  <input
                    type="text"
                    className="text-md bg-transparent border-none focus:outline-none focus:ring-0 w-48"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleSaveTitleEdit}
                    onKeyDown={handleTitleKeyDown}
                    autoFocus
                  />
                  <button 
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ml-1" 
                    onClick={handleSaveTitleEdit}
                    aria-label="Save title"
                  >
                    <FiCheck size={14} />
                  </button>
                  <button 
                    className="text-gray-500 hover:text-red-500 dark:hover:text-red-400 ml-1" 
                    onClick={handleCancelTitleEdit}
                    aria-label="Cancel"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <h1 
                    className={`text-xl font-semibold truncate ${currentConversation ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors' : ''}`}
                    title={currentConversation?.title || 'New Chat'}
                    onClick={currentConversation ? handleStartTitleEdit : undefined}
                  >
                    {currentConversation?.title || 'New Chat'}
          </h1>
                  
                  <div className="flex items-center space-x-1">
                    {currentConversation && (
                      <button 
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        onClick={handleStartTitleEdit}
                        aria-label="Edit title"
                        title="Edit title"
                      >
                        <FiEdit2 size={14} />
                      </button>
                    )}
                    
                    <button 
                      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={handleCreateConversation}
                      aria-label="New conversation"
                      title="New conversation"
                    >
                      <FiPlus size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
            
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
          <ChatInput 
            onSendMessage={handleSendMessage} 
            disabled={isLoading} 
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            inputRef={inputRef}
          />
        </div>
      </div>

      {/* Settings */}
      <Settings 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  );
};

export default Chat; 