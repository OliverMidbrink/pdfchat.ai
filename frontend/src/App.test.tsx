import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the AuthContext to prevent errors when testing
jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
  }),
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Routes: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Route: () => <div>Route</div>,
  Navigate: () => <div>Navigate</div>,
  useLocation: () => ({ pathname: '/' }),
}));

test('renders without crashing', () => {
  render(<App />);
  // App has rendered successfully if no errors were thrown
  expect(document.querySelector('.App')).toBeTruthy();
});
