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
import documentService, { Document as DocumentType } from '../services/documentService';
import { API_URL } from '../services/api';
import Markdown from '../components/Markdown';

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
  const [documents, setDocuments] = useState<DocumentType[]>([]);
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

  // Add a new state for tracking document loading
  const [isDocumentLoading, setIsDocumentLoading] = useState<boolean>(false);

  // Add a state to track if we should use the fallback renderer
  const [useBrowserFallback, setUseBrowserFallback] = useState(true);

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

  const fetchDocuments = async () => {
    try {
      const docs = await documentService.fetchDocuments();
      setDocuments(docs);
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
    
    // We now send the original message with document references in [filename] format
    // The backend will handle extracting and processing the document references
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Send message to backend with original formatting (brackets preserved)
      const response = await axios.post(`${API_URL}/chat`, {
        message: content, // Use the original content with brackets
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
    
    setIsUploadingDocument(true);
    setDocumentError(null);
    
    try {
      // Use the document service to upload
      const newDocument = await documentService.uploadDocument(
        file, 
        activeConversation
      );
      
      setDocuments(prev => [newDocument, ...prev]);
      
    } catch (error: any) {
      console.error('Error uploading document:', error);
      setDocumentError(error.message || 'Failed to upload document. Please try again.');
    } finally {
      setIsUploadingDocument(false);
      // Reset the file input
      e.target.value = '';
    }
  };

  const handleRemoveDocument = async (id: string) => {
    try {
      await documentService.deleteDocument(id);
      
      // Remove the document from state
      setDocuments(prev => prev.filter(doc => doc.id.toString() !== id));
      
      // If this was the selected document, clear the selection
      if (selectedDocument === id) {
        setSelectedDocument(null);
      }
      
      // Close confirmation dialog
      setShowDeleteConfirm(false);
      setDocumentToDelete(null);
      
    } catch (error: any) {
      console.error('Error removing document:', error);
      setDocumentError(error.message || 'Failed to remove document. Please try again.');
      
      // Close confirmation dialog even on error
      setShowDeleteConfirm(false);
      setDocumentToDelete(null);
    }
  };

  // Function to handle document selection with collapsing effect
  const handleSelectDocument = async (id: string | number) => {
    const idString = id.toString();
    
    if (selectedDocument === idString) {
      // If clicking the same document, just toggle collapsed state
      setIsDocumentListCollapsed(!isDocumentListCollapsed);
    } else {
      // If selecting a different document, select it and ensure list is collapsed
      try {
        // Set loading state first
        setIsDocumentLoading(true);
        setSelectedDocument(idString);
        setIsDocumentListCollapsed(true);
        setPageNumber(1);
        setNumPages(null);
        
        // Get the document from our documents array
        const document = documents.find(doc => doc.id.toString() === idString);
        
        if (document) {
          console.log(`Loading document ${idString} using direct download`);
          
          // Use direct download method to ensure proper authentication and loading
          const blobUrl = await documentService.directDownloadDocument(idString);
          
          // Create an updated document object with the new blob URL
          const updatedDoc = {
            ...document,
            url: blobUrl
          };
          
          // Update the document in our state
          setDocuments(prev => 
            prev.map(doc => doc.id.toString() === idString ? updatedDoc : doc)
          );
        }
        
        // Clear loading state after a short delay to allow PDF to render
        setTimeout(() => {
          setIsDocumentLoading(false);
          setDocumentError(null);
        }, 300);
        
      } catch (error: any) {
        console.error('Failed to load document:', error);
        setDocumentError(error.message || 'Failed to load document. Please try again.');
        setIsDocumentLoading(false);
      }
    }
  };

  // Function to toggle document list collapsed state
  const toggleDocumentList = () => {
    setIsDocumentListCollapsed(!isDocumentListCollapsed);
  };
  
  // Get the currently selected document
  const currentDocument = documents.find(doc => doc.id.toString() === selectedDocument);

  const handleUseDocumentInChat = (id: string | number) => {
    // Get the document from state
    const document = documents.find(doc => doc.id.toString() === id.toString());
    if (!document) return;
    
    // Append document reference to the current message
    setCurrentMessage(prev => 
      `${prev ? prev + '\n\n' : ''}[${document.name}]`
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

  // Function to parse message for document references in [filename] format
  const parseMessageForDocuments = (message: string): string => {
    // Regular expression to match [filename] pattern
    const regex = /\[(.*?)\]/g;
    
    let match;
    let processedMessage = message;
    
    // Find all matches in the message
    while ((match = regex.exec(message)) !== null) {
      const documentName = match[1].trim();
      // Find a document with this name or that includes this text
      const matchedDocument = documents.find(doc => 
        doc.name.toLowerCase() === documentName.toLowerCase() || 
        doc.name.toLowerCase().includes(documentName.toLowerCase())
      );
      
      if (matchedDocument) {
        // If found, replace the original reference with our standard format
        processedMessage = processedMessage.replace(
          match[0], 
          `Using document: ${matchedDocument.name}`
        );
      }
    }
    
    return processedMessage;
  };

  const initiateDocumentDelete = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocumentToDelete(id.toString());
    setShowDeleteConfirm(true);
  };
  
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDocumentToDelete(null);
  };

  // Add a debug function to inspect PDF loading issues
  const debugPdfLoading = (url: string) => {
    console.log('Attempting to debug PDF loading issues');
    console.log(`PDF URL: ${url}`);
    
    // Check if URL is a blob URL
    if (url.startsWith('blob:')) {
      console.log('URL is a blob URL - this is good for PDF.js');
      
      // Try to fetch the blob to verify it works
      fetch(url)
        .then(response => {
          console.log(`Debug fetch status: ${response.status}`);
          return response.blob();
        })
        .then(blob => {
          console.log(`Debug blob size: ${blob.size} bytes`);
          console.log(`Debug blob type: ${blob.type}`);
          
          // Create a temporary download link for diagnostic purposes
          const link = document.createElement('a');
          link.href = url;
          link.download = 'debug-document.pdf';
          link.style.display = 'none';
          document.body.appendChild(link);
          console.log('Created debug download link - check if file can be downloaded directly');
        })
        .catch(err => {
          console.error('Error in debug fetch:', err);
        });
    } else {
      console.warn('URL is not a blob URL - this might cause CORS issues with PDF.js');
    }
  };

  // PDF viewer handlers with improved error handling
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log(`PDF loaded successfully with ${numPages} pages`);
    setNumPages(numPages);
    setPageNumber(1);
    
    // Clear any error messages
    setDocumentError(null);
  };

  const onDocumentLoadError = (error: any) => {
    console.error('Error loading PDF document:', error);
    const errorMessage = error.message || (typeof error === 'string' ? error : 'Unknown error');
    setDocumentError(`Failed to load PDF: ${errorMessage}`);
    
    // Always use browser fallback
    setUseBrowserFallback(true);

    return (
      <div className="flex items-center justify-center h-full text-center p-5">
        <div className="text-red-500">Failed to load PDF. Please try again.</div>
      </div>
    );
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

  // Function to retry loading a document
  const retryLoadDocument = async (documentId: string | number) => {
    if (!documentId) return;
    
    const idString = documentId.toString();
    setDocumentError('Loading document...');
    setIsDocumentLoading(true);
    
    try {
      console.log(`Retrying document download for ID: ${idString}`);
      
      // Get the document from our documents array
      const document = documents.find(doc => doc.id.toString() === idString);
      
      if (!document) {
        throw new Error('Document not found in state');
      }
      
      // Use our direct download function that properly handles authentication
      const blobUrl = await documentService.directDownloadDocument(idString);
      
      // Create an updated document with the new blob URL
      const updatedDoc = {
        ...document,
        url: blobUrl
      };
      
      // Update document in state
      setDocuments(prev => 
        prev.map(doc => doc.id.toString() === idString ? updatedDoc : doc)
      );
      
      // Clear any error message after a delay
      setTimeout(() => {
        setDocumentError(null);
        setIsDocumentLoading(false);
      }, 300);
      
      console.log('Document successfully reloaded with direct method');
    } catch (error: any) {
      console.error('Failed to download document:', error);
      setDocumentError(error.message || 'Failed to download document. Please try again.');
      setIsDocumentLoading(false);
    }
  };

  // Fallback PDF renderer component
  const FallbackPDFRenderer = ({ url }: { url: string }) => {
    return (
      <div className="flex flex-col h-full w-full">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 text-sm text-yellow-700 dark:text-yellow-400 text-center mb-2 rounded">
          Using fallback PDF renderer. Some features may be limited.
        </div>
        <div className="flex-1 relative">
          <iframe 
            src={url} 
            className="absolute inset-0 w-full h-full border-0 rounded"
            title="PDF Viewer"
          />
        </div>
      </div>
    );
  };

  // Add useEffect to clear PDF worker cache on load
  useEffect(() => {
    // Force cache clearing by adding this meta tag
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Cache-Control';
    meta.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(meta);
    
    // Clear any existing cached PDF workers from memory
    if (window.caches) {
      // Try to clear cache storage if available
      window.caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          if (cacheName.includes('pdf') || cacheName.includes('worker')) {
            console.log(`Clearing cache: ${cacheName}`);
            window.caches.delete(cacheName);
          }
        });
      }).catch(err => console.error('Failed to clear caches:', err));
    }
    
    return () => {
      // Remove the meta tag on cleanup
      document.head.removeChild(meta);
    };
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
                    <div className="flex flex-1 h-full max-w-full">
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
                        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
                          {/* Document preview header with fixed height */}
                          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                            <div className="flex items-center w-full">
                              <div className="flex-1 min-w-0 mr-3 overflow-hidden relative">
                                <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 truncate pr-6">
                                  {currentDocument?.name}
                                </h2>
                                {/* Gradient fade effect */}
                                <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-r from-transparent to-white dark:to-black"></div>
                              </div>
                              <div className="flex-shrink-0">
                                <button
                                  onClick={() => handleUseDocumentInChat(selectedDocument)}
                                  className="px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black rounded-md text-sm font-medium flex items-center justify-center w-28"
                                >
                                  <FiMessageSquare className="mr-1.5 flex-shrink-0" size={14} />
                                  <span className="whitespace-nowrap">Use in Chat</span>
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {/* PDF Viewer - takes remaining height */}
                          <div className="flex-1 overflow-auto flex justify-center relative p-4">
                            {/* Skeleton loading overlay */}
                            {isDocumentLoading && (
                              <div className="absolute inset-0 bg-gray-100 dark:bg-gray-900 z-10 overflow-hidden">
                                <div className="animate-pulse flex flex-col items-center pt-10">
                                  {/* Header skeleton */}
                                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 max-w-md mb-3"></div>
                                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2 max-w-sm mb-8"></div>
                                  
                                  {/* Page content skeleton */}
                                  <div className="bg-white dark:bg-gray-800 rounded shadow-sm h-[60vh] max-h-[800px] w-[calc(0.7*60vh)] max-w-md relative overflow-hidden">
                                    {/* Header */}
                                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-t w-full"></div>
                                    
                                    {/* Content lines */}
                                    <div className="p-4 space-y-3">
                                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/6"></div>
                                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/6"></div>
                                      
                                      {/* Shimmer effect overlay */}
                                      <div className="absolute inset-0 w-full h-full">
                                        <div className="shimmer-effect"></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Show error message if there was an error loading the PDF */}
                            {documentError && !isDocumentLoading && (
                              <div className="flex items-center justify-center h-full text-center">
                                <div>
                                  <div className="text-red-500 mb-2 font-medium">Failed to load PDF</div>
                                  <p className="text-sm text-gray-500 mb-4">{documentError}</p>
                                  <div className="flex flex-col gap-2">
                                    <button 
                                      onClick={() => {
                                        if (currentDocument) {
                                          debugPdfLoading(currentDocument.url);
                                          retryLoadDocument(currentDocument.id);
                                        }
                                      }}
                                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium mb-2"
                                    >
                                      Retry loading
                                    </button>
                                    <button 
                                      onClick={() => currentDocument && window.open(currentDocument.url, '_blank')}
                                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm font-medium"
                                    >
                                      Open in browser
                                    </button>
                                    <a 
                                      href={currentDocument?.url || '#'}
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
                            )}
                            
                            {/* PDF Viewer */}
                            {!isDocumentLoading && !documentError && currentDocument?.url && (
                              <div className="w-full h-full flex flex-col">
                                <div className="flex-1 relative">
                                  <iframe 
                                    src={currentDocument.url}
                                    className="absolute inset-0 w-full h-full border-0 rounded bg-white"
                                    title="PDF Viewer"
                                  />
                                </div>
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
            documents={documents}
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