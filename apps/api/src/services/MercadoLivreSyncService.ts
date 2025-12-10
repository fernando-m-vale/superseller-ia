import axios, { AxiosError } from 'axios';
import { PrismaClient, Marketplace, ConnectionStatus, ListingStatus } from '@prisma/client';

const prisma = new PrismaClient();

const ML_API_BASE = 'https://api.mercadolibre.com';

interface MercadoLivreItem {
  id: string;
  title: string;
  price: number;
  available_quantity: number;
  permalink: string;
  thumbnail: string;
  status: string;
  category_id: string;
  // Campos de qualidade do ML (podem não existir em todos os itens)
  health?: number; // 0.0-1.0 (qualidade geral)
  quality_grade?: string; // "good", "regular", "bad" - fallback para health
  listing_type_id?: string; // gold_special, gold_pro, etc
  pictures?: Array<{ id: string }>;
  attributes?: Array<{ id: string; value_name: string }>;
  video_id?: string;
  descriptions?: Array<{ id: string }>;
  shipping?: {
    free_shipping?: boolean;
    mode?: string;
  };
}

interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: string[];
  duration: number;
}

export class MercadoLivreSyncService {
  private tenantId: string;
  private accessToken: string = '';
  private providerAccountId: string = '';
  private connectionId: string = '';
  private refreshToken: string = '';

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Método principal de sincronização
   */
  async syncListings(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [],
      duration: 0,
    };

    try {
      console.log(`[ML-SYNC] Iniciando sincronização para tenant: ${this.tenantId}`);

      // 1. Buscar conexão do Mercado Livre
      await this.loadConnection();

      // 2. Verificar/renovar token se necessário
      await this.ensureValidToken();

      // 3. Buscar IDs dos anúncios
      const itemIds = await this.fetchUserItemIds();
      console.log(`[ML-SYNC] Encontrados ${itemIds.length} anúncios`);

      if (itemIds.length === 0) {
        console.log('[ML-SYNC] Nenhum anúncio encontrado para sincronizar');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 4. Processar em lotes de 20
      const chunks = this.chunkArray(itemIds, 20);
      console.log(`[ML-SYNC] Processando ${chunks.length} lotes de até 20 itens`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[ML-SYNC] Processando lote ${i + 1}/${chunks.length} (${chunk.length} itens)`);

        try {
          const items = await this.fetchItemsDetails(chunk);
          const { created, updated } = await this.upsertListings(items);
          
          result.itemsProcessed += items.length;
          result.itemsCreated += created;
          result.itemsUpdated += updated;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          result.errors.push(`Lote ${i + 1}: ${errorMsg}`);
          console.error(`[ML-SYNC] Erro no lote ${i + 1}:`, errorMsg);
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      console.log(`[ML-SYNC] Sincronização concluída em ${result.duration}ms`);
      console.log(`[ML-SYNC] Processados: ${result.itemsProcessed}, Criados: ${result.itemsCreated}, Atualizados: ${result.itemsUpdated}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-SYNC] Erro fatal na sincronização:', errorMsg);
      return result;
    }
  }

  /**
   * Busca a conexão do Mercado Livre para o tenant
   */
  private async loadConnection(): Promise<void> {
    const connection = await prisma.marketplaceConnection.findFirst({
      where: {
        tenant_id: this.tenantId,
        type: Marketplace.mercadolivre,
        status: ConnectionStatus.active,
      },
    });

    if (!connection) {
      throw new Error('Conexão com Mercado Livre não encontrada ou inativa');
    }

    this.connectionId = connection.id;
    this.accessToken = connection.access_token;
    this.providerAccountId = connection.provider_account_id;
    this.refreshToken = connection.refresh_token || '';

    console.log(`[ML-SYNC] Conexão encontrada. Provider Account ID: ${this.providerAccountId}`);
  }

  /**
   * Verifica se o token está válido e renova se necessário
   */
  private async ensureValidToken(): Promise<void> {
    const connection = await prisma.marketplaceConnection.findUnique({
      where: { id: this.connectionId },
    });

    if (!connection) {
      throw new Error('Conexão não encontrada');
    }

    // Verificar se o token expirou (com margem de 5 minutos)
    const now = new Date();
    const expiresAt = connection.expires_at;
    const bufferMs = 5 * 60 * 1000; // 5 minutos

    if (expiresAt && expiresAt.getTime() - bufferMs < now.getTime()) {
      console.log('[ML-SYNC] Token expirado ou prestes a expirar. Renovando...');
      
      if (!connection.refresh_token) {
        throw new Error('Refresh token não disponível. Reconecte a conta.');
      }

      await this.refreshAccessToken(connection.refresh_token);
    } else {
      console.log('[ML-SYNC] Token válido');
    }
  }

