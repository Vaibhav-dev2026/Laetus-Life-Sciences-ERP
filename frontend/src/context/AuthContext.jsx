import React, { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('laetus_token') || localStorage.getItem('laetus_token');
    const savedUser = sessionStorage.getItem('laetus_user') || localStorage.getItem('laetus_user');
    if (token && savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
    }
    setLoading(false);

    function handleUnauthorized() {
      setUser(null);
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  async function login(credentials) {
    const res = await authApi.login(credentials);
    setUser(res.user);
    sessionStorage.setItem('laetus_user', JSON.stringify(res.user));
    localStorage.setItem('laetus_user', JSON.stringify(res.user));
    return res.user;
  }

  function logout() {
    authApi.logout();
    sessionStorage.removeItem('laetus_user');
    localStorage.removeItem('laetus_user');
    setUser(null);
  }

  function updateUser(updatedUser, newToken) {
    setUser(updatedUser);
    sessionStorage.setItem('laetus_user', JSON.stringify(updatedUser));
    localStorage.setItem('laetus_user', JSON.stringify(updatedUser));
    if (newToken) {
      sessionStorage.setItem('laetus_token', newToken);
      localStorage.setItem('laetus_token', newToken);
    }
  }

  function hasRole(...roles) {
    if (!user) return false;
    if (roles.length === 0) return true;
    return roles.includes(user.role);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, hasRole, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
