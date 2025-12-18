import { getApiBaseUrl } from './api';
import { apiFetch } from './api-fetch';

const API_URL = getApiBaseUrl();

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  tenantName: string;
}

export const setTokens = (accessToken: string, refreshToken: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
};

export const getAccessToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  return null;
};

export const getRefreshToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('refreshToken');
  }
  return null;
};

export const clearTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
};

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    let errorMessage = 'Login failed';
    try {
      const error = await response.json();
      errorMessage = String(error.error || error.message || errorMessage);
    } catch {
      // Se não conseguir parsear JSON, usar mensagem padrão
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  setTokens(data.accessToken, data.refreshToken);
  return data;
};

export const register = async (credentials: RegisterCredentials): Promise<AuthResponse> => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    let errorMessage = 'Registration failed';
    try {
      const error = await response.json();
      errorMessage = String(error.error || error.message || errorMessage);
    } catch {
      // Se não conseguir parsear JSON, usar mensagem padrão
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  setTokens(data.accessToken, data.refreshToken);
  return data;
};

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  const token = getAccessToken();
  
  if (!token) {
    return null;
  }

  try {
    const response = await apiFetch(`${API_URL}/auth/me`);

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch {
    clearTokens();
    return null;
  }
};

export const logout = () => {
  clearTokens();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};
