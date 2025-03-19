import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginStartTime, setLoginStartTime] = useState<number | null>(null);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if this is a redirect from another page
  const redirectPath = location.state?.from?.pathname || '/';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      console.log('Already authenticated, redirecting to:', redirectPath);
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, redirectPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent repeated submissions
    if (isLoading) {
      return;
    }
    
    // Basic validation
    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }
    
    setError('');
    setIsLoading(true);
    setLoginStartTime(Date.now());
    
    try {
      console.log('Attempting login for user:', username);
      
      // Add a small delay before login to ensure UI state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await login(username, password);
      console.log('Login successful, navigating to:', redirectPath);
      
      // Add a small delay before navigating to avoid race conditions
      setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 300);
    } catch (err: any) {
      console.error('Login error:', err);
      let errorMessage = 'Login failed. Please check your credentials.';
      
      if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = err.response.data.detail;
        console.error('Server error response:', err.response.data);
      } else if (err.message && typeof err.message === 'string') {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setLoginStartTime(null);
    }
  };

  // Calculate how long the login has been in progress
  const loginTimeElapsed = loginStartTime ? Math.floor((Date.now() - loginStartTime) / 1000) : 0;
  const showTimeoutMessage = isLoading && loginTimeElapsed > 2;

  // Show loading while checking auth status
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gray-900 dark:border-white"></div>
        <p className="mt-4">Checking authentication status...</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h1 className="text-center text-2xl font-bold leading-9 tracking-tight">
          AI Chat App
        </h1>
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {showTimeoutMessage && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
            Login is taking longer than expected ({loginTimeElapsed}s)... Please be patient.
          </div>
        )}
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="block text-sm font-medium leading-6">
              Username
            </label>
            <div className="mt-2">
              <input
                id="username"
                name="username"
                type="text"
                required
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium leading-6">
                Password
              </label>
            </div>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  {loginTimeElapsed < 2 
                    ? 'Signing in...' 
                    : `Still trying... (${loginTimeElapsed}s)`
                  }
                </>
              ) : 'Sign in'}
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold leading-6 text-black dark:text-white hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </motion.div>
  );
};

export default Login; 