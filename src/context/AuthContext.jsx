import { useState } from 'react';
import { authService } from '../services/authService.js';
import { AuthContext } from './auth-context.js';

export const AuthProvider = ({ children }) => {
  // La sesión guardada se lee al iniciar, sin un render extra
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const loading = false;

  const loginWithMagicLink = async (magicToken) => {
    const { user: verifiedUser, token } = await authService.verifyMagicLink(magicToken);
    setUser(verifiedUser);
    return { user: verifiedUser, token };
  };

  const loginWithCode = async (phone, code) => {
    const { user: verifiedUser, token } = await authService.verifyCode(phone, code);
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
    loginWithMagicLink,
    loginWithCode,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
