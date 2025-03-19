/**
 * Frontend Tests for Authentication Components
 * --------------------------------------------
 * This script performs unit tests on the React authentication components:
 * 1. Login form
 * 2. AuthContext provider
 * 3. Protected routes
 * 
 * Usage:
 *   npm test -- tests/frontend/test_auth_components.js
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { AuthProvider, useAuth } from '../../frontend/src/contexts/AuthContext';
import Login from '../../frontend/src/pages/Login';

// Mock axios
const mockAxios = new MockAdapter(axios);

// Sample test user
const TEST_USER = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  is_active: true,
  has_openai_api_key: false
};

// Sample test token
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0dXNlciIsImV4cCI6OTk5OTk5OTk5OX0.Pr9VUxnT7YnI33lYg_O-QrezH-BrpwR7tZK5jO-QCNM';

// Mock the localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

// Set up mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.setTimeout
jest.useFakeTimers();

// Sample protected component for testing authentication
const ProtectedComponent = () => {
  const { user, isAuthenticated, logout } = useAuth();
  
  return (
    <div>
      {isAuthenticated ? (
        <>
          <div data-testid="authenticated">Authenticated</div>
          <div data-testid="username">{user.username}</div>
          <button onClick={logout} data-testid="logout-button">Logout</button>
        </>
      ) : (
        <div data-testid="unauthenticated">Not Authenticated</div>
      )}
    </div>
  );
};

// Helper function to render components with the AuthProvider and Router
const renderWithProviders = (ui, { route = '/' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </MemoryRouter>
  );
};

// Reset mocks before each test
beforeEach(() => {
  mockAxios.reset();
  localStorageMock.clear();
  jest.clearAllMocks();
});

describe('Login Component', () => {
  test('renders login form', () => {
    renderWithProviders(<Login />);
    
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
  
  test('shows error on empty form submission', async () => {
    renderWithProviders(<Login />);
    
    // Submit form without filling in fields
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    // Check if error message is displayed
    expect(screen.getByText(/username and password are required/i)).toBeInTheDocument();
  });
  
  test('handles successful login', async () => {
    // Mock API responses
    mockAxios.onPost('http://localhost:8000/api/auth/login').reply(200, {
      access_token: TEST_TOKEN,
      token_type: 'bearer'
    });
    
    mockAxios.onGet('http://localhost:8000/api/users/me').reply(200, TEST_USER);
    
    // Render the login form
    renderWithProviders(<Login />);
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    // Wait for the loading state to be set
    expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    
    // Fast-forward timers to resolve the async operations
    jest.runAllTimers();
    
    // Check that the login API was called with correct data
    await waitFor(() => {
      expect(mockAxios.history.post.length).toBe(1);
      expect(JSON.parse(mockAxios.history.post[0].data)).toEqual({
        username: 'testuser',
        password: 'password'
      });
    });
    
    // Check that localStorage was updated with the token
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', JSON.stringify(TEST_TOKEN));
  });
  
  test('handles login failure', async () => {
    // Mock API error response
    mockAxios.onPost('http://localhost:8000/api/auth/login').reply(401, {
      detail: 'Incorrect username or password'
    });
    
    // Render the login form
    renderWithProviders(<Login />);
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpassword' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    // Fast-forward timers to resolve the async operations
    jest.runAllTimers();
    
    // Check that the error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/incorrect username or password/i)).toBeInTheDocument();
    });
  });
  
  test('handles network errors', async () => {
    // Mock network error
    mockAxios.onPost('http://localhost:8000/api/auth/login').networkError();
    
    // Render the login form
    renderWithProviders(<Login />);
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    // Fast-forward timers to resolve the async operations
    jest.runAllTimers();
    
    // Check that a generic error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/login failed/i)).toBeInTheDocument();
    });
  });
});

describe('AuthContext', () => {
  test('provides authentication state', () => {
    // Setup localStorage with a token
    localStorageMock.setItem('auth_token', JSON.stringify(TEST_TOKEN));
    
    // Mock API response for user profile
    mockAxios.onGet('http://localhost:8000/api/users/me').reply(200, TEST_USER);
    
    // Render a component that uses the auth context
    renderWithProviders(<ProtectedComponent />);
    
    // Fast-forward timers to resolve the async operations
    jest.runAllTimers();
    
    // Check that the component shows the authenticated state
    waitFor(() => {
      expect(screen.getByTestId('authenticated')).toBeInTheDocument();
      expect(screen.getByTestId('username')).toHaveTextContent('testuser');
    });
  });
  
  test('handles logout correctly', async () => {
    // Setup localStorage with a token
    localStorageMock.setItem('auth_token', JSON.stringify(TEST_TOKEN));
    
    // Mock API response for user profile
    mockAxios.onGet('http://localhost:8000/api/users/me').reply(200, TEST_USER);
    
    // Render a component that uses the auth context
    renderWithProviders(<ProtectedComponent />);
    
    // Fast-forward timers to resolve the async operations
    jest.runAllTimers();
    
    // Wait for the authenticated state
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toBeInTheDocument();
    });
    
    // Click the logout button
    fireEvent.click(screen.getByTestId('logout-button'));
    
    // Check that localStorage was cleared
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    
    // Check that the component shows the unauthenticated state
    await waitFor(() => {
      expect(screen.getByTestId('unauthenticated')).toBeInTheDocument();
    });
  });
  
  test('handles token refresh', async () => {
    // Setup localStorage with an almost expired token
    localStorageMock.setItem('auth_token', JSON.stringify(TEST_TOKEN));
    
    // Mock API responses
    mockAxios.onGet('http://localhost:8000/api/users/me').reply(200, TEST_USER);
    mockAxios.onPost('http://localhost:8000/api/auth/refresh').reply(200, {
      access_token: 'new_token',
      token_type: 'bearer'
    });
    
    // Mock jwt_decode to simulate an expiring token
    jest.mock('jwt-decode', () => () => ({
      exp: Math.floor(Date.now() / 1000) + 60, // Token expires in 1 minute
      sub: 'testuser'
    }));
    
    // Render a component that uses the auth context
    renderWithProviders(<ProtectedComponent />);
    
    // Fast-forward timers to resolve the async operations
    jest.runAllTimers();
    
    // Check that the refresh endpoint was called
    await waitFor(() => {
      expect(mockAxios.history.post.some(req => req.url === 'http://localhost:8000/api/auth/refresh')).toBe(true);
    });
    
    // Check that localStorage was updated with the new token
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', JSON.stringify('new_token'));
  });
});

// More test cases can be added here to cover additional authentication scenarios 