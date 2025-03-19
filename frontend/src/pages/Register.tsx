import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && !authLoading) {
      console.log('Already authenticated, redirecting to home page');
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent repeated submissions
    if (isLoading) {
      return;
    }
    
    // Basic validation
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      console.log('Attempting registration for user:', username);
      
      // Add a small delay before registration to ensure UI state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Attempt to register - this will set the token and attempt to fetch the user profile
      await register(username, email || null, password);
      console.log('Registration successful');
      
      // Don't navigate here - use the useEffect hook that watches isAuthenticated instead
      // This ensures navigation happens only after the auth state has been fully updated
    } catch (err: any) {
      console.error('Registration error:', err);
      let errorMessage = 'Registration failed. Please try again.';
      
      if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = err.response.data.detail;
        console.error('Server error response:', err.response.data);
      } else if (err.message && typeof err.message === 'string') {
        errorMessage = err.message;
      }
      
      // For network errors, provide a more specific error message
      if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      // For timeout errors during profile fetch, still allow registration to proceed
      if (err.profileFetchFailed && err.tokenSet) {
        console.log('Profile fetch failed but token was set - considering registration successful');
        // The useEffect watching isAuthenticated will handle navigation
        return;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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
          Create a new account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
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
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6">
              Email (optional)
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium leading-6">
              Password
            </label>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Must be at least 8 characters long
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium leading-6">
              Confirm Password
            </label>
            <div className="mt-2">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Register'}
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold leading-6 text-black dark:text-white hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </motion.div>
  );
};

export default Register; 