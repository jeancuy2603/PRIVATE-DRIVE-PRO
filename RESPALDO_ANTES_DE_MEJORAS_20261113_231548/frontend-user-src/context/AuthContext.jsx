
import {
  createContext,
  useContext,
  useState
} from 'react';

import { api } from '../services/api';

const C = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem('user') || 'null'
      );
    } catch {
      sessionStorage.removeItem('user');
      return null;
    }
  });

  const [passwordChangeRequired, setPasswordChangeRequired] =
    useState(
      sessionStorage.getItem('passwordChangeRequired') === 'true'
    );

  async function login(identifier, password) {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('temporaryAccessToken');
    sessionStorage.removeItem('passwordChangeRequired');
    sessionStorage.removeItem('user');

    setUser(null);
    setPasswordChangeRequired(false);

    const { data } = await api.post('/auth/login', {
      identifier: identifier.trim(),
      password
    });

    if (data.requiresPasswordChange === true) {
      sessionStorage.setItem(
        'temporaryAccessToken',
        data.accessToken
      );

      sessionStorage.setItem(
        'passwordChangeRequired',
        'true'
      );

      setPasswordChangeRequired(true);
      setUser(null);

      return data;
    }

    if (!data.accessToken || !data.user) {
      throw new Error(
        'El servidor no devolvió los datos necesarios para iniciar sesión.'
      );
    }

    sessionStorage.setItem(
      'accessToken',
      data.accessToken
    );

    sessionStorage.setItem(
      'user',
      JSON.stringify(data.user)
    );

    sessionStorage.removeItem('temporaryAccessToken');
    sessionStorage.removeItem('passwordChangeRequired');

    setPasswordChangeRequired(false);
    setUser(data.user);

    return data;
  }

  async function forgotPassword(identifier) {
    const { data } = await api.post(
      '/auth/forgot-password',
      {
        identifier: identifier.trim()
      }
    );

    return data;
  }

  async function changeTemporaryPassword(
    newPassword,
    confirmPassword
  ) {
    const temporaryToken = sessionStorage.getItem(
      'temporaryAccessToken'
    );

    if (!temporaryToken) {
      throw new Error(
        'No existe una sesión temporal válida. Solicita otra recuperación.'
      );
    }

    const { data } = await api.post(
      '/auth/change-temporary-password',
      {
        newPassword,
        confirmPassword
      },
      {
        headers: {
          Authorization: `Bearer ${temporaryToken}`
        }
      }
    );

    sessionStorage.removeItem('temporaryAccessToken');
    sessionStorage.removeItem('passwordChangeRequired');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('user');

    setPasswordChangeRequired(false);
    setUser(null);

    return data;
  }

  async function verifyEmail(email, code) {
    const { data } = await api.post(
      '/auth/verify-email',
      {
        email: email.trim().toLowerCase(),
        code: code.trim()
      }
    );

    if (data.accessToken) {
      sessionStorage.setItem(
        'accessToken',
        data.accessToken
      );
    }

    if (data.user) {
      sessionStorage.setItem(
        'user',
        JSON.stringify(data.user)
      );

      setUser(data.user);
    }

    return data;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      sessionStorage.clear();
      setUser(null);
      setPasswordChangeRequired(false);
    }
  }

  return (
    <C.Provider
      value={{
        user,
        login,
        verifyEmail,
        forgotPassword,
        changeTemporaryPassword,
        passwordChangeRequired,
        logout
      }}
    >
      {children}
    </C.Provider>
  );
}

export const useAuth = () => useContext(C);
