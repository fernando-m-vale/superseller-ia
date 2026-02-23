/**
 * CategoryBreadcrumbService - HOTFIX 09.5
 * 
 * Resolve breadcrumb textual de categorias do Mercado Livre via API pública.
 * Cache in-memory com TTL de 24h para reduzir chamadas à API.
 */

import axios from 'axios';

const ML_API_BASE = 'https://api.mercadolibre.com';

interface CategoryInfo {
  id: string;
  name: string;
  path_from_root?: Array<{
    id: string;
    name: string;
  }>;
}

interface CacheEntry {
  breadcrumb: string[];
  expiresAt: number;
}

/**
 * Cache in-memory com TTL de 24h
 */
class CategoryBreadcrumbCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  get(categoryId: string): string[] | null {
    const entry = this.cache.get(categoryId);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      // Expirou, remover do cache
      this.cache.delete(categoryId);
      return null;
    }
    
    return entry.breadcrumb;
  }

  set(categoryId: string, breadcrumb: string[]): void {
    this.cache.set(categoryId, {
      breadcrumb,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  /**
   * Limpa entradas expiradas (opcional, para limpeza periódica)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [categoryId, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(categoryId);
      }
    }
  }

  /**
   * Retorna estatísticas do cache (para debug)
   */
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// Singleton do cache
const cache = new CategoryBreadcrumbCache();

/**
 * Busca breadcrumb de uma categoria do Mercado Livre
 * 
 * @param categoryId - ID da categoria (ex: "MLB1234")
 * @returns Array de nomes da categoria (ex: ["Moda", "Infantil", "Meias", "3D"]) ou null se não encontrado
 */
export async function getCategoryBreadcrumb(categoryId: string | null | undefined): Promise<string[] | null> {
  if (!categoryId || !categoryId.trim()) {
    return null;
  }

  // Normalizar categoryId (remover espaços, garantir formato MLB)
  const normalizedId = categoryId.trim().toUpperCase();
  if (!normalizedId.match(/^MLB\d+$/)) {
    // Se não começar com MLB, tentar adicionar
    const digits = normalizedId.match(/\d+/);
    if (!digits) return null;
    const fullId = `MLB${digits[0]}`;
    return getCategoryBreadcrumb(fullId);
  }

  // Verificar cache primeiro
  const cached = cache.get(normalizedId);
  if (cached) {
    return cached;
  }

  try {
    // Buscar da API do Mercado Livre
    const response = await axios.get<CategoryInfo>(`${ML_API_BASE}/categories/${normalizedId}`, {
      timeout: 5000, // 5 segundos de timeout
      validateStatus: (status) => status === 200,
    });

    if (response.data.path_from_root && response.data.path_from_root.length > 0) {
      // Extrair nomes do breadcrumb
      const breadcrumb = response.data.path_from_root.map((item) => item.name);
      
      // Armazenar no cache
      cache.set(normalizedId, breadcrumb);
      
      return breadcrumb;
    }

    // Se não tem path_from_root, usar apenas o nome da categoria
    if (response.data.name) {
      const breadcrumb = [response.data.name];
      cache.set(normalizedId, breadcrumb);
      return breadcrumb;
    }

    return null;
  } catch (error) {
    // Log do erro mas não falhar (fallback gracioso)
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 404) {
        // Categoria não encontrada - não cachear para não bloquear futuras tentativas
        return null;
      }
      // Outros erros (timeout, 500, etc) - logar mas retornar null
      console.warn(`[CATEGORY-BREADCRUMB] Erro ao buscar categoria ${normalizedId}:`, {
        status,
        message: error.message,
      });
    } else {
      console.warn(`[CATEGORY-BREADCRUMB] Erro desconhecido ao buscar categoria ${normalizedId}:`, error);
    }
    
    return null;
  }
}

/**
 * Limpa o cache (útil para testes ou limpeza periódica)
 */
export function clearCategoryBreadcrumbCache(): void {
  cache.cleanup();
}

/**
 * Retorna estatísticas do cache (para debug/monitoramento)
 */
export function getCategoryBreadcrumbCacheStats(): { size: number; entries: string[] } {
  return cache.getStats();
}