  /**
   * Renova o access token usando o refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<void> {
    try {
      const response = await axios.post<TokenRefreshResponse>(
        `${ML_API_BASE}/oauth/token`,
        null,
        {
          params: {
            grant_type: 'refresh_token',
            client_id: process.env.ML_CLIENT_ID,
            client_secret: process.env.ML_CLIENT_SECRET,
            refresh_token: refreshToken,
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;

      // Atualizar no banco
      await prisma.marketplaceConnection.update({
        where: { id: this.connectionId },
        data: {
          access_token,
          refresh_token: refresh_token || refreshToken,
          expires_at: new Date(Date.now() + expires_in * 1000),
          status: ConnectionStatus.active,
        },
      });

      this.accessToken = access_token;
      this.refreshToken = refresh_token || this.refreshToken;
      console.log('[ML-SYNC] Token renovado com sucesso');
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error('[ML-SYNC] Erro ao renovar token:', error.response?.data);
        
        // Marcar conexão como expirada
        await prisma.marketplaceConnection.update({
          where: { id: this.connectionId },
          data: { status: ConnectionStatus.expired },
        });
      }
      throw new Error('Falha ao renovar token. Reconecte a conta do Mercado Livre.');
    }
  }

  /**
   * Executa uma função com retry automático em caso de 401 (Unauthorized)
   * Pattern: Tenta executar -> Se 401, renova token -> Tenta novamente (1x)
   */
  private async executeWithRetryOn401<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log('[ML-SYNC] Recebido 401. Tentando renovar token e retry...');
        
        if (!this.refreshToken) {
          throw new Error('Refresh token não disponível. Reconecte a conta.');
        }

        // Renovar token
        await this.refreshAccessToken(this.refreshToken);
        
