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
  login: (username: string, password: string) => Promise<{ success: boolean; partialSuccess: boolean; message: string; } | void>;
  register: (username: string, email: string | null, password: string) => Promise<{ success: boolean; partialSuccess: boolean; message: string; } | void>;
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
  const initialLoadRef = useRef<boolean>(true); // Track initial load
  
  // Use our enhanced storage hook for token
  const [token, setToken, removeToken] = useStorage<string | null>(
    'auth_token',
    null,
    false, // Don't use sessionStorage
    true,  // Use cookies for better persistence
    TOKEN_EXPIRY_DAYS
  );

  // Utility function to clear all auth data
  const clearAllAuthData = useCallback(() => {
    // Clear the auth token using our hook
    removeToken();
    
    // Clear the user state
    setUser(null);
    
    // Clear Authorization header
    delete axios.defaults.headers.common['Authorization'];
    
    // Clear all cookies (belt and suspenders approach)
    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    // Also try to clear localStorage directly
    try {
      localStorage.removeItem('auth_token');
    } catch (e) {
      console.error('Error clearing local storage:', e);
    }
    
    console.log('All auth data cleared');
  }, [removeToken]);

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
            // If refresh failed, use our dedicated function to clean up properly
            console.log('Token refresh failed - clearing authentication state');
            clearAllAuthData();
            
            // Return a properly formed error that includes information about auth being cleared
            return Promise.reject({
              ...error,
              authCleared: true, // Flag to indicate auth was cleared
              response: { 
                data: { detail: 'Authentication failed. Please log in again.' }
              }
            });
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
  }, [token, refreshToken, clearAllAuthData]);

  // Function to set the auth token and update axios headers
  const setAuthToken = useCallback((newToken: string | null) => {
    return new Promise<void>((resolve) => {
      if (newToken) {
        // Save token to storage and state
        setToken(newToken);
        // Set default auth header for all future requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        // Small delay to ensure the token is properly saved before continuing
        setTimeout(() => {
          resolve();
        }, 300); // 300ms delay should be enough for state updates and storage operations
      } else {
        // Remove token
        removeToken();
        delete axios.defaults.headers.common['Authorization'];
        resolve(); // Resolve immediately for token removal
      }
    });
  }, [setToken, removeToken]);

  // Updated fetchUserProfile to accept an optional signal parameter
  const fetchUserProfile = useCallback(async (signal?: AbortSignal) => {
    if (!token || fetchingUserRef.current) return null;
    
    fetchingUserRef.current = true;
    
    try {
      // Use provided signal or create a new controller
      const controller = signal ? null : new AbortController();
      const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;
      
      const response = await axios.get(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }, 
        signal: signal || (controller ? controller.signal : undefined)
      });
      
      if (timeoutId) clearTimeout(timeoutId);
      fetchingUserRef.current = false;
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch user profile:', error);
      fetchingUserRef.current = false;
      
      // Properly propagate the error instead of returning null
      // This allows the caller to distinguish between different error types
      throw error;
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
          // Validate token locally first
          try {
            const decodedToken = jwt_decode<JwtPayload>(token);
            const currentTime = Date.now() / 1000;
            
            if (decodedToken.exp < currentTime) {
              console.log('Token expired, removing');
              clearAllAuthData();
              setIsLoading(false);
              setIsCheckingAuth(false);
              return;
            }
          } catch (e) {
            console.error('Invalid token format', e);
            clearAllAuthData();
            setIsLoading(false);
            setIsCheckingAuth(false);
            return;
          }
          
          // Set auth header for subsequent requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Only fetch profile if we don't already have user data
          if (!user) {
            console.log('Fetching user profile');
            
            try {
              const userData = await fetchUserProfile();
                
              if (userData) {
                console.log('User profile fetched successfully', userData);
                setUser(userData);
              } else {
                console.log('No user data returned, logging out');
                clearAllAuthData();
              }
            } catch (profileError: any) {
              console.error('Profile fetch error:', profileError);
              
              // If we get a 401, it means the token is invalid/not in the DB
              if (profileError.response?.status === 401) {
                console.log('Token invalid/not recognized by server, clearing auth state');
                clearAllAuthData();
              } else {
                // For other errors, still clear auth to be safe
                console.log('Error fetching profile, clearing auth state to be safe');
                clearAllAuthData();
              }
            }
          } else {
            console.log('Using existing user data, no need to fetch profile');
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          clearAllAuthData();
        }
      } else {
        // No token, make sure user is null
        console.log('No token found, clearing user');
        setUser(null);
      }
      
      setIsLoading(false);
      setIsCheckingAuth(false);
    };

    // Clear any stale tokens on startup if they appear invalid
    const clearStaleTokenOnStartup = async () => {
      // Only run this once when the component mounts
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        console.log('Initial load - checking for stale tokens');
        
        // Force-clear all auth data on first load to ensure clean startup
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          const storageItem = localStorage.getItem('auth_token');
          if (storageItem) {
            try {
              // Try to parse and validate the token
              const storedToken = JSON.parse(storageItem);
              if (typeof storedToken === 'string') {
                try {
                  // Validate token format and expiry
                  const decodedToken = jwt_decode<JwtPayload>(storedToken);
                  const currentTime = Date.now() / 1000;
                  
                  if (decodedToken.exp < currentTime) {
                    // Expired token, clear it immediately
                    console.log('Expired token found on startup, clearing');
                    clearAllAuthData();
                  }
                } catch (e) {
                  // Invalid token format, clear it immediately
                  console.log('Invalid token format found on startup, clearing');
                  clearAllAuthData();
                }
              } else {
                // Not a string token, clear it
                console.log('Invalid token type found on startup, clearing');
                clearAllAuthData();
              }
            } catch (e) {
              // JSON parse error, clear the invalid token
              console.log('Corrupted token found on startup, clearing');
              clearAllAuthData();
            }
          }
        }
      }
      
      // Proceed with normal auth check
      checkAuth();
    };

    // Run the clear stale token function instead of checkAuth directly
    clearStaleTokenOnStartup();
  }, [token, clearAllAuthData, fetchUserProfile, user]);

  // Login function
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    let tokenSet = false;
    
    try {
      // Increase timeout for login requests, since these might take longer
      const loginController = new AbortController();
      const loginTimeoutId = setTimeout(() => loginController.abort(), 20000); // 20 second timeout for login
      
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
            signal: loginController.signal,
            timeout: 15000 // Explicitly set longer timeout for login requests
          });
        } catch (err: any) {
          console.error(`Login attempt ${attempts} error:`, err);
          
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
      
      // Clear the login request timeout as it succeeded
      clearTimeout(loginTimeoutId);
      
      const { access_token } = loginResponse.data;
      console.log('Login successful, received token');
      
      // Save token and wait for it to be properly set
      await setAuthToken(access_token);
      tokenSet = true; // Mark that we've successfully set the token
      console.log('Token set successfully, now fetching user profile');
      
      // Add a small delay to ensure token propagation to the backend
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get user profile with retry logic - using a SEPARATE controller
      try {
        console.log('Fetching user profile after login');
        const profileController = new AbortController();
        const profileTimeoutId = setTimeout(() => profileController.abort(), 10000);
        
        try {
          const userData = await fetchUserProfile(profileController.signal);
          // Clear the profile timeout as it succeeded
          clearTimeout(profileTimeoutId);
          
          if (userData) {
            console.log('User profile fetched successfully');
            setUser(userData);
          } else {
            console.error('No user data returned after login');
            throw new Error('Failed to fetch user profile after login');
          }
        } catch (profileError) {
          // Clear the profile timeout in case of error
          clearTimeout(profileTimeoutId);
          console.error('Error fetching profile after login:', profileError);
          
          // Try one more time after a delay with a new controller
          console.log('Retrying profile fetch after a delay...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), 10000);
          
          try {
            const retryData = await fetchUserProfile(retryController.signal);
            clearTimeout(retryTimeoutId);
            
            if (retryData) {
              console.log('User profile fetched successfully on retry');
              setUser(retryData);
            } else {
              throw new Error('Failed to fetch user profile after login, even with retry');
            }
          } catch (retryError) {
            clearTimeout(retryTimeoutId);
            throw retryError;
          }
        }
      } catch (profileError: any) {
        console.error('Profile fetch failed after login:', profileError);
        
        // Special handling for profile fetch errors
        // For timeouts or network errors, consider login partially successful
        if (profileError.code === 'ERR_CANCELED' || profileError.code === 'ECONNABORTED' || 
            profileError.code === 'ERR_NETWORK' || !profileError.response) {
          console.warn('Profile fetch timed out or network error, but login successful - continuing with token only');
          
          // Set minimal user data to trigger isAuthenticated
          setUser({ 
            id: 0, 
            username: username, 
            email: null, 
            is_active: true, 
            has_openai_api_key: false 
          });
          
          // Don't throw error, but return custom object
          return {
            success: true,
            partialSuccess: true,
            message: 'Login successful, but profile could not be retrieved. Some features may be limited.'
          };
        } else if (profileError.response?.status === 401) {
          // Clear auth if we get a 401 trying to fetch the profile
          clearAllAuthData();
          const error: any = new Error('Authentication failed. Please try logging in again.');
          error.profileFetchFailed = true;
          error.tokenSet = tokenSet;
          throw error;
        } else {
          const error: any = new Error('Failed to load user profile. Some features may be limited.');
          error.profileFetchFailed = true;
          error.tokenSet = tokenSet;
          error.originalError = profileError;
          throw error;
        }
      }
      
      return { 
        success: true, 
        partialSuccess: false,
        message: 'Login successful'
      };
    } catch (error: any) {
      console.error('Login failed:', error);
      
      // Check for timeout or network errors
      if (error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED' || !error.response) {
        const timeoutError: any = new Error('Login request timed out. Please try again.');
        timeoutError.tokenSet = tokenSet;
        throw timeoutError;
      }
      
      // Add token status to the error
      error.tokenSet = tokenSet;
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (username: string, email: string | null, password: string) => {
    setIsLoading(true);
    let tokenSet = false;
    
    try {
      const registerController = new AbortController();
      const registerTimeoutId = setTimeout(() => registerController.abort(), 10000);
      
      console.log('Sending registration request');
      const response = await axios.post(`${API_URL}/auth/register`, { 
        username, 
        email, 
        password 
      }, {
        signal: registerController.signal
      });
      
      // Clear the registration request timeout as it succeeded
      clearTimeout(registerTimeoutId);
      
      const { access_token } = response.data;
      
      // Save token and wait for it to be properly set
      console.log('Registration successful, setting token');
      await setAuthToken(access_token);
      tokenSet = true; // Mark that we've successfully set the token
      console.log('Token set successfully, now fetching user profile');
      
      // Add a small delay to ensure token propagation to the backend
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get user profile with a SEPARATE controller
      try {
        console.log('Fetching user profile after registration');
        const profileController = new AbortController();
        const profileTimeoutId = setTimeout(() => profileController.abort(), 10000);
        
        try {
          const userData = await fetchUserProfile(profileController.signal);
          // Clear the profile timeout as it succeeded
          clearTimeout(profileTimeoutId);
          
          if (userData) {
            console.log('User profile fetched successfully after registration');
            setUser(userData);
          } else {
            console.error('No user data returned after registration');
            throw new Error('Failed to fetch user profile after registration');
          }
        } catch (profileError) {
          // Clear the profile timeout in case of error
          clearTimeout(profileTimeoutId);
          console.error('Error fetching profile after registration:', profileError);
          
          // Try one more time after a delay with a new controller
          console.log('Retrying profile fetch after a delay...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), 10000);
          
          try {
            const retryData = await fetchUserProfile(retryController.signal);
            clearTimeout(retryTimeoutId);
            
            if (retryData) {
              console.log('User profile fetched successfully on retry');
              setUser(retryData);
            } else {
              throw new Error('Failed to fetch user profile after registration, even with retry');
            }
          } catch (retryError) {
            clearTimeout(retryTimeoutId);
            throw retryError;
          }
        }
      } catch (profileError: any) {
        console.error('Profile fetch failed after registration:', profileError);
        
        // Special handling for profile fetch errors
        // For timeouts or network errors, consider registration partially successful
        if (profileError.code === 'ERR_CANCELED' || profileError.code === 'ECONNABORTED' || 
            profileError.code === 'ERR_NETWORK' || !profileError.response) {
          console.warn('Profile fetch timed out or network error, but registration successful - continuing with token only');
          
          // Set minimal user data to trigger isAuthenticated
          setUser({ 
            id: 0, 
            username: username, 
            email: email, 
            is_active: true, 
            has_openai_api_key: false 
          });
          
          // Don't throw error, but return custom object
          return {
            success: true,
            partialSuccess: true,
            message: 'Registration successful, but profile could not be retrieved. Some features may be limited.'
          };
        } else if (profileError.response?.status === 401) {
          // Clear auth if we get a 401 trying to fetch the profile
          clearAllAuthData();
          const error: any = new Error('Authentication failed after registration. Please try logging in again.');
          error.profileFetchFailed = true;
          error.tokenSet = tokenSet;
          throw error;
        } else {
          const error: any = new Error('Failed to load user profile after registration. Some features may be limited.');
          error.profileFetchFailed = true;
          error.tokenSet = tokenSet;
          error.originalError = profileError;
          throw error;
        }
      }
      
      return { 
        success: true, 
        partialSuccess: false,
        message: 'Registration successful'
      };
    } catch (error: any) {
      console.error('Registration failed:', error);
      
      // Check for timeout or network errors
      if (error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED' || !error.response) {
        const timeoutError: any = new Error('Registration request timed out. Please try again.');
        timeoutError.tokenSet = tokenSet;
        throw timeoutError;
      }
      
      // Add token status to the error
      error.tokenSet = tokenSet;
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
    // Use our utility function to clear all auth data
    clearAllAuthData();
  }, [clearAllAuthData]);

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