import axios, { AxiosError } from 'axios';
import { PrismaClient, Marketplace, ConnectionStatus, ListingStatus, OrderStatus, ListingAccessStatus } from '@prisma/client';
import { ScoreCalculator } from './ScoreCalculator';
import { RecommendationService } from './RecommendationService';
import { extractHasVideoFromMlItem } from '../utils/ml-video-extractor';

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
  pictures?: Array<{ id: string; url?: string; secure_url?: string; size?: string }>;
  attributes?: Array<{ id: string; value_name: string }>;
  video_id?: string | null;
  videos?: Array<{ id: string; type?: string }>;
  descriptions?: Array<{ id: string; plain_text?: string }>;
  shipping?: {
    free_shipping?: boolean;
    mode?: string;
  };
  // Campos adicionais para Super Seller Score
  sold_quantity?: number;
  visits?: number;
  // Campos de promoção (podem não existir)
  original_price?: number; // Preço original antes da promoção
  sale_price?: number; // Preço de venda (com promoção)
  base_price?: number; // Preço base
  deals?: Array<{
    id?: string;
    type?: string;
    discount_percent?: number;
    start_date?: string;
    end_date?: string;
  }>;
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

type ReconcileDetail = {
  listing_id_ext: string;
  oldStatus: string;
  mlStatus: string;
  updated: boolean;
  httpStatus?: number;
  errorCode?: string;
  blockedBy?: string;
  message?: string;
  actionTaken?: 'none' | 'marked_blocked_by_policy' | 'marked_unauthorized' | 'cleared_block' | 'updated_status' | 'skipped' | 'no_change';
};

export class MercadoLivreSyncService {
  private tenantId: string;
  private accessToken: string = '';
  private providerAccountId: string = '';
  private connectionId: string = '';
  private refreshToken: string = '';
  private isSyncing: boolean = false; // Flag para evitar loops

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Dispara sync completo após refresh de token (fire-and-forget)
   * Evita loop infinito verificando se já está em sync
   */
  private async triggerFullSyncAfterRefresh(): Promise<void> {
    if (this.isSyncing) {
      return; // Já está em sync, não disparar novamente
    }

    try {
      this.isSyncing = true;
      console.log(`[ML-SYNC] Disparando sync completo após refresh de token para tenant: ${this.tenantId}`);
      
      // Importar OrdersService dinamicamente para evitar dependência circular
      const { MercadoLivreOrdersService } = await import('./MercadoLivreOrdersService');
      
      // Sync de listings (já temos o service instanciado)
      const listingsResult = await this.syncListings();
      console.log(`[ML-SYNC] Sync de listings após refresh: ${listingsResult.itemsProcessed} processados`);

      // Sync de pedidos (últimos 30 dias)
      const ordersService = new MercadoLivreOrdersService(this.tenantId);
      const ordersResult = await ordersService.syncOrders(30);
      console.log(`[ML-SYNC] Sync de pedidos após refresh: ${ordersResult.ordersProcessed} processados`);

      console.log(`[ML-SYNC] Sync completo após refresh finalizado para tenant: ${this.tenantId}`);
    } catch (error) {
      console.error(`[ML-SYNC] Erro ao executar sync após refresh para tenant ${this.tenantId}:`, error);
    } finally {
      this.isSyncing = false;
    }
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
      // Logs estruturados: tenantId, sellerId, endpoint
      console.log(`[ML-SYNC] Iniciando sincronização tenantId=${this.tenantId}`);

      // 1. Buscar conexão do Mercado Livre
      await this.loadConnection();

      // 2. Verificar/renovar token se necessário
      await this.ensureValidToken();

      // Log estruturado: sellerId após carregar conexão
      console.log(`[ML-SYNC] Conexão carregada tenantId=${this.tenantId} sellerId=${this.providerAccountId}`);

      // 3. Buscar IDs dos anúncios via discovery/search
      let itemIds: string[] = [];
      let discoveryBlocked = false;
      
      try {
        itemIds = await this.fetchUserItemIds();
        
        // Log estruturado: total, sample ids (primeiros 3), endpoint
        const sampleItemIds = itemIds.slice(0, 3);
        console.log(`[ML-SYNC] Busca concluída tenantId=${this.tenantId} sellerId=${this.providerAccountId} endpointUsed=/sites/MLB/search totalFound=${itemIds.length} sampleItemIds=[${sampleItemIds.join(',')}]`);
      } catch (error) {
        // Verificar se é 403 (PolicyAgent bloqueando)
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          discoveryBlocked = true;
          console.log(`[ML-SYNC] Discovery bloqueado (403) tenantId=${this.tenantId} sellerId=${this.providerAccountId} motivo=PolicyAgent_blocking endpoint=/sites/MLB/search`);
        } else {
          // Re-throw se não for 403
          throw error;
        }
      }

      // 4. Se discovery bloqueado (403) ou total=0, usar fallback via Orders
      if (discoveryBlocked || itemIds.length === 0) {
        const connectionStatus = await prisma.marketplaceConnection.findUnique({
          where: { id: this.connectionId },
          select: { status: true },
        });
        const statusStr = connectionStatus?.status || 'unknown';
        
        if (itemIds.length === 0 && !discoveryBlocked) {
          console.log(`[ML-SYNC] Nenhum anúncio encontrado tenantId=${this.tenantId} sellerId=${this.providerAccountId} motivo=nenhum_item_encontrado_via_search endpoint=/sites/MLB/search connectionStatus=${statusStr}`);
        }
        
        console.log(`[ML-SYNC] Acionando fallback via Orders tenantId=${this.tenantId} sellerId=${this.providerAccountId} discoveryBlocked=${discoveryBlocked} totalViaDiscovery=${itemIds.length}`);
        
        try {
          const fallbackResult = await this.fallbackViaOrders();
          
          // Atualizar contadores do resultado principal
          result.itemsProcessed += fallbackResult.itemsProcessed;
          result.itemsCreated += fallbackResult.itemsCreated;
          result.itemsUpdated += fallbackResult.itemsUpdated;
          
          // Se fallback encontrou items, continuar normalmente
          if (fallbackResult.itemsProcessed > 0) {
            // Buscar IDs dos items criados/atualizados para continuar processamento
            const fallbackItemIds = await prisma.listing.findMany({
              where: {
                tenant_id: this.tenantId,
                marketplace: Marketplace.mercadolivre,
              },
              select: { listing_id_ext: true },
              take: 1000, // Limite razoável
            });
            
            itemIds = fallbackItemIds.map(l => l.listing_id_ext);
            console.log(`[ML-SYNC] Fallback concluído tenantId=${this.tenantId} sellerId=${this.providerAccountId} itemsProcessed=${fallbackResult.itemsProcessed} itemsCreated=${fallbackResult.itemsCreated} itemsUpdated=${fallbackResult.itemsUpdated} uniqueItemIds=${itemIds.length}`);
          } else {
            // Fallback não encontrou items, retornar sucesso vazio
            result.success = true;
            result.duration = Date.now() - startTime;
            return result;
          }
        } catch (fallbackError) {
          const errorMsg = fallbackError instanceof Error ? fallbackError.message : 'Erro desconhecido no fallback';
          result.errors.push(`Fallback via Orders falhou: ${errorMsg}`);
          console.error(`[ML-SYNC] Erro no fallback via Orders:`, errorMsg);
          
          // Se discovery também falhou, retornar erro
          if (discoveryBlocked) {
            result.success = false;
            result.duration = Date.now() - startTime;
            return result;
          }
          
          // Se discovery retornou 0 mas fallback falhou, retornar sucesso vazio
          result.success = true;
          result.duration = Date.now() - startTime;
          return result;
        }
      }

