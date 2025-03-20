import axios from 'axios';

// Determine API URL based on environment
const getApiUrl = () => {
  // In production or environments with a defined API URL, use that
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // In development, use the current origin if it's not localhost:3000 (React dev server)
  const origin = window.location.origin;
  if (!origin.includes('localhost:3000')) {
    return `${origin}/api`;
  }
  
  // Default to localhost:8000 for local development
  return 'http://localhost:8000/api';
};

// Base URL for API
export const API_URL = getApiUrl();

// Maximum number of retries for network/timeout errors
const MAX_RETRIES = 2;

// Setup axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 15000, // Increased timeout for better reliability
  headers: {
    'Content-Type': 'application/json',
  }
});

// Retry mechanism for failed requests
const retryRequest = async (
  config: any, 
  error: any, 
  retryCount = 0
) => {
  // Don't retry if we've hit the max retry count or if this was a 4xx/5xx error (not a network error)
  if (retryCount >= MAX_RETRIES || error.response) {
    return Promise.reject(error);
  }
  
  // Wait some time before retrying (exponential backoff)
  const delay = Math.pow(2, retryCount) * 1000;
  console.log(`Retrying request to ${config.url} after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Create a new request with the same config but increment the retry count
  const newConfig = {
    ...config,
    _retryCount: retryCount + 1, 
  };
  
  return api(newConfig);
};

// Add a request interceptor to inject the auth token for all requests
api.interceptors.request.use(
  (config) => {
    try {
      // Get token from localStorage - must match the key in AuthContext
      const storedToken = localStorage.getItem('auth_token');
      
      if (storedToken) {
        // Parse JSON string to get the actual token
        const token = JSON.parse(storedToken);
        if (token) {
          // Add token to request headers
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      
      // If localStorage fails, fallback to cookies
      if (!config.headers.Authorization) {
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
            const token = JSON.parse(decodeURIComponent(cookieToken));
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          } catch (e) {
            console.error('Error parsing cookie token:', e);
          }
        }
      }
      
      // Special handling for document-related requests - add cache busting for PDFs
      if (config.url?.includes('/documents/') && config.method === 'get') {
        // Add timestamp to prevent caching issues with PDFs
        const separator = config.url.includes('?') ? '&' : '?';
        config.url = `${config.url}${separator}t=${Date.now()}`;
        
        // Increase timeout for document downloads
        config.timeout = 30000;
      }
    } catch (error) {
      console.error('Error setting auth token in request:', error);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors consistently
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config } = error;
    
    // If this wasn't due to a timeout or a network error, or we already retried, just reject
    if ((error.code !== 'ECONNABORTED' && error.response) || config._retry) {
      // Log other errors
      if (error.response) {
        console.error('API error response:', error.response.status, error.response.data);
      }
      return Promise.reject(error);
    }
    
    // For timeouts and network errors, attempt retry
    const retryCount = config._retryCount || 0;
    
    // Special handling for document downloads to allow more retries
    if (config.url?.includes('/documents/') && config.method === 'get') {
      // Even if we've hit the max retries, try once more for documents with a longer timeout
      if (retryCount === MAX_RETRIES) {
        console.log('Final document download attempt with extended timeout');
        const newConfig = {
          ...config,
          timeout: 45000, // Extended timeout for final document retry
          _retry: true, // Mark as retried to avoid infinite loops
        };
        return api(newConfig);
      }
    }
    
    // Attempt to retry the request
    return retryRequest(config, error, retryCount);
  }
);

// API methods
const apiService = {
  // Auth
  register: (username: string, email: string | null, password: string) => 
    api.post('/auth/register', { username, email, password }),
  
  login: (username: string, password: string) => 
    api.post('/auth/login', { username, password }),
  
  getUserProfile: () => 
    api.get('/users/me'),
  
  refreshToken: () =>
    api.post('/auth/refresh', {}),
  
  updateApiKey: (openai_api_key: string) => 
    api.post('/users/me/api-key', { openai_api_key }),
  
  // Conversations
  getConversations: () => 
    api.get('/conversations'),
  
  getConversation: (id: number) => 
    api.get(`/conversations/${id}`),
  
  createConversation: (title: string = 'New Conversation') => 
    api.post('/conversations', { title }),
  
  updateConversation: (id: number, title: string) => 
    api.put(`/conversations/${id}`, { title }),
  
  deleteConversation: (id: number) => 
    api.delete(`/conversations/${id}`),
  
  // Chat
  sendMessage: (message: string, conversation_id: number | null = null) => 
    api.post('/chat', { message, conversation_id }),
    
  // Documents (with enhanced error handling)  
  getDocuments: () => 
    api.get('/documents'),
    
  getDocument: (id: number) => 
    api.get(`/documents/${id}`),
    
  downloadDocument: (id: number) => 
    api.get(`/documents/${id}/download`, { 
      responseType: 'blob',
      timeout: 30000 // Longer timeout for downloads
    }),
    
  deleteDocument: (id: number) => 
    api.delete(`/documents/${id}`),
};

export default apiService; 