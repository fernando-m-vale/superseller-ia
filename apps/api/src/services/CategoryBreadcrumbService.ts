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
  permalink?: string; // HOTFIX 09.10: Permalink oficial da categoria
  path_from_root?: Array<{
    id: string;
    name: string;
  }>;
}

interface CacheEntry {
  breadcrumb: string[];
  permalink: string | null; // HOTFIX 09.10: Incluir permalink no cache
  expiresAt: number;
}

/**
 * Cache in-memory com TTL de 24h
 */
class CategoryBreadcrumbCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  get(categoryId: string): { breadcrumb: string[]; permalink: string | null } | null {
    const entry = this.cache.get(categoryId);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      // Expirou, remover do cache
      this.cache.delete(categoryId);
      return null;
    }
    
    return { breadcrumb: entry.breadcrumb, permalink: entry.permalink };
  }

  set(categoryId: string, breadcrumb: string[], permalink: string | null): void {
    this.cache.set(categoryId, {
      breadcrumb,
      permalink,
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
 * HOTFIX 09.10: Retorna breadcrumb e permalink oficial da categoria
 */
export interface CategoryBreadcrumbResult {
  breadcrumb: string[];
  permalink: string | null;
}

/**
 * Busca breadcrumb e permalink de uma categoria do Mercado Livre
 * 
 * @param categoryId - ID da categoria (ex: "MLB1234")
 * @returns Objeto com breadcrumb e permalink ou null se não encontrado
 */
export async function getCategoryBreadcrumb(categoryId: string | null | undefined): Promise<CategoryBreadcrumbResult | null> {
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

    // HOTFIX 09.10: Extrair permalink oficial (se disponível) ou construir de forma segura
    let permalink: string | null = null;
    if (response.data.permalink) {
      permalink = response.data.permalink;
    } else if (response.data.name) {
      // Fallback: construir permalink baseado no nome da categoria (slugify)
      // Formato: https://lista.mercadolivre.com.br/{slug}-{categoryId}
      const slug = response.data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]+/g, '-') // Substitui espaços e caracteres especiais por hífen
        .replace(/^-+|-+$/g, ''); // Remove hífens do início/fim
      
      if (slug) {
        permalink = `https://lista.mercadolivre.com.br/${slug}-${normalizedId}`;
      }
    }

    let breadcrumb: string[] = [];
    if (response.data.path_from_root && response.data.path_from_root.length > 0) {
      // Extrair nomes do breadcrumb
      breadcrumb = response.data.path_from_root.map((item) => item.name);
    } else if (response.data.name) {
      // Se não tem path_from_root, usar apenas o nome da categoria
      breadcrumb = [response.data.name];
    } else {
      return null;
    }
    
    // Armazenar no cache
    cache.set(normalizedId, breadcrumb, permalink);
    
    return { breadcrumb, permalink };
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
