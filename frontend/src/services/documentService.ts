import api, { API_URL } from './api';
import axios from 'axios';

// Types
export interface Document {
  id: number | string;
  name: string;
  size: number;
  uploadDate: Date;
  url: string;
}

// Cache for document data to reduce redundant API calls
const documentCache: Record<string, Document[]> = {
  all: [],
};

// Track pending requests to avoid duplicate fetches
let pendingFetchAll: Promise<Document[]> | null = null;
const pendingFetchSingle: Record<string, Promise<Document>> = {};

/**
 * Format document URL to ensure it's accessible from the client
 */
export const getDocumentUrl = (url?: string): string => {
  if (!url) return '';
  
  // If the URL is already absolute, return it as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Get the base URL from the window location to handle any environment
  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  
  // If it's a relative API path, ensure it has the full base URL
  if (url.startsWith('/api/')) {
    return `${baseUrl}${url}`;
  }
  
  // Otherwise, prefix it with the API URL
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

/**
 * Fetch all documents with error handling and caching
 */
export const fetchDocuments = async (bypassCache = false): Promise<Document[]> => {
  // If we already have a request in progress, return its promise
  if (pendingFetchAll) {
    return pendingFetchAll;
  }
  
  // If we have cached data and aren't bypassing the cache, return it
  if (!bypassCache && documentCache.all.length > 0) {
    return documentCache.all;
  }
  
  // Otherwise, make a new request
  pendingFetchAll = (async () => {
    try {
      const response = await api.getDocuments();
      
      // Format the documents
      const formattedDocs = response.data.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        size: doc.size,
        uploadDate: new Date(doc.created_at),
        url: getDocumentUrl(doc.url),
      }));
      
      // Update the cache
      documentCache.all = formattedDocs;
      
      return formattedDocs;
    } catch (error) {
      console.error('Error fetching documents:', error);
      // If we have cached data, return it even though the fetch failed
      if (documentCache.all.length > 0) {
        return documentCache.all;
      }
      throw error;
    } finally {
      // Clear the pending request
      pendingFetchAll = null;
    }
  })();
  
  return pendingFetchAll;
};

/**
 * Add a document to the cache
 */
export const addDocumentToCache = (document: Document): void => {
  // Add to the all documents cache
  documentCache.all = [document, ...documentCache.all];
};

/**
 * Remove a document from the cache
 */
export const removeDocumentFromCache = (id: number | string): void => {
  // Remove from the all documents cache
  documentCache.all = documentCache.all.filter(doc => doc.id !== id);
};

/**
 * Upload a document with robust error handling
 */
export const uploadDocument = async (
  file: File, 
  conversationId?: number | null
): Promise<Document> => {
  // Check file type and size
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are supported');
  }
  
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File size should not exceed 10MB');
  }
  
  // Create form data
  const formData = new FormData();
  formData.append('file', file);
  
  if (conversationId) {
    formData.append('conversation_id', conversationId.toString());
  }
  
  try {
    // Upload the document
    const response = await axios.post(`${API_URL}/documents/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    // Format the document
    const newDocument: Document = {
      id: response.data.id,
      name: file.name,
      size: file.size,
      uploadDate: new Date(response.data.created_at),
      url: getDocumentUrl(response.data.url),
    };
    
    // Add to cache
    addDocumentToCache(newDocument);
    
    return newDocument;
  } catch (error: any) {
    console.error('Error uploading document:', error);
    
    // Provide more helpful error messages
    if (error.response?.status === 413) {
      throw new Error('File size exceeds the server limit');
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Authentication error. Please log in again.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Upload timed out. Please try again with a smaller file.');
    }
    
    throw error;
  }
};

/**
 * Delete a document with error handling
 */
export const deleteDocument = async (id: number | string): Promise<void> => {
  try {
    await api.deleteDocument(Number(id));
    
    // Remove from cache
    removeDocumentFromCache(id);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

/**
 * Validate that a document can be accessed
 * This is useful for checking if a document URL is valid before displaying it
 */
export const validateDocumentAccess = async (id: number | string): Promise<boolean> => {
  try {
    // Try to request just the document headers
    await fetch(getDocumentUrl(`/api/documents/${id}/download`), {
      method: 'HEAD',
      credentials: 'include',
    });
    
    return true;
  } catch (error) {
    console.error('Error validating document access:', error);
    return false;
  }
};

/**
 * Direct download a document and convert to a blob URL
 * This bypasses potential issues with the react-pdf component 
 * and ensures proper authentication handling
 */
export const directDownloadDocument = async (id: number | string): Promise<string> => {
  console.log(`Starting direct download for document ${id}`);
  
  try {
    // Get authentication token from localStorage or cookies
    let token = null;
    try {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        token = JSON.parse(storedToken);
      }
    } catch (e) {
      console.error('Error getting token:', e);
    }
    
    // If we don't have a token in localStorage, try cookies
    if (!token) {
      const getCookie = (name: string): string | null => {
        const nameEQ = `${name}=`;
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          let cookie = cookies[i].trim();
          if (cookie.indexOf(nameEQ) === 0) {
            return cookie.substring(nameEQ.length, cookie.length);
          }
        }
        return null;
      };
      
      const cookieToken = getCookie('auth_token');
      if (cookieToken) {
        try {
          token = JSON.parse(decodeURIComponent(cookieToken));
        } catch (e) {
          console.error('Error parsing cookie token:', e);
        }
      }
    }

    // Create a unique timestamp for cache busting
    const timestamp = Date.now();
    const downloadUrl = `${API_URL}/documents/${id}/download?t=${timestamp}`;
    
    console.log(`Fetching PDF from: ${downloadUrl}`);
    
    // Use fetch API with proper credentials and headers
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: token ? {
        'Authorization': `Bearer ${token}`
      } : {},
      credentials: 'include', // Include cookies
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.status} ${response.statusText}`);
    }
    
    // Log response details
    console.log(`Response status: ${response.status}`);
    console.log(`Response type: ${response.type}`);
    console.log(`Content-Type: ${response.headers.get('Content-Type')}`);
    console.log(`Content-Length: ${response.headers.get('Content-Length')}`);
    
    // Get the blob from the response
    const blob = await response.blob();
    
    // Log blob details
    console.log(`Blob size: ${blob.size} bytes`);
    console.log(`Blob type: ${blob.type}`);
    
    // Quick validation check for the blob
    if (blob.size === 0) {
      console.error('Received empty blob from server');
      throw new Error('Document appears to be empty');
    }
    
    if (!blob.type.includes('pdf') && !blob.type.includes('application/octet-stream')) {
      console.warn(`Unexpected blob MIME type: ${blob.type}. Expected PDF content.`);
    }
    
    // Create a blob URL that can be used by the PDF viewer
    const blobUrl = URL.createObjectURL(blob);
    console.log(`Created blob URL: ${blobUrl}`);
    
    return blobUrl;
  } catch (error: any) {
    console.error('Error in direct document download:', error);
    throw new Error(`Failed to download document: ${error.message}`);
  }
};

export default {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentUrl,
  validateDocumentAccess,
  addDocumentToCache,
  removeDocumentFromCache,
  directDownloadDocument,
}; 