import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext(null);

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_WARNING_MS = 7.5 * 60 * 60 * 1000; // 7.5 hours

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not auth'd
  const [showSessionWarning, setShowSessionWarning] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const currentUser = await base44.auth.me();
          setUser(currentUser || null);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    };
    checkAuth();

    // Poll auth status periodically (every 5 minutes)
    const interval = setInterval(checkAuth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Session timeout tracking
  useEffect(() => {
    if (!user) return;

    let lastActivity = Date.now();
    let warningTimer;
    let logoutTimer;

    const resetTimers = () => {
      lastActivity = Date.now();
      setShowSessionWarning(false);
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);

      warningTimer = setTimeout(() => {
        setShowSessionWarning(true);
      }, SESSION_WARNING_MS);

      logoutTimer = setTimeout(() => {
        base44.auth.logout('/login');
        setUser(null);
      }, SESSION_TIMEOUT_MS);
    };

    const handleActivity = () => {
      if (Date.now() - lastActivity > 60000) { // debounce to 1 min
        resetTimers();
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    resetTimers();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
    };
  }, [user]);

  const dismissSessionWarning = useCallback(() => {
    setShowSessionWarning(false);
    // Simulate activity to reset timers
    window.dispatchEvent(new Event('mousemove'));
  }, []);

  const logout = useCallback(() => {
    base44.auth.logout('/login');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, logout, showSessionWarning, dismissSessionWarning, isLoading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
