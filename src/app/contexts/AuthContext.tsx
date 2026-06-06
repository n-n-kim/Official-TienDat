import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  AUTH_SESSION_EVENT,
  clearStoredUser,
  getStoredUser,
  setStoredUser,
} from '../services/googleSession';
import { signOutFirebase } from '../lib/firebase';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  idToken?: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  canUseCloudSave: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const syncUserFromStorage = () => {
      const savedUser = getStoredUser();

      if (!savedUser) {
        setUser(null);
        return;
      }

      setUser(savedUser);
    };

    syncUserFromStorage();
    window.addEventListener(AUTH_SESSION_EVENT, syncUserFromStorage);

    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, syncUserFromStorage);
    };
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    setStoredUser(userData);
  };

  const logout = () => {
    setUser(null);
    clearStoredUser();
    void signOutFirebase().catch(() => {
      // Local logout should still succeed even if the provider sign-out fails.
    });
  };

  const canUseCloudSave = Boolean(user?.idToken);
  const isAdmin = isAdminEmail(user?.email);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        canUseCloudSave,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || 'kim1801x5@gmail.com')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase());
}
