
import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    Accept: 'application/json'
  }
});

// Adjuntar automáticamente el token de acceso.
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('accessToken');

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers?.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Centralizar los errores HTTP.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';

      // No borrar la sesión durante el inicio de sesión
      // ni durante los procesos públicos de recuperación.
      const publicRoutes = [
        '/auth/login',
        '/auth/forgot-password',
        '/auth/verify-email'
      ];

      const isPublicRoute = publicRoutes.some((route) =>
        url.includes(route)
      );

      if (!isPublicRoute) {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
      }
    }

    return Promise.reject(error);
  }
);
