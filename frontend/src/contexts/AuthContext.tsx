import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useStorage } from '../hooks/useStorage';
import jwt_decode from 'jwt-decode';

// Types
interface User {
  id: number;
  username: string;
  email: string | null;
  is_active: boolean;
  has_openai_api_key: boolean;
}

interface JwtPayload {
  exp: number;
  sub: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string | null, password: string) => Promise<void>;
  logout: () => void;
  updateUserApiKey: (apiKey: string) => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL
const API_URL = 'http://localhost:8000/api';

// Cookie expiry (7 days to match backend token expiry)
const TOKEN_EXPIRY_DAYS = 7;

// Time before token expiry to trigger refresh (1 day in ms)
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Debounce time for auth operations to prevent rapid refreshes (500ms)
const DEBOUNCE_TIME = 500;

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false); // Add state to track auth check
  const refreshTimerRef = useRef<number | null>(null);
  const fetchingUserRef = useRef<boolean>(false);
  const lastAuthCheckRef = useRef<number>(0); // Track last auth check time
  
  // Use our enhanced storage hook for token
  const [token, setToken, removeToken] = useStorage<string | null>(
    'auth_token',
    null,
    false, // Don't use sessionStorage
    true,  // Use cookies for better persistence
    TOKEN_EXPIRY_DAYS
  );

  // Function to refresh token - optimized with timeout
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const { access_token } = response.data;
      setToken(access_token);
      
      // Update axios headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }, [token, setToken]);

  // Setup token refresh timer
  const setupRefreshTimer = useCallback(() => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    if (!token) return;
    
    try {
      // Decode token to get expiration
      const decodedToken = jwt_decode<JwtPayload>(token);
      const expiryTime = decodedToken.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      
      // Time until token expires
      const timeUntilExpiry = expiryTime - currentTime;
      
      // If token is already expired or will expire soon, refresh now
      if (timeUntilExpiry < REFRESH_THRESHOLD_MS) {
        refreshToken();
        return;
      }
      
      // Otherwise, set up a timer to refresh before expiration
      const refreshTime = timeUntilExpiry - REFRESH_THRESHOLD_MS;
      
      refreshTimerRef.current = window.setTimeout(() => {
        refreshToken();
      }, refreshTime);
    } catch (e) {
      console.error('Error setting up token refresh:', e);
    }
  }, [token, refreshToken]);

  // Setup axios interceptor for authentication
  useEffect(() => {
    // Default timeout for all requests
    axios.defaults.timeout = 10000;
    
    // Request interceptor to add the auth token to every request
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Handle timeout or network errors
        if (error.code === 'ECONNABORTED' || !error.response) {
          return Promise.reject({
            ...error,
            response: { data: { detail: 'Request timed out. Server may be overloaded.' } }
          });
        }
        
        const originalRequest = error.config;
        
        // If the error is due to an expired/invalid token and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          // Try to refresh the token
          const refreshSuccessful = await refreshToken();
          
          if (refreshSuccessful) {
            // Update the auth header with the new token
            originalRequest.headers.Authorization = `Bearer ${token}`;
            // Retry the original request
            return axios(originalRequest);
          } else {
            // If refresh failed, log the user out
            logout();
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      // Clean up interceptors when the component unmounts
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
      
      // Clear refresh timer
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [token, refreshToken]);

  // Function to set the auth token and update axios headers
  const setAuthToken = useCallback((newToken: string | null) => {
    if (newToken) {
      // Save token to storage and state
      setToken(newToken);
      // Set default auth header for all future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } else {
      // Remove token
      removeToken();
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [setToken, removeToken]);

  // Fetch user profile data with timeout
  const fetchUserProfile = useCallback(async () => {
    if (!token || fetchingUserRef.current) return null;
    
    fetchingUserRef.current = true;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await axios.get(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      fetchingUserRef.current = false;
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      fetchingUserRef.current = false;
      return null;
    }
  }, [token]);

  // Set up token refresh timer when token changes
  useEffect(() => {
    if (token) {
      setupRefreshTimer();
    }
  }, [token, setupRefreshTimer]);

  // Check auth status on load and token changes with debouncing
  useEffect(() => {
    const checkAuth = async () => {
      // Prevent multiple concurrent auth checks
      if (isCheckingAuth) return;
      
      // Debounce auth checks to prevent rapid refreshes
      const now = Date.now();
      if (now - lastAuthCheckRef.current < DEBOUNCE_TIME) {
        console.log('Debouncing auth check - too soon since last check');
        return;
      }
      
      lastAuthCheckRef.current = now;
      setIsCheckingAuth(true);
      setIsLoading(true);
      
      console.log('Checking auth status, token present:', !!token);
      
      if (token) {
        try {
          // Validate token locally
          try {
            const decodedToken = jwt_decode<JwtPayload>(token);
            const currentTime = Date.now() / 1000;
            
            if (decodedToken.exp < currentTime) {
              console.log('Token expired, removing');
              setAuthToken(null);
              setUser(null);
              setIsLoading(false);
              setIsCheckingAuth(false);
              return;
            }
          } catch (e) {
            console.error('Invalid token format', e);
            setAuthToken(null);
            setUser(null);
            setIsLoading(false);
            setIsCheckingAuth(false);
            return;
          }
          
          // Set auth header for subsequent requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Only fetch profile if we don't already have user data
          if (!user) {
            console.log('Fetching user profile');
            const userData = await fetchUserProfile();
              
            if (userData) {
              console.log('User profile fetched successfully', userData);
              setUser(userData);
            } else {
              console.log('Failed to fetch user profile, logging out');
              setAuthToken(null);
              setUser(null);
            }
          } else {
            console.log('Using existing user data, no need to fetch profile');
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          setAuthToken(null);
          setUser(null);
        }
      } else {
        // No token, make sure user is null
        console.log('No token found, clearing user');
        setUser(null);
      }
      
      setIsLoading(false);
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [token, setAuthToken, fetchUserProfile, user]);

  // Login function
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    
    try {
      // Increase timeout for login requests, since these might take longer
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout for login
      
      console.log('Sending login request');
      
      // Retry logic for login
      let attempts = 0;
      const maxAttempts = 2;
      let loginResponse = null;
      
      while (attempts < maxAttempts && !loginResponse) {
        try {
          attempts++;
          console.log(`Login attempt ${attempts}/${maxAttempts}`);
          
          loginResponse = await axios.post(`${API_URL}/auth/login`, { username, password }, {
            signal: controller.signal,
            timeout: 15000 // Explicitly set longer timeout for login requests
          });
        } catch (err: any) {
          // If it's the last attempt, throw the error
          if (attempts >= maxAttempts) {
            throw err;
          }
          
          // Otherwise, wait a bit and try again
          console.log(`Login attempt ${attempts} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!loginResponse) {
        throw new Error('All login attempts failed');
      }
      
      clearTimeout(timeoutId);
      const { access_token } = loginResponse.data;
      console.log('Login successful, received token');
      
      // Save token
      setAuthToken(access_token);
      
      // Get user profile
      console.log('Fetching user profile after login');
      const userData = await fetchUserProfile();
      if (userData) {
        console.log('User profile fetched successfully');
        setUser(userData);
      } else {
        console.error('Failed to fetch user profile after login');
        throw new Error('Failed to fetch user profile after login');
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      
      // Check for timeout or network errors
      if (error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED' || !error.response) {
        throw new Error('Login request timed out. Please try again.');
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (username: string, email: string | null, password: string) => {
    setIsLoading(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await axios.post(`${API_URL}/auth/register`, { 
        username, 
        email, 
        password 
      }, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const { access_token } = response.data;
      
      // Save token
      setAuthToken(access_token);
      
      // Get user profile
      const userData = await fetchUserProfile();
      if (userData) {
        setUser(userData);
      } else {
        throw new Error('Failed to fetch user profile after registration');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = useCallback(() => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    console.log('Logging out user');
    setAuthToken(null);
    setUser(null);
  }, [setAuthToken]);

  // Update API key
  const updateUserApiKey = async (apiKey: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await axios.post(`${API_URL}/users/me/api-key`, {
        openai_api_key: apiKey
      }, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setUser(response.data);
    } catch (error) {
      console.error('API key update failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user,
      isLoading,
      login, 
      register, 
      logout,
      updateUserApiKey,
      refreshToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 