      // 5. Processar em lotes de 20
      const chunks = this.chunkArray(itemIds, 20);
      console.log(`[ML-SYNC] Processando ${chunks.length} lotes de até 20 itens`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[ML-SYNC] Processando lote ${i + 1}/${chunks.length} (${chunk.length} itens)`);

        try {
          const items = await this.fetchItemsDetails(chunk);
          // Fluxo normal: source = "discovery", discoveryBlocked = false
          const { created, updated } = await this.upsertListings(items, 'discovery', false);
          
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

      // Log estruturado: resumo final
      console.log(`[ML-SYNC] Sincronização concluída tenantId=${this.tenantId} sellerId=${this.providerAccountId} durationMs=${result.duration} processed=${result.itemsProcessed} created=${result.itemsCreated} updated=${result.itemsUpdated} errors=${result.errors.length}`);

      // 5. Gerar recomendações para os anúncios sincronizados
      try {
        console.log('[ML-SYNC] Gerando recomendações...');
        const recommendationService = new RecommendationService(this.tenantId);
        const recResult = await recommendationService.generateForAllListings();
        console.log(`[ML-SYNC] Recomendações geradas: ${recResult.totalRecommendations} para ${recResult.totalListings} anúncios`);
      } catch (recError) {
        console.error('[ML-SYNC] Erro ao gerar recomendações (não crítico):', recError);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-SYNC] Erro fatal na sincronização:', errorMsg);
      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Busca a conexão do Mercado Livre para o tenant
   * Flexibilizado para tentar renovar tokens de conexões expiradas
   */
  private async loadConnection(): Promise<void> {
    console.log(`[ML-SYNC] ========== BUSCANDO CONEXÃO ==========`);
    console.log(`[ML-SYNC] Tenant ID: ${this.tenantId}`);

    // Primeiro, buscar conexão ativa
    let connection = await prisma.marketplaceConnection.findFirst({
      where: {
        tenant_id: this.tenantId,
        type: Marketplace.mercadolivre,
        status: ConnectionStatus.active,
      },
    });

    // Se não encontrou ativa, buscar qualquer conexão do ML para debug/renovação
    if (!connection) {
      console.log(`[ML-SYNC] ❌ Nenhuma conexão ATIVA encontrada. Buscando qualquer conexão...`);
      
      const allConnections = await prisma.marketplaceConnection.findMany({
        where: {
          tenant_id: this.tenantId,
          type: Marketplace.mercadolivre,
        },
      });

      console.log(`[ML-SYNC] Conexões ML encontradas: ${allConnections.length}`);
      
      if (allConnections.length > 0) {
        for (const conn of allConnections) {
          console.log(`[ML-SYNC] - ID: ${conn.id}, Status: ${conn.status}, Provider: ${conn.provider_account_id}`);
        }

        // Tentar usar uma conexão expirada e renovar o token
        const expiredConnection = allConnections.find(c => c.status === ConnectionStatus.expired);
        if (expiredConnection && expiredConnection.refresh_token) {
          console.log(`[ML-SYNC] 🔄 Tentando renovar token da conexão expirada...`);
          
          this.connectionId = expiredConnection.id;
          this.refreshToken = expiredConnection.refresh_token;
          this.providerAccountId = expiredConnection.provider_account_id;
          
          try {
            await this.refreshAccessToken(expiredConnection.refresh_token);
            console.log(`[ML-SYNC] ✅ Token renovado! Conexão reativada.`);
            
            connection = await prisma.marketplaceConnection.findUnique({
              where: { id: this.connectionId },
            });
          } catch (refreshError) {
            console.error(`[ML-SYNC] ❌ Falha ao renovar token:`, refreshError);
            throw new Error('Conexão expirada e falha ao renovar token. Reconecte a conta.');
          }
        }
      }

      if (!connection) {
        throw new Error('Conexão com Mercado Livre não encontrada ou inativa');
      }
    }

    this.connectionId = connection.id;
    this.accessToken = connection.access_token;
    this.providerAccountId = connection.provider_account_id;
    this.refreshToken = connection.refresh_token || '';

    console.log(`[ML-SYNC] ✅ Conexão carregada: Provider ${this.providerAccountId}, Status: ${connection.status}`);
  }

  /**
   * Verifica se o token está válido e renova se necessário
   * @throws Error com código 'AUTH_REVOKED' se o refresh falhar por revogação
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

    // Se expirou ou está prestes a expirar, renovar
    if (!expiresAt || expiresAt.getTime() - bufferMs < now.getTime()) {
      console.log('[ML-SYNC] Token expirado ou prestes a expirar. Renovando...');
      
      if (!connection.refresh_token) {
        const error = new Error('Refresh token não disponível. Reconecte a conta.');
        (error as any).code = 'AUTH_REVOKED';
        throw error;
      }

      try {
        await this.refreshAccessToken(connection.refresh_token);
      } catch (refreshError: any) {
        // Re-throw erros AUTH_REVOKED
        if (refreshError.code === 'AUTH_REVOKED') {
          throw refreshError;
        }
        throw refreshError;
      }
    } else {
      console.log('[ML-SYNC] Token válido');
    }
  }

  /**
   * Renova o access token usando o refresh token
   * @throws Error com código 'AUTH_REVOKED' se o refresh token foi revogado
   */
  private async refreshAccessToken(refreshToken: string): Promise<void> {
    try {
      const credentials = await import('../lib/secrets').then(m => m.getMercadoLivreCredentials());
      
      const response = await axios.post<TokenRefreshResponse>(
        `${ML_API_BASE}/oauth/token`,
        null,
        {
          params: {
            grant_type: 'refresh_token',
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
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

      // Disparar sync completo após renovação bem-sucedida (apenas se não estiver já em sync)
      // Isso garante que dados sejam atualizados quando token é renovado proativamente
      if (!this.isSyncing) {
        this.triggerFullSyncAfterRefresh().catch((err: unknown) => {
          console.error('[ML-SYNC] Erro ao disparar sync após refresh:', err);
        });
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.error('[ML-SYNC] Erro ao renovar token:', { status, data: errorData });
        
        // Se o refresh token foi revogado (400 ou 401), marcar como revogado
        if (status === 400 || status === 401) {
          await prisma.marketplaceConnection.update({
            where: { id: this.connectionId },
            data: { status: ConnectionStatus.revoked },
          });
          
          const authError = new Error('Conexão expirada. Reconecte sua conta.');
          (authError as any).code = 'AUTH_REVOKED';
          throw authError;
        }
        
        // Outros erros: marcar como expirado
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
        // Log estruturado: endpoint, sellerId, offset
        console.log(`[ML-SYNC] Buscando items tenantId=${this.tenantId} sellerId=${this.providerAccountId} endpoint=/sites/MLB/search offset=${offset}`);

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

        // Log estruturado: progresso
        console.log(`[ML-SYNC] Progresso tenantId=${this.tenantId} sellerId=${this.providerAccountId} encontrados=${allIds.length} total=${paging.total}`);

        // Proteção contra loop infinito (máximo 1000 itens via offset)
        // A API de search tem limite de offset 1000. Para MVP, isso atende a maioria dos sellers.
        if (offset + limit >= paging.total || offset >= 1000) {
          break;
        }

        offset += limit;
      } catch (error) {
        // Log estruturado: erro HTTP com status code e payload resumido
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const data = error.response?.data;
          // Resumir payload (limitar tamanho para não poluir logs)
          const dataStr = data ? JSON.stringify(data).substring(0, 500) : 'no data';
          console.error(`[ML-SYNC] Erro HTTP ML tenantId=${this.tenantId} sellerId=${this.providerAccountId} endpoint=/sites/MLB/search statusCode=${status} payload=${dataStr}`);
          throw new Error(`Erro ML ${status}: ${dataStr}`);
        }
        throw error;
      }
    }

    return allIds;
  }

  /**
   * Busca a descrição completa de um item via endpoint específico
   */
  private async fetchItemDescription(itemId: string): Promise<string | null> {
    try {
      const response = await axios.get(`${ML_API_BASE}/items/${itemId}/description`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      
      // A API retorna { plain_text: "...", text: "...", last_updated: "..." }
      return response.data?.plain_text || null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        // 404 significa que o item não tem descrição, não é erro crítico
        if (status === 404) {
          console.log(`[ML-SYNC] Item ${itemId} não possui descrição`);
          return null;
        }
        console.error(`[ML-SYNC] Erro ao buscar descrição do item ${itemId} (${status}):`, error.response?.data);
      }
      // Não lança erro para não bloquear o sync, apenas retorna null
      return null;
    }
  }

  /**
   * Re-sincroniza listings específicos do Mercado Livre
   * 
   * Útil para atualizar campos de cadastro (description, pictures_count, etc)
   * de listings já existentes.
   * 
   * @param listingIds Lista de IDs externos (listing_id_ext) dos listings a re-sincronizar
   */
  async resyncListings(listingIds: string[]): Promise<{
    success: boolean;
    itemsProcessed: number;
    itemsUpdated: number;
    errors: string[];
  }> {
    const result = {
      success: false,
      itemsProcessed: 0,
      itemsUpdated: 0,
      errors: [] as string[],
    };

    try {
      // Carregar conexão e garantir token válido
      await this.loadConnection();
      await this.ensureValidToken();

      if (listingIds.length === 0) {
        result.success = true;
        return result;
      }

      // Processar em lotes de 20
      const chunks = this.chunkArray(listingIds, 20);

      for (const chunk of chunks) {
        try {
          const items = await this.fetchItemsDetails(chunk);
          // Resync: não alterar source e discovery_blocked (manter valores existentes)
          const { updated } = await this.upsertListings(items, undefined, false);
          
          result.itemsProcessed += items.length;
          result.itemsUpdated += updated;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          result.errors.push(`Lote com ${chunk.length} itens: ${errorMsg}`);
          console.error(`[ML-SYNC] Erro no lote de re-sync:`, errorMsg);
        }
      }

      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      console.error('[ML-SYNC] Erro fatal no re-sync de listings:', errorMsg);
      return result;
    }
  }

  /**
   * Busca detalhes de múltiplos itens (até 20 por vez)
   * Usa retry automático em caso de 401
   * Também busca descrições completas via endpoint específico
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

        // Buscar descrições completas para cada item (em paralelo, mas com limite)
        console.log(`[ML-SYNC] Buscando descrições completas para ${items.length} itens...`);
        const itemsWithDescriptions = await Promise.all(
          items.map(async (item) => {
            const fullDescription = await this.fetchItemDescription(item.id);
            if (fullDescription) {
              // Sobrescrever a descrição se encontramos uma completa
              item.descriptions = [{ id: item.id, plain_text: fullDescription }];
            }
            return item;
          })
        );

        return itemsWithDescriptions;
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
   * 
   * Garante que campos de mídia/descrição sejam preenchidos corretamente do ML API
   * e NUNCA sobrescreve com valores vazios/0 quando API não retornar dados.
   * 
   * @param items Lista de itens do ML para upsert
   * @param source Origem da ingestão: "discovery" | "orders_fallback" | null
   * @param discoveryBlocked Se discovery foi bloqueado (403/PolicyAgent)
   */
  /**
   * Obtém seller_id de um item via GET /items/:id para auditoria
   * Retorna seller_id se 200, null se 403 PA_UNAUTHORIZED, ou lança erro para outros casos
   */
  private async fetchItemSellerId(itemId: string): Promise<{ sellerId: string | null; isUnauthorized: boolean; errorCode?: string }> {
    try {
      const response = await axios.get(`${ML_API_BASE}/items/${itemId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      const sellerId = response.data?.seller_id ? String(response.data.seller_id) : null;
      return { sellerId, isUnauthorized: false };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;
        const errorCode = data?.error || data?.message;

        // 403 com PA_UNAUTHORIZED_RESULT_FROM_POLICIES = listing não acessível pela conexão atual
        if (status === 403 && (errorCode === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' || 
            (typeof errorCode === 'string' && errorCode.includes('UNAUTHORIZED')))) {
          console.log(`[ML-SYNC] Listing ${itemId} não acessível (403 PA_UNAUTHORIZED): connectionId=${this.connectionId}`);
          return { sellerId: null, isUnauthorized: true, errorCode: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' };
        }

        // Outros erros: propagar
        throw error;
      }
      throw error;
    }
  }

