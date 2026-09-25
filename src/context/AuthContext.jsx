import { createContext, useState, useEffect } from 'react';
import { authService } from '../services/authService.js';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Al cargar la app, comprobar si ya hay una sesión activa
    const storedUser = authService.getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    const { user: loggedInUser, token } = await authService.login(credentials);
    setUser(loggedInUser);
    return { user: loggedInUser, token };
  };

  const register = async (formData) => {
    const { user: registeredUser, token, welcomeCoupons } = await authService.register(formData);
    setUser(registeredUser);
    return { user: registeredUser, token, welcomeCoupons };
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const value = {
    user,
    role: user?.role || null,
    isAuthenticated: !!user,
    isDoctor: user?.role === 'doctor',
    isMember: user?.role === 'member',
    loading,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
