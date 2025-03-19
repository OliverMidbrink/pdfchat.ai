import { useState, useEffect } from 'react';

// Utility to handle cookies
const CookieUtils = {
  setCookie(name: string, value: string, days: number = 7): void {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    const cookieValue = encodeURIComponent(value) + 
      (days ? `; expires=${expirationDate.toUTCString()}` : '') + 
      '; path=/; SameSite=Strict';
    document.cookie = `${name}=${cookieValue}`;
  },

  getCookie(name: string): string | null {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i].trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return decodeURIComponent(cookie.substring(nameEQ.length, cookie.length));
      }
    }
    return null;
  },

  removeCookie(name: string): void {
    document.cookie = `${name}=; Max-Age=-99999999; path=/`;
  }
};

// Comprehensive storage hook that uses cookies and localStorage
export function useStorage<T>(
  key: string,
  initialValue: T,
  useSessionStorage: boolean = false,
  useCookies: boolean = true,
  cookieExpiryDays: number = 7
) {
  // Get initial value
  const getStoredValue = (): T => {
    try {
      // First check cookies (more secure and can have explicit expiry)
      if (useCookies) {
        const cookieValue = CookieUtils.getCookie(key);
        if (cookieValue) return JSON.parse(cookieValue);
      }

      // Then check localStorage or sessionStorage
      const storageType = useSessionStorage ? sessionStorage : localStorage;
      const item = storageType.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error retrieving from storage:', error);
      return initialValue;
    }
  };

  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(getStoredValue);

  // Function to update both state and storage
  const setValue = (value: T | ((val: T) => T)): void => {
    try {
      // If value is a function, use the previous state
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Save to localStorage/sessionStorage
      const storageType = useSessionStorage ? sessionStorage : localStorage;
      storageType.setItem(key, JSON.stringify(valueToStore));
      
      // Save to cookie if enabled
      if (useCookies) {
        CookieUtils.setCookie(key, JSON.stringify(valueToStore), cookieExpiryDays);
      }
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  };

  // Function to remove the item
  const removeValue = (): void => {
    try {
      // Remove from state
      setStoredValue(initialValue);
      
      // Remove from localStorage/sessionStorage
      const storageType = useSessionStorage ? sessionStorage : localStorage;
      storageType.removeItem(key);
      
      // Remove from cookie if enabled
      if (useCookies) {
        CookieUtils.removeCookie(key);
      }
    } catch (error) {
      console.error('Error removing from storage:', error);
    }
  };

  // Listen for changes to this key in localStorage/sessionStorage
  useEffect(() => {
    // This handles the case when storage is changed in another tab/window
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        const newValue = e.newValue ? JSON.parse(e.newValue) : initialValue;
        setStoredValue(newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [initialValue, key]);

  return [storedValue, setValue, removeValue] as const;
} 