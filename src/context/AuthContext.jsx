import { useState } from 'react';
import { authService } from '../services/authService.js';
import { AuthContext } from './auth-context.js';

export const AuthProvider = ({ children }) => {
  // La sesión guardada se lee al iniciar, sin un render extra
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const loading = false;

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

  const loginWithMagicLink = async (magicToken) => {
    const { user: verifiedUser, token } = await authService.verifyMagicLink(magicToken);
    setUser(verifiedUser);
    return { user: verifiedUser, token };
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
    loginWithMagicLink,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
