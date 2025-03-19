import axios from 'axios';

// Base URL for API
const API_URL = 'http://localhost:8000/api';

// Setup axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000, // Set timeout to match other axios calls
});

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
  (error) => {
    // Handle timeout or network errors
    if (error.code === 'ECONNABORTED' || !error.response) {
      console.error('API request timed out or network error:', error);
      return Promise.reject({
        ...error,
        response: { data: { detail: 'Request timed out or network error.' } }
      });
    }
    
    // Log other errors
    if (error.response) {
      console.error('API error response:', error.response.status, error.response.data);
    }
    
    return Promise.reject(error);
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
};

export default apiService; 