  private async upsertListings(
    items: MercadoLivreItem[],
    source?: string | null,
    discoveryBlocked: boolean = false
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const item of items) {
      const status = this.mapMLStatusToListingStatus(item.status);
      const healthScore = this.calculateHealthScore(item);
      
      // Extrair descrição do primeiro item de descriptions (se existir)
      // Priorizar plain_text completo (vindo de /items/{id}/description)
      const descriptionFromAPI = item.descriptions?.[0]?.plain_text || null;
      
      // Contar fotos - garantir que pictures é um array válido
      const picturesCountFromAPI = Array.isArray(item.pictures) ? item.pictures.length : undefined;
      
      // Thumbnail: usar item.thumbnail OU primeira imagem de pictures
      let thumbnailFromAPI: string | undefined = item.thumbnail;
      if (!thumbnailFromAPI && Array.isArray(item.pictures) && item.pictures.length > 0) {
        // Tentar pegar a primeira imagem com URL válida
        const firstPicture = item.pictures.find(p => p.url);
        if (firstPicture?.url) {
          thumbnailFromAPI = firstPicture.url;
        }
      }
      
      // Verificar se tem vídeo usando helper robusto
      const videoExtraction = extractHasVideoFromMlItem(item);
      const hasVideoFromAPI = videoExtraction.hasVideo;
      
      // Log seguro com evidências (sem tokens) - apenas em dev
      if (process.env.NODE_ENV !== 'production' && videoExtraction.evidence.length > 0) {
        console.log(`[ML-SYNC] Video extraction for ${item.id}:`, {
          tenantId: this.tenantId,
          hasVideo: hasVideoFromAPI,
          evidenceCount: videoExtraction.evidence.length,
          evidence: videoExtraction.evidence.slice(0, 3), // Limitar evidências no log
        });
      }
      
      // Log seguro (sem tokens) para diagnóstico
      const logData = {
        tenantId: this.tenantId,
        listingIdExt: item.id,
        picturesCount: picturesCountFromAPI ?? 'not_provided',
        hasVideo: hasVideoFromAPI,
        hasDescription: descriptionFromAPI ? descriptionFromAPI.length > 0 : false,
        descriptionLength: descriptionFromAPI?.length ?? 0,
        thumbnailProvided: !!thumbnailFromAPI,
      };
      console.log(`[ML-SYNC] Item ${item.id}:`, JSON.stringify(logData));
      
      // Dados para o Super Seller Score (usar valores da API ou fallback seguro)
      const listingForScore = {
        id: item.id,
        title: item.title,
        description: descriptionFromAPI || '',
        price: item.price,
        stock: item.available_quantity,
        status: status,
        thumbnail_url: thumbnailFromAPI || null,
        pictures_count: picturesCountFromAPI ?? 0,
        visits_last_7d: item.visits ?? null,
        sales_last_7d: item.sold_quantity || 0,
      };
      
      // Calcular Super Seller Score
      const scoreResult = ScoreCalculator.calculate(listingForScore);

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

        // Para listings novos, tentar obter seller_id via GET /items/:id
        let sellerId: string | null = null;
        let accessStatus: 'accessible' | 'unauthorized' | 'blocked_by_policy' = 'accessible';
        let accessBlockedCode: string | null = null;
        let accessBlockedReason: string | null = null;

        if (!existing) {
          // Listing novo: fazer GET /items/:id para obter seller_id e verificar acesso
          try {
            const sellerResult = await this.fetchItemSellerId(item.id);
            sellerId = sellerResult.sellerId;
            
            if (sellerResult.isUnauthorized) {
              accessStatus = 'blocked_by_policy';
              accessBlockedCode = sellerResult.errorCode || 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES';
              accessBlockedReason = 'Anúncio não acessível pela conta Mercado Livre conectada (possível conexão antiga/revogada)';
              console.log(`[ML-SYNC] Listing ${item.id} marcado como unauthorized: connectionId=${this.connectionId}, code=${accessBlockedCode}`);
            }
          } catch (error) {
            // Se falhar por outro motivo (não 403 PA_UNAUTHORIZED), logar mas continuar
            console.warn(`[ML-SYNC] Erro ao obter seller_id para listing ${item.id}:`, error instanceof Error ? error.message : 'Erro desconhecido');
          }
        } else {
          // Listing existente: manter seller_id se já existir, mas verificar acesso se necessário
          sellerId = existing.seller_id;
          
          // Se listing existente está marcado como unauthorized, tentar verificar novamente
          if (existing.access_status === 'unauthorized' || existing.access_status === 'blocked_by_policy') {
            try {
              const sellerResult = await this.fetchItemSellerId(item.id);
              if (!sellerResult.isUnauthorized && sellerResult.sellerId) {
                // Agora está acessível: atualizar status
                accessStatus = 'accessible';
                sellerId = sellerResult.sellerId;
                console.log(`[ML-SYNC] Listing ${item.id} agora está acessível: connectionId=${this.connectionId}, sellerId=${sellerId}`);
              } else if (sellerResult.isUnauthorized) {
                // Continua unauthorized: manter status
                accessStatus = existing.access_status;
                accessBlockedCode = sellerResult.errorCode || 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES';
                accessBlockedReason = 'Anúncio não acessível pela conta Mercado Livre conectada (possível conexão antiga/revogada)';
              }
            } catch (error) {
              // Se falhar, manter status atual
              accessStatus = existing.access_status;
              accessBlockedCode = existing.access_blocked_code;
              accessBlockedReason = existing.access_blocked_reason;
            }
          } else {
            // Listing acessível: manter status
            accessStatus = existing.access_status;
          }
        }

        // Construir objeto de dados para update/create
        // REGRA: Só atualizar campos se API retornar valores válidos (não vazios/0/undefined)
        const listingData: any = {
          title: item.title, // Sempre atualizar título
          price: item.price, // Sempre atualizar preço
          stock: item.available_quantity, // Sempre atualizar estoque
          status, // Sempre atualizar status
          health_score: healthScore, // Legado - score da API ML
          super_seller_score: scoreResult.total, // Novo score proprietário
          score_breakdown: {
            cadastro: scoreResult.cadastro,
            trafego: scoreResult.trafego,
            disponibilidade: scoreResult.disponibilidade,
            details: scoreResult.details,
          } as any, // Cast para InputJsonValue do Prisma
        };

        // Atualizar category apenas se vier da API
        if (item.category_id) {
          listingData.category = item.category_id;
        }

        // Atualizar description apenas se vier string não vazia da API
        if (descriptionFromAPI && descriptionFromAPI.trim().length > 0) {
          listingData.description = descriptionFromAPI.trim();
        } else if (!existing) {
          // Se é criação e não tem descrição, setar null explicitamente
          listingData.description = null;
        }
        // Se é update e não veio descrição, NÃO atualizar (manter valor existente)

        // Atualizar pictures_count apenas se API retornar número válido
        if (picturesCountFromAPI !== undefined && picturesCountFromAPI !== null) {
          listingData.pictures_count = picturesCountFromAPI;
        } else if (!existing) {
          // Se é criação e não tem pictures, setar 0
          listingData.pictures_count = 0;
        }
        // Se é update e não veio pictures, NÃO atualizar (manter valor existente)

        // Atualizar thumbnail_url apenas se vier da API
        if (thumbnailFromAPI) {
          listingData.thumbnail_url = thumbnailFromAPI;
        } else if (!existing) {
          // Se é criação e não tem thumbnail, setar null
          listingData.thumbnail_url = null;
        }
        // Se é update e não veio thumbnail, NÃO atualizar (manter valor existente)

        // Atualizar pictures_json (array completo de pictures do ML)
        if (Array.isArray(item.pictures) && item.pictures.length > 0) {
          listingData.pictures_json = item.pictures as any; // Cast para Json do Prisma
        } else if (!existing) {
          // Se é criação e não tem pictures, setar null
          listingData.pictures_json = null;
        }
        // Se é update e não veio pictures, NÃO atualizar (manter valor existente)

        // Processar campos de promoção
        // FONTE DE VERDADE: original_price > price OU base_price > price indica promoção
        const now = new Date();
        const currentPrice = item.price;
        const originalPriceFromAPI = item.original_price ?? null;
        const basePriceFromAPI = item.base_price ?? null;
        
        // Determinar preço original (prioridade: original_price > base_price > price)
        const originalPrice = originalPriceFromAPI ?? basePriceFromAPI ?? null;
        
        let hasPromotion = false;
        let priceFinal: number = currentPrice;
        let priceBase: number = currentPrice;
        let discountPercent: number | null = null;
        let promotionType: string | null = null;

        // REGRA PRINCIPAL: Se original_price > price OU base_price > price, tem promoção
        if (originalPrice !== null && originalPrice > currentPrice) {
          hasPromotion = true;
          priceFinal = currentPrice;
          priceBase = originalPrice;
          
          // Calcular desconto percentual
          if (originalPrice > 0) {
            discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
          }
          
          // Verificar se há deals para tipo de promoção
          if (item.deals && Array.isArray(item.deals) && item.deals.length > 0) {
            const activeDeal = item.deals[0];
            promotionType = activeDeal.type || 'discount';
            // Se deal já tem discount_percent, usar ele (mais preciso)
            if (activeDeal.discount_percent !== undefined && activeDeal.discount_percent !== null) {
              discountPercent = activeDeal.discount_percent;
            }
          } else {
            promotionType = 'discount';
          }
        } else {
          // Sem promoção: price_final = price, price_base = base_price ou price
          hasPromotion = false;
          priceFinal = currentPrice;
          priceBase = basePriceFromAPI ?? currentPrice;
          discountPercent = null;
          promotionType = null;
        }

        // Atualizar campos de promoção
        listingData.has_promotion = hasPromotion;
        listingData.price_final = priceFinal;
        listingData.original_price = hasPromotion ? priceBase : null;
        listingData.discount_percent = discountPercent;
        listingData.promotion_type = promotionType;
        listingData.promotion_checked_at = now;
        
        // Log para debug (sem expor tokens)
        console.log('[ML-SYNC] Promoção detectada', {
          listing_id_ext: item.id,
          has_promotion: hasPromotion,
          price: currentPrice,
          original_price: originalPriceFromAPI,
          base_price: basePriceFromAPI,
          price_final: priceFinal,
          price_base: priceBase,
          discount_percent: discountPercent,
        });

        // Atualizar has_video (tri-state: true/false/null)
        // - true: tem vídeo confirmado via API
        // - false: confirmado que não tem vídeo (ex: video_id is null explicitamente)
        // - null: indisponível via API (fallback orders_fallback ou quando não conseguimos determinar)
        // No fallback via Orders, não temos certeza, então setar null
        if (source === 'orders_fallback') {
          listingData.has_video = null; // Não sabemos se tem vídeo via fallback
        } else {
          // Fluxo normal: usar valor da API (true/false)
          listingData.has_video = hasVideoFromAPI;
        }

        // Atualizar visits_last_7d/sales_last_7d apenas se a API retornar valores válidos
        // Isso evita sobrescrever com 0 quando não há dados
        const visitsFromAPI = item.visits;
        const salesFromAPI = item.sold_quantity;
        
        if (visitsFromAPI !== undefined && visitsFromAPI !== null && visitsFromAPI >= 0) {
          listingData.visits_last_7d = visitsFromAPI;
        } else if (!existing) {
          // Se é criação e não veio visits, setar null (não 0)
          listingData.visits_last_7d = null;
        }
        // Se é update e não veio visits, NÃO atualizar (manter valor existente)

        if (salesFromAPI !== undefined && salesFromAPI !== null && salesFromAPI >= 0) {
          listingData.sales_last_7d = salesFromAPI;
        } else if (!existing) {
          // Se é criação e não veio sales, setar 0
          listingData.sales_last_7d = 0;
        }
        // Se é update e não veio sales, NÃO atualizar (manter valor existente)

        // Atualizar source e discovery_blocked (sempre atualizar quando fornecidos)
        if (source !== undefined) {
          listingData.source = source;
        }
        listingData.discovery_blocked = discoveryBlocked;

        // Sempre atualizar marketplace_connection_id (identifica qual conexão sincronizou)
        listingData.marketplace_connection_id = this.connectionId;

        // Atualizar seller_id e access_status
        if (sellerId !== null) {
          listingData.seller_id = sellerId;
        }
        listingData.access_status = accessStatus;
        if (accessBlockedCode) {
          listingData.access_blocked_code = accessBlockedCode;
          listingData.access_blocked_at = new Date();
        }
        if (accessBlockedReason) {
          listingData.access_blocked_reason = accessBlockedReason;
        }

        // Log seguro dos campos atualizados
        const updatedFields = Object.keys(listingData).filter(k => k !== 'score_breakdown');
        console.log(`[ML-SYNC] Listing ${item.id} (${existing ? 'updated' : 'created'}): fields=${updatedFields.join(',')} source=${source || 'null'} discoveryBlocked=${discoveryBlocked}`);

        if (existing) {
          await prisma.listing.update({
            where: { id: existing.id },
            data: listingData,
          });
          updated++;
        } else {
          await prisma.listing.create({
            data: {
              tenant_id: this.tenantId,
              marketplace: Marketplace.mercadolivre,
              listing_id_ext: item.id,
              ...listingData,
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
  /**
   * Reconcilia status de um listing específico com o status real no Mercado Livre
   * 
   * @param listingIdExt ID externo do listing (ex: MLB4167251409)
   * @returns Status real do listing ou null se não encontrado/erro
   */
  async reconcileSingleListingStatus(listingIdExt: string): Promise<{ status: ListingStatus | null; updated: boolean; error?: string }> {
    try {
      // 1. Carregar conexão e garantir token válido
      await this.loadConnection();
      await this.ensureValidToken();

      // 2. Buscar listing no DB
      const listing = await prisma.listing.findFirst({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          listing_id_ext: listingIdExt,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!listing) {
        return { status: null, updated: false, error: 'Listing não encontrado no DB' };
      }

      // 3. Buscar status real via GET /items/:id
      const items = await this.fetchItemsDetails([listingIdExt]);
      
      if (items.length === 0) {
        return { status: null, updated: false, error: 'Listing não encontrado no ML' };
      }

      const realStatus = this.mapMLStatusToListingStatus(items[0].status);

      // 4. Atualizar se diferente
      if (realStatus !== listing.status) {
        await prisma.listing.update({
          where: { id: listing.id },
          data: { status: realStatus },
        });
        console.log(`[ML-SYNC-RECONCILE] Listing ${listingIdExt} atualizado: ${listing.status} → ${realStatus}`);
        return { status: realStatus, updated: true };
      }

      return { status: realStatus, updated: false };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[ML-SYNC-RECONCILE] Erro ao reconciliar listing ${listingIdExt}:`, errorMsg);
      return { status: null, updated: false, error: errorMsg };
    }
  }

  /**
   * Reconcilia status de listings com o status real no Mercado Livre
   * Busca listings da conexão ativa e atualiza status via GET /items/:id
   * 
   * @param onlyNonActive Se true, reconcilia apenas listings com status != active (otimização)
   * @returns Detalhes da reconciliação incluindo lista de listings processados
   */
  async reconcileListingStatus(onlyNonActive: boolean = true): Promise<{ 
    candidates: number;
    checked: number;
    updated: number;
    blockedByPolicy: number;
    unauthorized: number;
    skipped: number;
    errors: string[];
    details: ReconcileDetail[];
  }> {
    const result = { 
      candidates: 0,
      checked: 0,
      updated: 0,
      blockedByPolicy: 0,
      unauthorized: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as ReconcileDetail[],
    };

    try {
      // 1. Carregar conexão e garantir token válido
      await this.loadConnection();
      await this.ensureValidToken();

      // 2. Buscar conexão ativa mais recente
      const activeConnection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: this.tenantId,
          type: Marketplace.mercadolivre,
          status: ConnectionStatus.active,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      if (!activeConnection) {
        console.log(`[ML-SYNC-RECONCILE] Nenhuma conexão ativa encontrada para tenant ${this.tenantId}`);
        return result;
      }

      // 3. Buscar listings da conexão ativa que precisam reconciliação
      // Candidatos: paused OU access_status != accessible (para reconciliar bloqueios também)
      const whereClause: any = {
        tenant_id: this.tenantId,
        marketplace: Marketplace.mercadolivre,
        marketplace_connection_id: activeConnection.id,
      };

      if (onlyNonActive) {
        // Reconciliar: paused OU access_status != accessible (para verificar se desbloqueou)
        whereClause.OR = [
          { status: { not: ListingStatus.active } },
          { access_status: { not: ListingAccessStatus.accessible } },
        ];
      }

      const listings = await prisma.listing.findMany({
        where: whereClause,
        select: {
          id: true,
          listing_id_ext: true,
          status: true,
          access_status: true, // Para verificar se precisa limpar bloqueio
          access_blocked_code: true,
          access_blocked_reason: true,
          access_blocked_at: true,
        },
      });

      result.candidates = listings.length;
      console.log(`[ML-SYNC-RECONCILE] Encontrados ${listings.length} candidatos para reconciliar (conexão: ${activeConnection.id}, provider: ${activeConnection.provider_account_id})`);

      if (listings.length === 0) {
        return result;
      }

      // 4. Processar em lotes de 20 (limite da API ML)
      const chunks = this.chunkArray(listings, 20);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[ML-SYNC-RECONCILE] Processando lote ${i + 1}/${chunks.length} (${chunk.length} listings)`);

        try {
          // Buscar status real via GET /items/:id (batch)
          const itemIds = chunk.map(l => l.listing_id_ext);
          
          // Instrumentação: logar request
          console.log(`[ML-SYNC-RECONCILE] Request GET /items?ids=... para ${itemIds.length} listings: [${itemIds.slice(0, 3).join(', ')}${itemIds.length > 3 ? '...' : ''}]`);
          
          // Declarar maps no escopo do try para serem acessíveis no loop de listings
          const statusMap = new Map<string, { status: ListingStatus; mlStatusRaw: string; httpStatus: number }>();
          const errorMap = new Map<string, { code: number; errorCode?: string; blockedBy?: string; message?: string }>();
          let batchHttpStatus: number | undefined;
          
          try {
            // Batch API retorna array de { code, body } na mesma ordem dos IDs enviados
            // code=200: body contém o item completo com id, status, etc
            // code!=200: body contém erro com code, message, blocked_by (sem id)
            const response = await this.executeWithRetryOn401(async () => {
              return await axios.get(`${ML_API_BASE}/items`, {
                headers: { Authorization: `Bearer ${this.accessToken}` },
                params: { ids: itemIds.join(',') },
              });
            });

            batchHttpStatus = response.status;
            console.log(`[ML-SYNC-RECONCILE] Batch response HTTP ${batchHttpStatus}, processando ${response.data.length} resultados para ${itemIds.length} IDs`);

            // Mapear resultados pelo índice (ordem dos IDs enviados)
            for (let i = 0; i < response.data.length; i++) {
              const itemResponse = response.data[i];
              const itemCode = itemResponse.code;
              const requestedItemId = itemIds[i]; // ID que foi enviado na requisição
              
              if (itemCode === 200) {
                // Sucesso: body contém o item completo
                const itemBody = itemResponse.body as MercadoLivreItem;
                const realStatus = this.mapMLStatusToListingStatus(itemBody.status);
                statusMap.set(requestedItemId, { 
                  status: realStatus, 
                  mlStatusRaw: itemBody.status, 
                  httpStatus: itemCode 
                });
                
                // Logar apenas primeiros 10
                if (result.checked < 10) {
                  console.log(`[ML-SYNC-RECONCILE] Item ${requestedItemId}: HTTP ${itemCode}, status=${itemBody.status} (mapped=${realStatus})`);
                }
              } else {
                // Erro: body contém objeto de erro
                const errorBody = itemResponse.body as any;
                const errorCode = errorBody?.code || errorBody?.error || 'UNKNOWN';
                const blockedBy = errorBody?.blocked_by;
                const message = errorBody?.message || errorBody?.error || 'N/A';
                
                errorMap.set(requestedItemId, {
                  code: itemCode,
                  errorCode,
                  blockedBy,
                  message,
                });
                
                // Logar apenas primeiros 10
                if (result.checked < 10) {
                  console.log(`[ML-SYNC-RECONCILE] Item ${requestedItemId}: HTTP ${itemCode}, code=${errorCode}, blocked_by=${blockedBy || 'N/A'}, message=${message}`);
                }
              }
            }
          } catch (fetchError) {
            if (axios.isAxiosError(fetchError)) {
              batchHttpStatus = fetchError.response?.status;
              console.error(`[ML-SYNC-RECONCILE] Erro HTTP ${batchHttpStatus} ao buscar items:`, fetchError.message);
              // Se for erro de autenticação, marcar todos os listings do lote como erro
              if (batchHttpStatus === 401 || batchHttpStatus === 403) {
                for (const listing of chunk) {
                  result.errors.push(`Erro de autenticação (${batchHttpStatus}) ao reconciliar ${listing.listing_id_ext}`);
                }
              }
            }
            throw fetchError;
          }

          // Atualizar listings com status diferente ou marcar como bloqueado
          for (const listing of chunk) {
            result.checked++;
            
            // Logar informações da conexão (apenas primeiros 10)
            if (result.checked <= 10) {
              console.log(`[ML-SYNC-RECONCILE] Processando listing ${listing.listing_id_ext}: connectionId=${activeConnection.id}, providerAccountId=${activeConnection.provider_account_id}`);
            }
            
            // Verificar se há erro (403 PolicyAgent, 401, etc)
            const errorInfo = errorMap.get(listing.listing_id_ext);
            if (errorInfo) {
              const { code: httpStatus, errorCode, blockedBy, message } = errorInfo;
              
              // Logar erro detalhado (apenas primeiros 10)
              if (result.checked <= 10) {
                console.log(`[ML-SYNC-RECONCILE] Listing ${listing.listing_id_ext}: HTTP ${httpStatus}, code=${errorCode}, blocked_by=${blockedBy || 'N/A'}, message=${message}`);
              }
              
              // Tratar 403 PolicyAgent
              if (httpStatus === 403 && (errorCode === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' || blockedBy === 'PolicyAgent')) {
                try {
                  const updateResult = await prisma.listing.update({
                    where: { id: listing.id },
                    data: {
                      access_status: ListingAccessStatus.blocked_by_policy,
                      access_blocked_code: errorCode || 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',
                      access_blocked_reason: message || 'Anúncio bloqueado por PolicyAgent do Mercado Livre',
                      access_blocked_at: new Date(),
                    },
                  });
                  
                  // Verificar se realmente persistiu
                  const verify = await prisma.listing.findUnique({
                    where: { id: listing.id },
                    select: { 
                      id: true,
                      listing_id_ext: true,
                      access_status: true, 
                      access_blocked_code: true,
                      access_blocked_reason: true,
                      access_blocked_at: true,
                    },
                  });
                  
                  if (verify?.access_status === ListingAccessStatus.blocked_by_policy) {
                    result.blockedByPolicy++;
                    result.details.push({
                      listing_id_ext: listing.listing_id_ext,
                      oldStatus: listing.status,
                      mlStatus: 'BLOCKED_BY_POLICY',
                      updated: false,
                      httpStatus,
                      errorCode,
                      blockedBy,
                      message,
                      actionTaken: 'marked_blocked_by_policy',
                    });
                    console.log(`[ML-SYNC-RECONCILE] 🔒 Listing ${listing.listing_id_ext} marcado como blocked_by_policy: code=${errorCode}, persisted=${verify.access_status === ListingAccessStatus.blocked_by_policy}`);
                  } else {
                    throw new Error(`Update não persistiu: esperado blocked_by_policy, recebido ${verify?.access_status}`);
                  }
                } catch (updateError) {
                  const errorMsg = `Erro ao marcar listing ${listing.listing_id_ext} como blocked: ${updateError instanceof Error ? updateError.message : 'Erro desconhecido'}`;
                  console.error(`[ML-SYNC-RECONCILE] ❌ ${errorMsg}`);
                  result.errors.push(errorMsg);
                }
                continue;
              }
              
              // Tratar 401/403 de autenticação (não PolicyAgent)
              if (httpStatus === 401 || (httpStatus === 403 && errorCode !== 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' && blockedBy !== 'PolicyAgent')) {
                try {
                  const updateResult = await prisma.listing.update({
                    where: { id: listing.id },
                    data: {
                      access_status: ListingAccessStatus.unauthorized,
                      access_blocked_code: errorCode || String(httpStatus),
                      access_blocked_reason: message || 'Erro de autenticação/autorização',
                      access_blocked_at: new Date(),
                    },
                  });
                  
                  result.unauthorized++;
                  result.details.push({
                    listing_id_ext: listing.listing_id_ext,
                    oldStatus: listing.status,
                    mlStatus: 'UNAUTHORIZED',
                    updated: false,
                    httpStatus,
                    errorCode,
                    message,
                    actionTaken: 'marked_unauthorized',
                  });
                  console.log(`[ML-SYNC-RECONCILE] 🔐 Listing ${listing.listing_id_ext} marcado como unauthorized: code=${errorCode}`);
                } catch (updateError) {
                  const errorMsg = `Erro ao marcar listing ${listing.listing_id_ext} como unauthorized: ${updateError instanceof Error ? updateError.message : 'Erro desconhecido'}`;
                  console.error(`[ML-SYNC-RECONCILE] ❌ ${errorMsg}`);
                  result.errors.push(errorMsg);
                }
                continue;
              }
              
              // Outros erros (404, 500, etc): apenas logar e pular
              result.skipped++;
              result.details.push({
                listing_id_ext: listing.listing_id_ext,
                oldStatus: listing.status,
                mlStatus: httpStatus === 404 ? 'NOT_FOUND' : 'ERROR',
                updated: false,
                httpStatus,
                errorCode,
                blockedBy,
                message,
                actionTaken: 'skipped',
              });
              continue;
            }
            
            // Listing encontrado com sucesso (200)
            const statusInfo = statusMap.get(listing.listing_id_ext);
            
            if (!statusInfo) {
              // Não deveria acontecer se o parsing estiver correto, mas tratar como erro
              result.skipped++;
              result.details.push({
                listing_id_ext: listing.listing_id_ext,
                oldStatus: listing.status,
                mlStatus: 'NOT_FOUND',
                updated: false,
                httpStatus: 404,
                actionTaken: 'skipped',
              });
              console.log(`[ML-SYNC-RECONCILE] ⚠️ Listing ${listing.listing_id_ext} não encontrado nos mapas (erro de parsing?)`);
              continue;
            }

            const { status: realStatus, mlStatusRaw, httpStatus } = statusInfo;
            
            // Instrumentação: logar para cada listing (apenas primeiros 10 para não poluir)
            if (result.checked <= 10) {
              console.log(`[ML-SYNC-RECONCILE] Listing ${listing.listing_id_ext}: DB=${listing.status}, ML=${mlStatusRaw} (mapped=${realStatus}), HTTP=${httpStatus}`);
            }
            
            if (realStatus !== listing.status) {
              try {
                const updateResult = await prisma.listing.update({
                  where: { id: listing.id },
                  data: { 
                    status: realStatus,
                    // Se estava bloqueado e agora está acessível, limpar bloqueio
                    access_status: ListingAccessStatus.accessible,
                    access_blocked_code: null,
                    access_blocked_reason: null,
                    access_blocked_at: null,
                  },
                });
                
                result.updated++;
                result.details.push({
                  listing_id_ext: listing.listing_id_ext,
                  oldStatus: listing.status,
                  mlStatus: mlStatusRaw,
                  updated: true,
                  httpStatus,
                  actionTaken: 'updated_status',
                });
                if (result.updated <= 10) {
                  console.log(`[ML-SYNC-RECONCILE] ✅ Listing ${listing.listing_id_ext} atualizado: ${listing.status} → ${realStatus} (ML: ${mlStatusRaw})`);
                }
              } catch (updateError) {
                const errorMsg = `Erro ao atualizar listing ${listing.listing_id_ext}: ${updateError instanceof Error ? updateError.message : 'Erro desconhecido'}`;
                console.error(`[ML-SYNC-RECONCILE] ❌ ${errorMsg}`);
                result.errors.push(errorMsg);
                result.details.push({
                  listing_id_ext: listing.listing_id_ext,
                  oldStatus: listing.status,
                  mlStatus: mlStatusRaw,
                  updated: false,
                  httpStatus,
                });
              }
            } else {
              // Status já está correto, mas verificar se precisa limpar bloqueio
              if (listing.access_status && listing.access_status !== ListingAccessStatus.accessible) {
                try {
                  await prisma.listing.update({
                    where: { id: listing.id },
                    data: {
                      access_status: ListingAccessStatus.accessible,
                      access_blocked_code: null,
                      access_blocked_reason: null,
                      access_blocked_at: null,
                    },
                  });
                } catch (updateError) {
                  // Não crítico, apenas logar
                  console.warn(`[ML-SYNC-RECONCILE] Erro ao limpar bloqueio de ${listing.listing_id_ext}: ${updateError instanceof Error ? updateError.message : 'Erro desconhecido'}`);
                }
              }
              
              result.details.push({
                listing_id_ext: listing.listing_id_ext,
                oldStatus: listing.status,
                mlStatus: mlStatusRaw,
                updated: false,
                httpStatus,
                actionTaken: listing.access_status && listing.access_status !== ListingAccessStatus.accessible ? 'cleared_block' : 'none',
              });
            }
          }
        } catch (error) {
          const errorMsg = `Erro no lote ${i + 1}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          console.error(`[ML-SYNC-RECONCILE] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      console.log(`[ML-SYNC-RECONCILE] Reconciliação concluída: ${result.candidates} candidatos, ${result.checked} verificados, ${result.updated} atualizados, ${result.blockedByPolicy} bloqueados por policy, ${result.unauthorized} unauthorized, ${result.skipped} pulados, ${result.errors.length} erros`);
      if (result.details.length > 0) {
        console.log(`[ML-SYNC-RECONCILE] Detalhes (amostra dos primeiros 10):`, JSON.stringify(result.details.slice(0, 10), null, 2));
      }
      return result;
    } catch (error) {
      const errorMsg = `Erro fatal na reconciliação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      console.error(`[ML-SYNC-RECONCILE] ${errorMsg}`);
      result.errors.push(errorMsg);
      return result;
    }
  }

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

  /**
   * Fallback: Busca listings via Orders API quando discovery/search está bloqueado
   * Busca orders dos últimos 30-60 dias, extrai item IDs e faz upsert
   */
  private async fallbackViaOrders(): Promise<{
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    ordersFound: number;
    uniqueItemIds: number;
  }> {
    const result = {
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      ordersFound: 0,
      uniqueItemIds: 0,
    };

    try {
      console.log(`[ML-SYNC-FALLBACK] Iniciando fallback via Orders tenantId=${this.tenantId} sellerId=${this.providerAccountId}`);

      // 1. Buscar orders dos últimos 60 dias (período maior para garantir cobertura)
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 60);
      dateFrom.setHours(0, 0, 0, 0);
      const dateFromISO = dateFrom.toISOString();

      console.log(`[ML-SYNC-FALLBACK] Buscando orders desde ${dateFromISO} tenantId=${this.tenantId} sellerId=${this.providerAccountId}`);

      // 2. Buscar orders via Orders API
      interface MLOrderItem {
        item: { id: string; title: string };
        quantity: number;
        unit_price: number;
      }

      interface MLOrder {
        id: number;
        order_items: MLOrderItem[];
      }

      interface MLOrdersSearchResponse {
        results: MLOrder[];
        paging: { total: number; offset: number; limit: number };
      }

      const allOrders: MLOrder[] = [];
      let offset = 0;
      const limit = 50;

      while (true) {
        const response = await this.executeWithRetryOn401(async () => {
          return await axios.get<MLOrdersSearchResponse>(`${ML_API_BASE}/orders/search`, {
            headers: { Authorization: `Bearer ${this.accessToken}` },
            params: {
              seller: this.providerAccountId,
              'order.date_created.from': dateFromISO,
              sort: 'date_desc',
              offset,
              limit,
            },
          });
        });

        allOrders.push(...response.data.results);
        result.ordersFound = allOrders.length;

        console.log(`[ML-SYNC-FALLBACK] Progresso tenantId=${this.tenantId} sellerId=${this.providerAccountId} ordersFound=${allOrders.length} total=${response.data.paging.total}`);

        if (offset + limit >= response.data.paging.total || response.data.paging.total === 0) {
          break;
        }

        offset += limit;
      }

      console.log(`[ML-SYNC-FALLBACK] Total de orders encontrados: ${allOrders.length} tenantId=${this.tenantId} sellerId=${this.providerAccountId}`);

      if (allOrders.length === 0) {
        console.log(`[ML-SYNC-FALLBACK] Nenhum order encontrado, não é possível fazer fallback tenantId=${this.tenantId} sellerId=${this.providerAccountId}`);
        return result;
      }

      // 3. Extrair item IDs únicos dos orders
      const itemIdSet = new Set<string>();
      for (const order of allOrders) {
        for (const orderItem of order.order_items || []) {
          if (orderItem.item?.id) {
            itemIdSet.add(orderItem.item.id);
          }
        }
      }

      const uniqueItemIds = Array.from(itemIdSet);
      result.uniqueItemIds = uniqueItemIds.length;

      console.log(`[ML-SYNC-FALLBACK] Item IDs únicos extraídos: ${uniqueItemIds.length} tenantId=${this.tenantId} sellerId=${this.providerAccountId} ordersFound=${allOrders.length}`);

      if (uniqueItemIds.length === 0) {
        console.log(`[ML-SYNC-FALLBACK] Nenhum item ID encontrado nos orders tenantId=${this.tenantId} sellerId=${this.providerAccountId}`);
        return result;
      }

      // 4. Buscar detalhes de cada item e fazer upsert
      const chunks = this.chunkArray(uniqueItemIds, 20); // Processar em lotes de 20
      console.log(`[ML-SYNC-FALLBACK] Processando ${chunks.length} lotes de até 20 itens tenantId=${this.tenantId} sellerId=${this.providerAccountId}`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[ML-SYNC-FALLBACK] Processando lote ${i + 1}/${chunks.length} (${chunk.length} itens) tenantId=${this.tenantId} sellerId=${this.providerAccountId}`);

        try {
          const items = await this.fetchItemsDetails(chunk);
          // Fallback via Orders: source = "orders_fallback", discoveryBlocked = true
          const { created, updated } = await this.upsertListings(items, 'orders_fallback', true);

          result.itemsProcessed += items.length;
          result.itemsCreated += created;
          result.itemsUpdated += updated;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          console.error(`[ML-SYNC-FALLBACK] Erro no lote ${i + 1}:`, errorMsg);
        }
      }

      console.log(`[ML-SYNC-FALLBACK] Fallback concluído tenantId=${this.tenantId} sellerId=${this.providerAccountId} ordersFound=${result.ordersFound} uniqueItemIds=${result.uniqueItemIds} itemsProcessed=${result.itemsProcessed} itemsCreated=${result.itemsCreated} itemsUpdated=${result.itemsUpdated}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido no fallback';
      console.error(`[ML-SYNC-FALLBACK] Erro fatal no fallback via Orders:`, errorMsg);
      throw error;
    }
  }

  /**
   * Sincroniza métricas diárias dos anúncios do Mercado Livre
   * 
   * Busca pedidos pagos dos últimos periodDays e persiste série diária real
   * em listing_metrics_daily, agregando por listing e por dia usando payment.date_approved.
   * 
   * @param tenantId Tenant ID (requerido para rebuild com intervalo customizado)
   * @param dateFrom Data inicial do range (inclusive)
   * @param dateTo Data final do range (inclusive)
   * @param periodDays Período em dias para contexto (padrão: 30)
   */
  async syncListingMetricsDaily(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    periodDays: number = 30
  ): Promise<{
    success: boolean;
    listingsProcessed: number;
    metricsCreated: number;
    rowsUpserted: number;
    min_date: string | null;
    max_date: string | null;
    errors: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    const result = {
      success: false,
      listingsProcessed: 0,
      metricsCreated: 0,
      rowsUpserted: 0,
      min_date: null as string | null,
      max_date: null as string | null,
      errors: [] as string[],
      duration: 0,
    };

    try {
      // Normalizar datas para UTC midnight
      const today = new Date(dateTo);
      today.setUTCHours(0, 0, 0, 0);
      
      const fromDate = new Date(dateFrom);
      fromDate.setUTCHours(0, 0, 0, 0);

      // Gerar array de dias do range (inclusive)
      const dayStrings: string[] = [];
      const currentDate = new Date(fromDate);
      while (currentDate <= today) {
        const dayStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
        dayStrings.push(dayStr);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      console.log(`[ML-METRICS] Iniciando sync de métricas diárias para tenant: ${tenantId}`);
      console.log(`[ML-METRICS] Range: ${dayStrings[0]} até ${dayStrings[dayStrings.length - 1]} (${dayStrings.length} dias)`);

      // 1. Carregar conexão e garantir token válido
      await this.loadConnection();
      await this.ensureValidToken();

      // 2. Buscar todos os listings ativos do tenant
      // Buscar conexão ativa mais recente para filtrar listings
      const activeConnection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: Marketplace.mercadolivre,
          status: ConnectionStatus.active,
        },
        orderBy: {
          created_at: 'desc', // Mais recente primeiro
        },
      });

      // Filtrar listings apenas da conexão ativa
      // IMPORTANTE: Incluir active E paused para processar ambos (paused pode ter visits/orders)
      const listingsWhere: any = {
        tenant_id: tenantId,
        marketplace: Marketplace.mercadolivre,
        status: { in: [ListingStatus.active, ListingStatus.paused] }, // Processar active e paused
      };

      if (activeConnection) {
        listingsWhere.marketplace_connection_id = activeConnection.id;
        console.log(`[ML-METRICS] Filtrando listings pela conexão ativa: ${activeConnection.id} (provider: ${activeConnection.provider_account_id})`);
      } else {
        console.log(`[ML-METRICS] ⚠️  Nenhuma conexão ativa encontrada, processando todos os listings`);
      }

      const listings = await prisma.listing.findMany({
        where: listingsWhere,
      });

      console.log(`[ML-METRICS] Encontrados ${listings.length} anúncios ativos/pausados acessíveis${activeConnection ? ` (conexão: ${activeConnection.id})` : ''}`);

      if (listings.length === 0) {
        result.success = true;
        result.min_date = dayStrings[0] || null;
        result.max_date = dayStrings[dayStrings.length - 1] || null;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. Buscar pedidos pagos do período do banco de dados (order_items + orders)
      // Usar dados já persistidos para garantir consistência e performance
      console.log(`[ML-METRICS] Buscando pedidos pagos do banco desde ${fromDate.toISOString()} até ${today.toISOString()}...`);

      // Buscar order_items com JOIN em orders para filtrar por tenant e status
      // Agregar por listing_id e por dia usando paid_date (ou order_date como fallback)
      const orderItems = await prisma.orderItem.findMany({
        where: {
          order: {
            tenant_id: tenantId,
            marketplace: Marketplace.mercadolivre,
            status: { in: [OrderStatus.paid, OrderStatus.shipped, OrderStatus.delivered] },
            order_date: {
              gte: fromDate,
              lte: today,
            },
          },
          listing_id: { not: null }, // Apenas items com listing_id preenchido
        },
        include: {
          order: {
            select: {
              id: true,
              paid_date: true,
              order_date: true,
            },
          },
        },
      });

      console.log(`[ML-METRICS] Encontrados ${orderItems.length} order_items no período`);

      // 4. Agregar por listing_id e por dia
      // Estrutura: Map<listingId, Map<dayStr, { orders: number, gmv: number }>>
      const metricsByListingAndDay = new Map<string, Map<string, { orders: number; gmv: number }>>();
      
      for (const orderItem of orderItems) {
        if (!orderItem.listing_id) continue; // Pular items sem listing_id (não deveria acontecer após backfill)

        // Usar paid_date se disponível, senão order_date como fallback
        const orderDate = orderItem.order.paid_date || orderItem.order.order_date;
        const paymentDate = new Date(orderDate);
        paymentDate.setUTCHours(0, 0, 0, 0);
        const dayStr = paymentDate.toISOString().split('T')[0];

        // Verificar se o dia está no range
        if (!dayStrings.includes(dayStr)) {
          continue; // Pular dias fora do range
        }

        // Agregar por listing_id e dia
        if (!metricsByListingAndDay.has(orderItem.listing_id)) {
          metricsByListingAndDay.set(orderItem.listing_id, new Map());
        }
        
        const dayMap = metricsByListingAndDay.get(orderItem.listing_id)!;
        const existing = dayMap.get(dayStr) || { orders: 0, gmv: 0 };
        
        existing.orders += orderItem.quantity;
        existing.gmv += Number(orderItem.total_price); // Usar total_price já calculado
        
        dayMap.set(dayStr, existing);
      }

      console.log(`[ML-METRICS] Agregados ${metricsByListingAndDay.size} listings com métricas`);

      // 5. Para cada listing, fazer UPSERT para cada dia do range
      const upsertPromises: Promise<void>[] = [];
      
      for (const listing of listings) {
        // Usar listing.id em vez de listing_id_ext (agora agregamos por listing_id)
        const dayMap = metricsByListingAndDay.get(listing.id) || new Map();
        
        for (const dayStr of dayStrings) {
          const dayMetrics = dayMap.get(dayStr) || { orders: 0, gmv: 0 };
          const dayDate = new Date(dayStr + 'T00:00:00.000Z');

          // Criar promise de UPSERT
          upsertPromises.push(
            prisma.listingMetricsDaily.upsert({
              where: {
                tenant_id_listing_id_date: {
                  tenant_id: tenantId,
                  listing_id: listing.id,
                  date: dayDate,
                },
              },
              create: {
                tenant_id: tenantId,
                listing_id: listing.id,
                date: dayDate,
                visits: null, // Não inventar dados
                orders: dayMetrics.orders,
                gmv: dayMetrics.gmv,
                conversion: null, // Sem visits, não calcular conversão
                impressions: null, // Não inventar dados
                clicks: null, // Não inventar dados
                ctr: null, // Não inventar dados
                source: 'ml_orders_daily',
                period_days: periodDays,
              },
              update: {
                visits: null, // Não inventar dados
                orders: dayMetrics.orders,
                gmv: dayMetrics.gmv,
                conversion: null, // Sem visits, não calcular conversão
                impressions: null, // Não inventar dados
                clicks: null, // Não inventar dados
                ctr: null, // Não inventar dados
                source: 'ml_orders_daily',
                period_days: periodDays,
              },
            }).then(() => {
              result.rowsUpserted++;
            }).catch((error) => {
              const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
              result.errors.push(`Listing ${listing.id} dia ${dayStr}: ${errorMsg}`);
              console.error(`[ML-METRICS] Erro ao fazer UPSERT para listing ${listing.id} dia ${dayStr}:`, errorMsg);
            })
          );
        }
        
        result.listingsProcessed++;
      }

      // Executar UPSERTs em batch com limite de concorrência (evitar saturar DB)
      const BATCH_SIZE = 50;
      for (let i = 0; i < upsertPromises.length; i += BATCH_SIZE) {
        const batch = upsertPromises.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch);
      }

      // Atualizar min_date e max_date
      result.min_date = dayStrings[0] || null;
      result.max_date = dayStrings[dayStrings.length - 1] || null;

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      console.log(`[ML-METRICS] Sync concluído em ${result.duration}ms`);
      console.log(`[ML-METRICS] Processados: ${result.listingsProcessed} listings, ${dayStrings.length} dias`);
      console.log(`[ML-METRICS] Rows upserted: ${result.rowsUpserted} (esperado: ~${result.listingsProcessed * dayStrings.length})`);
      console.log(`[ML-METRICS] Range: ${result.min_date} até ${result.max_date}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-METRICS] Erro fatal no sync de métricas:', errorMsg);
      return result;
    }
  }

  /**
   * Sincroniza listings extraindo itemIds dos pedidos (fallback quando discovery está bloqueado)
   * 
   * Este método é usado quando o endpoint de discovery (/sites/MLB/search) retorna 403.
   * Extrai itemIds únicos dos pedidos e busca detalhes de cada item via GET /items/{id}.
   * 
   * @param daysBack Número de dias para buscar pedidos (default: 30)
   * @param concurrencyLimit Limite de requisições paralelas (default: 5)
   */
  async syncListingsFromOrders(daysBack: number = 30, concurrencyLimit: number = 5): Promise<{
    success: boolean;
    ordersProcessed: number;
    uniqueItemIds: number;
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    itemsSkipped: number;
    duration: number;
    errors: string[];
    source: string;
  }> {
    const startTime = Date.now();
    const result = {
      success: false,
      ordersProcessed: 0,
      uniqueItemIds: 0,
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      duration: 0,
      errors: [] as string[],
      source: 'orders_fallback',
    };

    try {
      console.log(`[ML-SYNC-FALLBACK] Iniciando sync de listings via orders tenantId=${this.tenantId} daysBack=${daysBack}`);

      // 1. Carregar conexão e garantir token válido
      await this.loadConnection();
      await this.ensureValidToken();

      console.log(`[ML-SYNC-FALLBACK] Conexão carregada tenantId=${this.tenantId} sellerId=${this.providerAccountId}`);

      // 2. Buscar pedidos dos últimos N dias do banco de dados
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - daysBack);

      const orders = await prisma.order.findMany({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          order_date: {
            gte: dateFrom,
          },
        },
        include: {
          items: true,
        },
      });

      result.ordersProcessed = orders.length;
      console.log(`[ML-SYNC-FALLBACK] Pedidos encontrados tenantId=${this.tenantId} ordersProcessed=${orders.length}`);

      if (orders.length === 0) {
        console.log(`[ML-SYNC-FALLBACK] Nenhum pedido encontrado. Tentando buscar da API...`);
        
        // Se não há pedidos no banco, buscar da API primeiro
        const { MercadoLivreOrdersService } = await import('./MercadoLivreOrdersService');
        const ordersService = new MercadoLivreOrdersService(this.tenantId);
        const ordersResult = await ordersService.syncOrders(daysBack);
        
        if (ordersResult.ordersProcessed > 0) {
          // Recarregar pedidos do banco após sync
          const refreshedOrders = await prisma.order.findMany({
            where: {
              tenant_id: this.tenantId,
              marketplace: Marketplace.mercadolivre,
              order_date: {
                gte: dateFrom,
              },
            },
            include: {
              items: true,
            },
          });
          
          result.ordersProcessed = refreshedOrders.length;
          orders.push(...refreshedOrders);
          console.log(`[ML-SYNC-FALLBACK] Pedidos sincronizados da API tenantId=${this.tenantId} ordersProcessed=${refreshedOrders.length}`);
        }
      }

      // 3. Extrair itemIds únicos dos pedidos
      const itemIdsSet = new Set<string>();
      for (const order of orders) {
        for (const item of order.items) {
          if (item.listing_id_ext) {
            itemIdsSet.add(item.listing_id_ext);
          }
        }
      }

      const uniqueItemIds = Array.from(itemIdsSet);
      result.uniqueItemIds = uniqueItemIds.length;

      console.log(`[ML-SYNC-FALLBACK] ItemIds extraídos tenantId=${this.tenantId} uniqueItemIds=${uniqueItemIds.length} sampleIds=[${uniqueItemIds.slice(0, 3).join(',')}]`);

      if (uniqueItemIds.length === 0) {
        console.log(`[ML-SYNC-FALLBACK] Nenhum itemId encontrado nos pedidos`);
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 4. Processar em lotes de 20 (limite da API multiget)
      const chunks = this.chunkArray(uniqueItemIds, 20);
      console.log(`[ML-SYNC-FALLBACK] Processando ${chunks.length} lotes de até 20 itens`);

      // Processar lotes com controle de concorrência simples
      for (let i = 0; i < chunks.length; i += concurrencyLimit) {
        const batchChunks = chunks.slice(i, i + concurrencyLimit);
        
        const batchResults = await Promise.allSettled(
          batchChunks.map(async (chunk, batchIndex) => {
            const chunkIndex = i + batchIndex;
            console.log(`[ML-SYNC-FALLBACK] Processando lote ${chunkIndex + 1}/${chunks.length} (${chunk.length} itens)`);
            
            try {
              const items = await this.fetchItemsDetails(chunk);
              const { created, updated } = await this.upsertListings(items);
              
              return {
                processed: items.length,
                created,
                updated,
                skipped: chunk.length - items.length,
              };
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
              throw new Error(`Lote ${chunkIndex + 1}: ${errorMsg}`);
            }
          })
        );

        // Agregar resultados
        for (const batchResult of batchResults) {
          if (batchResult.status === 'fulfilled') {
            result.itemsProcessed += batchResult.value.processed;
            result.itemsCreated += batchResult.value.created;
            result.itemsUpdated += batchResult.value.updated;
            result.itemsSkipped += batchResult.value.skipped;
          } else {
            result.errors.push(batchResult.reason?.message || 'Erro desconhecido no lote');
            console.error(`[ML-SYNC-FALLBACK] Erro no lote:`, batchResult.reason);
          }
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      // Log estruturado final
      console.log(`[ML-SYNC-FALLBACK] Sync concluído tenantId=${this.tenantId} sellerId=${this.providerAccountId} durationMs=${result.duration} ordersProcessed=${result.ordersProcessed} uniqueItemIds=${result.uniqueItemIds} itemsProcessed=${result.itemsProcessed} itemsCreated=${result.itemsCreated} itemsUpdated=${result.itemsUpdated} itemsSkipped=${result.itemsSkipped} errorsCount=${result.errors.length} source=${result.source}`);

      // 5. Gerar recomendações para os anúncios sincronizados
      if (result.itemsCreated > 0 || result.itemsUpdated > 0) {
        try {
          console.log('[ML-SYNC-FALLBACK] Gerando recomendações...');
          const recommendationService = new RecommendationService(this.tenantId);
          const recResult = await recommendationService.generateForAllListings();
          console.log(`[ML-SYNC-FALLBACK] Recomendações geradas: ${recResult.totalRecommendations} para ${recResult.totalListings} anúncios`);
        } catch (recError) {
          console.error('[ML-SYNC-FALLBACK] Erro ao gerar recomendações (não crítico):', recError);
        }
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-SYNC-FALLBACK] Erro fatal no sync via orders:', errorMsg);
      return result;
    }
  }

  /**
   * Verifica se um erro é um erro 403 de discovery bloqueado
   */
  static isDiscoveryBlockedError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      return error.response?.status === 403;
    }
    if (error instanceof Error) {
      return error.message.includes('403') || error.message.includes('PolicyAgent');
    }
    return false;
  }
}