        // Retry da operação original
        console.log('[ML-SYNC] Token renovado. Executando retry...');
        return await fn();
      }
      throw error;
    }
  }

  /**
   * Busca os IDs de todos os anúncios do usuário
   * Usa endpoint /sites/MLB/search com seller_id (mais permissivo)
   */
  private async fetchUserItemIds(): Promise<string[]> {
    const allIds: string[] = [];
    let offset = 0;
    const limit = 50;

    // Validação de segurança
    if (!this.providerAccountId) {
      throw new Error('Provider Account ID está vazio. Falha ao carregar conexão.');
    }

    while (true) {
      try {
        // Usando /sites/MLB/search com seller_id (endpoint PÚBLICO - não precisa de Auth)
        const url = `${ML_API_BASE}/sites/MLB/search`;
        console.log(`[ML-SYNC] Chamando API: ${url} (seller_id: ${this.providerAccountId}, Offset: ${offset})`);

        const response = await axios.get(url, {
          // NOTA: Endpoint público - Authorization removido para evitar conflitos de escopo
          params: {
            seller_id: this.providerAccountId,
            offset,
            limit,
          },
        });

        const { results, paging } = response.data;
        
        // Extrair IDs dos objetos de resultado
        const itemIds = results.map((item: { id: string }) => item.id);
        allIds.push(...itemIds);

        console.log(`[ML-SYNC] Buscados ${allIds.length}/${paging.total} IDs`);

        // Proteção contra loop infinito (máximo 1000 itens via offset)
        // A API de search tem limite de offset 1000. Para MVP, isso atende a maioria dos sellers.
        if (offset + limit >= paging.total || offset >= 1000) {
          break;
        }

        offset += limit;
      } catch (error) {
        // Melhorar debug: mostrar status e resposta completa do ML
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const data = JSON.stringify(error.response?.data);
          console.error(`[ML-SYNC] Erro API ML (${status}):`, data);
          throw new Error(`Erro ML ${status}: ${data}`);
        }
        throw error;
      }
    }

    return allIds;
  }

  /**
   * Busca detalhes de múltiplos itens (até 20 por vez)
   * Usa retry automático em caso de 401
   */
  private async fetchItemsDetails(itemIds: string[]): Promise<MercadoLivreItem[]> {
    if (itemIds.length === 0) return [];
    if (itemIds.length > 20) {
      throw new Error('Máximo de 20 itens por requisição');
    }

    return this.executeWithRetryOn401(async () => {
      try {
        const response = await axios.get(`${ML_API_BASE}/items`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          params: { ids: itemIds.join(',') },
        });

        // A API retorna um array de objetos { code, body }
        const items: MercadoLivreItem[] = response.data
          .filter((item: { code: number; body: MercadoLivreItem }) => item.code === 200)
          .map((item: { code: number; body: MercadoLivreItem }) => item.body);

        return items;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const data = JSON.stringify(error.response?.data);
          console.error(`[ML-SYNC] Erro ao buscar detalhes (${status}):`, data);
          // Re-throw para o executeWithRetryOn401 tratar o 401
          throw error;
        }
        throw new Error('Falha ao buscar detalhes dos anúncios');
      }
    });
  }

  /**
   * Faz upsert dos listings no banco
   */
  private async upsertListings(items: MercadoLivreItem[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const item of items) {
      const status = this.mapMLStatusToListingStatus(item.status);
      const healthScore = this.calculateHealthScore(item);

      try {
        const existing = await prisma.listing.findUnique({
          where: {
            tenant_id_marketplace_listing_id_ext: {
              tenant_id: this.tenantId,
              marketplace: Marketplace.mercadolivre,
              listing_id_ext: item.id,
            },
          },
        });

        if (existing) {
          await prisma.listing.update({
            where: { id: existing.id },
            data: {
              title: item.title,
              price: item.price,
              stock: item.available_quantity,
              status,
              category: item.category_id,
              health_score: healthScore,
            },
          });
          updated++;
        } else {
          await prisma.listing.create({
            data: {
              tenant_id: this.tenantId,
              marketplace: Marketplace.mercadolivre,
              listing_id_ext: item.id,
              title: item.title,
              price: item.price,
              stock: item.available_quantity,
              status,
              category: item.category_id,
              health_score: healthScore,
            },
          });
          created++;
        }
      } catch (error) {
        console.error(`[ML-SYNC] Erro ao salvar item ${item.id}:`, error);
      }
    }

    return { created, updated };
  }

  /**
   * Calcula Health Score baseado em dados da API do ML
   * Prioridade: item.health (0.0-1.0) → item.quality_grade → cálculo baseado em critérios
   */
  private calculateHealthScore(item: MercadoLivreItem): number {
    // 1. Se a API retornar health diretamente (0.0-1.0), usar
    if (typeof item.health === 'number' && item.health >= 0 && item.health <= 1) {
      const score = Math.round(item.health * 100);
      console.log(`[ML-SYNC] Health Score via item.health: ${item.health} -> ${score}`);
      return score;
    }

    // 2. Se tiver quality_grade, mapear para score
    if (item.quality_grade) {
      let score = 50; // default
      switch (item.quality_grade.toLowerCase()) {
        case 'good':
        case 'excellent':
          score = 90;
          break;
        case 'regular':
        case 'average':
          score = 70;
          break;
        case 'bad':
        case 'poor':
          score = 40;
          break;
      }
      console.log(`[ML-SYNC] Health Score via quality_grade: ${item.quality_grade} -> ${score}`);
      return score;
    }

    // 3. Calcular baseado em critérios do anúncio
    let score = 0;

    // Título preenchido (+15)
    if (item.title && item.title.length > 10) {
      score += 15;
    }

    // Título com bom tamanho (+10 extra se > 40 chars)
    if (item.title && item.title.length > 40) {
      score += 10;
    }

    // Preço definido (+15)
    if (item.price && item.price > 0) {
      score += 15;
    }

    // Estoque disponível (+15)
    if (item.available_quantity > 0) {
      score += 15;
    }

    // Categoria definida (+10)
    if (item.category_id) {
      score += 10;
    }

    // Thumbnail presente (+10)
    if (item.thumbnail) {
      score += 10;
    }

    // Múltiplas fotos (+10)
    if (item.pictures && item.pictures.length > 1) {
      score += 10;
    }

    // Frete grátis (+5)
    if (item.shipping?.free_shipping) {
      score += 5;
    }

    // Status ativo (+10)
    if (item.status === 'active') {
      score += 10;
    }

    const finalScore = Math.min(score, 100);
    console.log(`[ML-SYNC] Health Score calculado: ${finalScore} (title: ${item.title?.length || 0} chars, pictures: ${item.pictures?.length || 0}, status: ${item.status})`);
    return finalScore;
  }

  /**
   * Mapeia status do ML para o enum ListingStatus
   */
  private mapMLStatusToListingStatus(mlStatus: string): ListingStatus {
    switch (mlStatus.toLowerCase()) {
      case 'active':
        return ListingStatus.active;
      case 'paused':
        return ListingStatus.paused;
      case 'closed':
      case 'under_review':
      case 'inactive':
      default:
        return ListingStatus.deleted;
    }
  }

  /**
   * Divide array em chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

