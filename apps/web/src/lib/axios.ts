import axios from 'axios';
import Cookies from 'js-cookie';
import { getApiBaseUrl } from './api'; // Reutilizando sua config existente

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Injeta o token em TODA requisição
api.interceptors.request.use((config) => {
  // Tenta pegar do cookie (padrão) ou localStorage
  const token = Cookies.get('auth-token') || localStorage.getItem('auth-token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Interceptor: Trata erro 401 (Token expirado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Opcional: Redirecionar para login se não for a página de login
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        // window.location.href = '/login'; 
        console.warn('Sessão expirada ou token inválido');
      }
    }
    return Promise.reject(error);
  }
);