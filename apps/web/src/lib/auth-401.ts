import Cookies from 'js-cookie';

/**
 * Single-flight guard para evitar múltiplas execuções simultâneas
 */
let isHandlingUnauthorized = false;

/**
 * Trata erro 401 (não autorizado) de forma global:
 * - Remove todos os tokens de autenticação (cookies e localStorage)
 * - Define flag de sessão expirada no localStorage
 * - Redireciona para /login (a menos que já esteja lá)
 * 
 * Esta função usa um guard de single-flight para evitar múltiplas execuções
 * simultâneas quando múltiplas requisições retornam 401 ao mesmo tempo.
 */
export function handleUnauthorized(): void {
  // Single-flight guard: se já está processando, ignora chamadas subsequentes
  if (isHandlingUnauthorized) {
    return;
  }

  // Verificar se estamos no browser
  if (typeof window === 'undefined') {
    return;
  }

  // Verificar se já estamos na página de login
  if (window.location.pathname === '/login') {
    return;
  }

  // Marcar como processando
  isHandlingUnauthorized = true;

  try {
    // Remover cookie auth-token
    Cookies.remove('auth-token');

    // Remover tokens do localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('auth-token');

    // Definir flag de sessão expirada
    localStorage.setItem('auth:reason', 'session_expired');

    // Redirecionar para login
    window.location.href = '/login';
  } catch (error) {
    // Em caso de erro, tentar redirecionar mesmo assim
    // Log sem detalhes sensíveis
    console.error('[AUTH-401] Erro ao processar sessão expirada');
    try {
      window.location.href = '/login';
    } catch {
      // Se falhar, pelo menos limpar o flag para permitir nova tentativa
      isHandlingUnauthorized = false;
    }
  }
}

