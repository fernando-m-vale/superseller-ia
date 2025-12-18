import { getAccessToken } from './auth';
import { handleUnauthorized } from './auth-401';

/**
 * Wrapper para fetch que:
 * - Anexa automaticamente o token de autorização se presente
 * - Trata erros 401 chamando handleUnauthorized()
 * - Retorna a Response original (não engole)
 * 
 * @param url - URL da requisição
 * @param init - Opções de fetch (headers, method, body, etc.)
 * @returns Promise<Response> - A resposta da requisição
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  // Obter token se disponível
  const token = getAccessToken();
  
  // Preparar headers
  const headers = new Headers(init?.headers);
  
  // Adicionar Authorization se token presente
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Fazer a requisição
  const response = await fetch(url, {
    ...init,
    headers,
  });
  
  // Tratar 401 globalmente
  if (response.status === 401) {
    handleUnauthorized();
  }
  
  // Retornar a Response original
  return response;
}

