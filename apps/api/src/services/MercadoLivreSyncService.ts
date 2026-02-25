import axios, { AxiosError } from 'axios';
import { PrismaClient, Marketplace, ConnectionStatus, ListingStatus, OrderStatus, ListingAccessStatus } from '@prisma/client';
import { ScoreCalculator } from './ScoreCalculator';
import { RecommendationService } from './RecommendationService';
import { extractHasVideoFromMlItem } from '../utils/ml-video-extractor';
import { resolveMercadoLivreConnection } from '../utils/ml-connection-resolver';
import { getValidAccessToken } from '../utils/ml-token-helper';
import { extractBuyerPricesFromMlPrices, applyBuyerPricesOverrideFromMlPrices } from '../utils/ml-prices-extractor';
import { shouldFetchMlPricesForPromo, getPromoPricesTtlHours } from '../utils/ml-prices-ttl';
import { getBooleanEnv } from '../utils/env-parser';

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
  // Campos de preços estruturados (API do ML)
  prices?: {
    prices?: Array<{
      id?: string;
      type?: string;
      amount?: number;
      regular_amount?: number;
      currency_id?: string;
      conditions?: {
        context_restrictions?: string[];
        start_time?: string;
        end_time?: string;
      };
    }>;
  };
  reference_prices?: Array<{
    id?: string;
    type?: string;
    conditions?: {
      context_restrictions?: string[];
      start_time?: string;
      end_time?: string;
    };
    amount?: number;
    currency_id?: string;
  }>;
  // Promoções ativas
  promotions?: Array<{
    id?: string;
    type?: string;
    discount_percent?: number;
    start_date?: string;
    end_date?: string;
  }>;
  deal_ids?: string[];
  variations?: Array<{ id?: string; [key: string]: any }>; // Variações do anúncio (cores, tamanhos, etc)
  _enrichmentMeta?: {
    endpointUsed: 'prices' | 'items' | 'none';
    statusCode: number;
    payloadSize: number;
    reason?: 'ttl_not_expired' | 'flag_off' | 'promo_not_effective' | 'fetch_failed' | 'no_prices_available';
  };
}


// HOTFIX 09.13: Interface para debug de campos de vídeo
export interface VideoFieldsDebugInfo {
  endpointUsed: string;
  mlFieldsSummary: {
    hasVideoId: boolean;
    videoIdType: string;
    hasVideosArray: boolean;
    videosCount: number | null;
    hasAttributesVideo: boolean;
    rawKeys: string[];
  };
  fallbackTried: boolean;
  fallbackEndpoint?: string;
  fallbackHadVideoId?: boolean;
  fallbackVideosCount?: number | null;
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
   * Busca a conexão do Mercado Livre para o tenant usando resolver centralizado
   */
  private async loadConnection(): Promise<void> {
    console.log(`[ML-SYNC] ========== BUSCANDO CONEXÃO ==========`);
    console.log(`[ML-SYNC] Tenant ID: ${this.tenantId}`);

    // Usar resolver centralizado para seleção determinística
    const resolved = await resolveMercadoLivreConnection(this.tenantId);
    
    this.connectionId = resolved.connection.id;
    this.providerAccountId = resolved.connection.provider_account_id;

    console.log(`[ML-SYNC] ✅ Conexão carregada: Provider ${this.providerAccountId}, ConnectionId=${this.connectionId}, Reason=${resolved.reason}`);
  }

  /**
   * Obtém informações da conexão (método público para uso externo)
   * Carrega a conexão se ainda não foi carregada
   * @returns Objeto com connectionId e providerAccountId
   */
  public async getConnectionInfo(): Promise<{ connectionId: string; providerAccountId: string }> {
    if (!this.connectionId) {
      await this.loadConnection();
    }
    return {
      connectionId: this.connectionId,
      providerAccountId: this.providerAccountId,
    };
  }

  /**
   * Debug controlado: busca preços via /items/{id}/prices com diagnóstico detalhado
   * Só deve ser chamado quando debugPrices=true e listingIdExt específico
   */
  public async debugFetchPrices(itemId: string): Promise<{
    listingIdExt: string;
    attemptedAt: string;
    url: string;
    statusCode: number;
    blockedBy?: string;
    code?: string;
    message?: string;
    headers?: {
      retryAfter?: string;
      rateLimit?: string;
      contentType?: string;
    };
    body?: any; // Truncado ou subset relevante
    error?: string;
  }> {
    await this.ensureInitializedForMlCall();
    
    const url = `${ML_API_BASE}/items/${itemId}/prices`;
    const attemptedAt = new Date().toISOString();
    
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
          'User-Agent': 'SuperSellerIA/1.0',
        },
        timeout: 10000, // 10s timeout
      });

      const statusCode = response.status;
      const responseHeaders = response.headers;
      
      // Extrair headers relevantes (whitelisted)
      const relevantHeaders: any = {};
      if (responseHeaders['retry-after']) relevantHeaders.retryAfter = responseHeaders['retry-after'];
      if (responseHeaders['x-ratelimit-limit']) relevantHeaders.rateLimit = responseHeaders['x-ratelimit-limit'];
      if (responseHeaders['content-type']) relevantHeaders.contentType = responseHeaders['content-type'];

      // Truncar body para evitar payload muito grande
      const rawBody = response.data;
      let body: any = null;
      
      if (rawBody) {
        // Incluir apenas campos-chave para debug
        body = {
          prices: Array.isArray(rawBody.prices) ? rawBody.prices.slice(0, 3).map((p: any) => ({
            type: p.type,
            amount: p.amount,
            regular_amount: p.regular_amount,
            currency_id: p.currency_id,
          })) : null,
          reference_prices: Array.isArray(rawBody.reference_prices) ? rawBody.reference_prices.slice(0, 2).map((p: any) => ({
            type: p.type,
            amount: p.amount,
            currency_id: p.currency_id,
          })) : null,
          purchase_discounts: Array.isArray(rawBody.purchase_discounts) ? rawBody.purchase_discounts.slice(0, 2) : null,
        };
      }

      return {
        listingIdExt: itemId,
        attemptedAt,
        url,
        statusCode,
        headers: relevantHeaders,
        body,
      };
    } catch (error: any) {
      const statusCode = error.response?.status || 0;
      const errorCode = error.response?.data?.code || error.code;
      const errorMessage = error.response?.data?.message || error.message || 'Erro desconhecido';
      
      // Detectar PolicyAgent
      let blockedBy: string | undefined;
      if (errorCode === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' || errorMessage.includes('PolicyAgent')) {
        blockedBy = 'PolicyAgent';
      } else if (statusCode === 403) {
        blockedBy = '403_Forbidden';
      } else if (statusCode === 429) {
        blockedBy = 'RateLimit';
      }

      const responseHeaders = error.response?.headers || {};
      const relevantHeaders: any = {};
      if (responseHeaders['retry-after']) relevantHeaders.retryAfter = responseHeaders['retry-after'];
      if (responseHeaders['x-ratelimit-limit']) relevantHeaders.rateLimit = responseHeaders['x-ratelimit-limit'];
      if (responseHeaders['content-type']) relevantHeaders.contentType = responseHeaders['content-type'];

      // Incluir body de erro (truncado)
      let errorBody: any = null;
      if (error.response?.data) {
        const errorData = error.response.data;
        errorBody = {
          code: errorData.code,
          message: errorData.message?.substring(0, 200), // Truncar mensagem
          error: errorData.error?.substring(0, 100),
        };
      }

      return {
        listingIdExt: itemId,
        attemptedAt,
        url,
        statusCode,
        blockedBy,
        code: errorCode,
        message: errorMessage.substring(0, 200),
        headers: relevantHeaders,
        body: errorBody,
        error: errorMessage.substring(0, 200),
      };
    }
  }

  /**
   * Obtém access_token válido usando helper centralizado
   * Não exige refresh_token se access_token ainda é válido
   * @throws Error com código 'AUTH_REVOKED' se o refresh falhar por revogação
   */
  private async ensureValidToken(): Promise<void> {
    const tokenResult = await getValidAccessToken(this.connectionId);
    
    this.accessToken = tokenResult.token;
    
    if (tokenResult.usedRefresh) {
      console.log(`[ML-SYNC] Token renovado connectionId=${this.connectionId} expiresAt=${tokenResult.expiresAt.toISOString()}`);
      
      // Disparar sync completo após renovação bem-sucedida (apenas se não estiver já em sync)
      if (!this.isSyncing) {
        this.triggerFullSyncAfterRefresh().catch((err: unknown) => {
          console.error('[ML-SYNC] Erro ao disparar sync após refresh:', err);
        });
      }
    } else {
      console.log(`[ML-SYNC] Token válido (não renovado) connectionId=${this.connectionId} expiresAt=${tokenResult.expiresAt.toISOString()}`);
    }
  }

  /**
   * Garante que conexão e token estão inicializados antes de chamadas à API ML
   * Útil quando métodos são chamados externamente (ex: rotas) sem passar por syncListings
   */
  private async ensureInitializedForMlCall(): Promise<void> {
    if (!this.connectionId) {
      console.log(`[ML-SYNC] Auto-inicializando conexão para chamada externa tenantId=${this.tenantId}`);
      await this.loadConnection();
    }
    await this.ensureValidToken();
  }


  /**
   * Executa uma função com retry automático em caso de 401 (Unauthorized)
   * Pattern: Tenta executar -> Se 401, garante inicialização e renova token via helper -> Tenta novamente (1x)
   */
  private async executeWithRetryOn401<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log(`[ML-SYNC] Recebido 401. Tentando renovar token e retry connectionId=${this.connectionId || 'não inicializado'}...`);
        
        // Se connectionId vazio, inicializar antes de renovar token
        if (!this.connectionId) {
          console.log(`[ML-SYNC] ConnectionId vazio detectado no retry 401. Inicializando conexão...`);
          await this.loadConnection();
        }
        
        // Renovar token via helper (que já trata refresh_token)
        const tokenResult = await getValidAccessToken(this.connectionId);
        this.accessToken = tokenResult.token;
        
        // Retry da operação original
        console.log(`[ML-SYNC] Token renovado. Executando retry connectionId=${this.connectionId}...`);
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
   * Busca dados de preços/promoção via API de Preços do ML
   * GET /items/{itemId}/prices - endpoint recomendado pelo ML para preços/promoções
   */
  private async fetchItemPrices(itemId: string): Promise<{
    statusCode: number;
    payloadSize: number;
    prices?: Array<{ id?: string; amount?: number; type?: string; regular_amount?: number; currency_id?: string; conditions?: any }>;
    reference_prices?: Array<{ id?: string; amount?: number; type?: string; currency_id?: string }>;
    purchase_discounts?: Array<{ type?: string; amount?: number; discount_percentage?: number }>;
  } | null> {
    try {
      console.log(`[ML-SYNC] Buscando preços/promoção via API de Preços para item ${itemId}`);
      const response = await axios.get(`${ML_API_BASE}/items/${itemId}/prices`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      const raw = response.data;
      const statusCode = response.status;
      const payloadSize = JSON.stringify(raw).length;

      const rawPrices: unknown = raw.prices;
      const pricesArray: Array<{ id?: string; amount?: number; type?: string; regular_amount?: number; currency_id?: string; conditions?: any }> =
        Array.isArray(rawPrices) ? rawPrices : [];

      const refPrices: Array<{ id?: string; amount?: number; type?: string; currency_id?: string }> =
        Array.isArray(raw.reference_prices) ? raw.reference_prices : [];

      const purchaseDiscounts: Array<{ type?: string; amount?: number; discount_percentage?: number }> =
        Array.isArray(raw.purchase_discounts) ? raw.purchase_discounts : [];

      const promoEntry = pricesArray.find(p => p.type === 'promotion');
      const standardEntry = pricesArray.find(p => p.type === 'standard');

      console.log(`[ML-SYNC] /items/${itemId}/prices`, {
        statusCode,
        payloadSize,
        pricesCount: pricesArray.length,
        referencePricesCount: refPrices.length,
        purchaseDiscountsCount: purchaseDiscounts.length,
        hasPromoEntry: !!promoEntry,
        promoAmount: promoEntry?.amount ?? null,
        standardAmount: standardEntry?.amount ?? null,
        regularAmount: promoEntry?.regular_amount ?? standardEntry?.regular_amount ?? null,
      });

      return {
        statusCode,
        payloadSize,
        prices: pricesArray,
        reference_prices: refPrices,
        purchase_discounts: purchaseDiscounts,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        console.log(`[ML-SYNC] /items/${itemId}/prices FAILED`, {
          statusCode: status ?? 0,
          errorMessage: error.message,
        });
      } else {
        console.warn(`[ML-SYNC] /items/${itemId}/prices FAILED (non-axios):`, error instanceof Error ? error.message : 'Erro desconhecido');
      }
      return null;
    }
  }

  /**
   * Enriquece dados de preço/promoção de um item via endpoint adicional se necessário
   * Prioridade: GET /items/{itemId}/prices (API de Preços) > GET /items/{id} (fallback)
   * 
   * @param item Item do Mercado Livre
   * @param existingListing Listing existente no DB (opcional, para verificar TTL)
   * @param forcePromoPrices Se true, ignora TTL e força busca de /prices (default: false)
   */
  private async enrichItemPricing(
    item: MercadoLivreItem,
    existingListing?: { promotion_checked_at: Date | null } | null,
    forcePromoPrices: boolean = false
  ): Promise<MercadoLivreItem> {
    const hasConfirmedPromo =
      (item.original_price !== undefined && item.original_price !== null && item.original_price > 0 && item.original_price !== item.price) ||
      (item.sale_price !== undefined && item.sale_price !== null && item.sale_price > 0 && item.sale_price !== item.price);

    // Verificar se devemos buscar /prices (escalável, baseado em TTL)
    const shouldFetch = shouldFetchMlPricesForPromo(existingListing || null, new Date(), forcePromoPrices);

    if (hasConfirmedPromo && !shouldFetch) {
      // Tem promoção confirmada e TTL ainda válido, não precisa buscar /prices
      const useMlPricesForPromo = getBooleanEnv('USE_ML_PRICES_FOR_PROMO', false);
      const reason = !useMlPricesForPromo ? 'flag_off' : 'ttl_not_expired';
      console.log(`[ML-SYNC] Item ${item.id} já tem promoção confirmada (original_price=${item.original_price}, sale_price=${item.sale_price}), ${reason === 'ttl_not_expired' ? 'TTL ainda válido' : 'flag desativada'}, pulando enriquecimento`);
      // Definir metadata para indicar que pulou
      item._enrichmentMeta = { 
        endpointUsed: 'none', 
        statusCode: 0, 
        payloadSize: 0,
        reason
      };
      return item;
    }

    if (shouldFetch) {
      const reasonText = forcePromoPrices 
        ? 'forçado via forcePromoPrices' 
        : existingListing?.promotion_checked_at 
          ? 'TTL expirado' 
          : 'nunca verificado';
      console.log(`[ML-SYNC] Item ${item.id} ${hasConfirmedPromo ? 'tem promoção via /items, mas' : ''} deve buscar /prices (flag ativa, ${reasonText})`);
    }

    let endpointUsed: 'prices' | 'items' | 'none' = 'none';
    let enrichStatusCode = 0;
    let enrichPayloadSize = 0;

    const pricesData = await this.fetchItemPrices(item.id);

    if (pricesData) {
      endpointUsed = 'prices'; // Sempre "prices" quando chamou /prices
      enrichStatusCode = pricesData.statusCode;
      enrichPayloadSize = pricesData.payloadSize;

      const pricesArr = pricesData.prices ?? [];
      const promoEntry = pricesArr.find(p => p.type === 'promotion');
      const standardEntry = pricesArr.find(p => p.type === 'standard');

      if (promoEntry?.amount && promoEntry.amount > 0) {
        item.sale_price = promoEntry.amount;
      }

      const candidateOriginal =
        promoEntry?.regular_amount ??
        standardEntry?.amount ??
        null;
      if (candidateOriginal && candidateOriginal > 0 && candidateOriginal !== item.sale_price) {
        item.original_price = candidateOriginal;
      }

      if (!item.original_price && pricesData.reference_prices && pricesData.reference_prices.length > 0) {
        const refAmounts = pricesData.reference_prices
          .map(rp => rp.amount)
          .filter((a): a is number => typeof a === 'number' && a > 0);
        if (refAmounts.length > 0) {
          const maxRef = Math.max(...refAmounts);
          if (maxRef > (item.sale_price ?? item.price)) {
            item.original_price = maxRef;
          }
        }
      }

      item.prices = { prices: pricesArr };
      if (pricesData.reference_prices && pricesData.reference_prices.length > 0) {
        item.reference_prices = pricesData.reference_prices;
      }

      console.log(`[ML-SYNC] Item ${item.id} enriquecido via Prices API`, {
        endpointUsed,
        statusCode: enrichStatusCode,
        payloadSize: enrichPayloadSize,
        sale_price: item.sale_price,
        original_price: item.original_price,
        pricesCount: pricesArr.length,
        hasPromoEntry: !!promoEntry,
      });
    } else {
      try {
        console.log(`[ML-SYNC] Tentando fallback GET /items/${item.id}`);
        endpointUsed = 'items';

        const response = await axios.get(`${ML_API_BASE}/items/${item.id}`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });

        enrichStatusCode = response.status;
        enrichPayloadSize = JSON.stringify(response.data).length;

        const enrichedItem = response.data as MercadoLivreItem;

        if (enrichedItem.original_price !== undefined && enrichedItem.original_price !== null) {
          item.original_price = enrichedItem.original_price;
        }
        if (enrichedItem.sale_price !== undefined && enrichedItem.sale_price !== null) {
          item.sale_price = enrichedItem.sale_price;
        }
        if (enrichedItem.base_price !== undefined && enrichedItem.base_price !== null) {
          item.base_price = enrichedItem.base_price;
        }
        if (enrichedItem.prices && !item.prices) {
          item.prices = enrichedItem.prices;
        }
        if (enrichedItem.reference_prices && !item.reference_prices) {
          item.reference_prices = enrichedItem.reference_prices;
        }
        if (enrichedItem.deals && !item.deals) {
          item.deals = enrichedItem.deals;
        }
        if (enrichedItem.promotions && !item.promotions) {
          item.promotions = enrichedItem.promotions;
        }

        console.log(`[ML-SYNC] Item ${item.id} enriquecido via GET /items (fallback)`, {
          endpointUsed,
          statusCode: enrichStatusCode,
          payloadSize: enrichPayloadSize,
          sale_price: item.sale_price,
          original_price: item.original_price,
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          enrichStatusCode = error.response?.status ?? 0;
          console.warn(`[ML-SYNC] Fallback /items/${item.id} falhou`, {
            statusCode: enrichStatusCode,
            errorMessage: error.message,
          });
        } else {
          console.warn(`[ML-SYNC] Fallback /items/${item.id} falhou (non-axios):`, error instanceof Error ? error.message : 'Erro desconhecido');
        }
        endpointUsed = 'none';
      }
    }

    item._enrichmentMeta = { 
      endpointUsed, 
      statusCode: enrichStatusCode, 
      payloadSize: enrichPayloadSize,
      reason: endpointUsed === 'none' ? (shouldFetch ? undefined : (getBooleanEnv('USE_ML_PRICES_FOR_PROMO', false) ? 'ttl_not_expired' : 'flag_off')) : undefined
    };

    console.log(`[ML-SYNC] enrichItemPricing resultado item=${item.id}`, {
      endpointUsed,
      statusCode: enrichStatusCode,
      payloadSize: enrichPayloadSize,
      sale_price: item.sale_price ?? null,
      original_price: item.original_price ?? null,
      base_price: item.base_price ?? null,
      pricesCount: item.prices?.prices ? (Array.isArray(item.prices.prices) ? item.prices.prices.length : 0) : 0,
      referencePricesCount: item.reference_prices ? (Array.isArray(item.reference_prices) ? item.reference_prices.length : 0) : 0,
    });

    return item;
  }

  /**
   * Busca detalhes de múltiplos itens (até 20 por vez)
   * Usa retry automático em caso de 401
   * Também busca descrições completas via endpoint específico
   * Enriquece dados de preço/promoção se necessário
   * 
   * Garante inicialização automática quando chamado externamente (ex: rotas)
   * 
   * @param itemIds IDs dos itens a buscar
   * @param forcePromoPrices Se true, ignora TTL e força busca de /prices para todos os itens (default: false)
   */
  async fetchItemsDetails(itemIds: string[], forcePromoPrices: boolean = false): Promise<MercadoLivreItem[]> {
    if (itemIds.length === 0) return [];
    if (itemIds.length > 20) {
      throw new Error('Máximo de 20 itens por requisição');
    }

    // Garantir que conexão e token estão inicializados antes de chamar API ML
    await this.ensureInitializedForMlCall();

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
        
        // HOTFIX 09.13: Armazenar debug info por item (para uso no import)
        const debugInfoMap = new Map<string, VideoFieldsDebugInfo>();

        // Enriquecer dados de preço/promoção se necessário (com limite de concorrência)
        console.log(`[ML-SYNC] Verificando necessidade de enriquecimento de preços para ${items.length} itens...`);
        const CONCURRENCY_LIMIT = 5;
        const enrichedItems: MercadoLivreItem[] = [];
        
        // Buscar listings existentes para verificar TTL (se não for forcePromoPrices)
        const existingListingsMap = new Map<string, { promotion_checked_at: Date | null }>();
        if (!forcePromoPrices) {
          const existingListings = await prisma.listing.findMany({
            where: {
              tenant_id: this.tenantId,
              marketplace: Marketplace.mercadolivre,
              listing_id_ext: { in: items.map(i => i.id) },
            },
            select: {
              listing_id_ext: true,
              promotion_checked_at: true,
            },
          });
          existingListings.forEach(listing => {
            existingListingsMap.set(listing.listing_id_ext, { promotion_checked_at: listing.promotion_checked_at });
          });
        }

        for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
          const chunk = items.slice(i, i + CONCURRENCY_LIMIT);
          const enrichedChunk = await Promise.all(
            chunk.map(item => {
              const existingListing = existingListingsMap.get(item.id);
              return this.enrichItemPricing(item, existingListing, forcePromoPrices);
            })
          );
          enrichedItems.push(...enrichedChunk);
        }

        // Buscar descrições completas para cada item (em paralelo, mas com limite)
        console.log(`[ML-SYNC] Buscando descrições completas para ${enrichedItems.length} itens...`);
        const itemsWithDescriptions = await Promise.all(
          enrichedItems.map(async (item) => {
            const fullDescription = await this.fetchItemDescription(item.id);
            if (fullDescription) {
              // Sobrescrever a descrição se encontramos uma completa
              item.descriptions = [{ id: item.id, plain_text: fullDescription }];
            }
            return item;
          })
        );

        // HOTFIX 09.13: Verificar se items do batch têm video_id, se não, buscar individualmente
        const debugMedia = process.env.DEBUG_MEDIA === '1' || process.env.DEBUG_MEDIA === 'true';
        const itemsNeedingVideoCheck: MercadoLivreItem[] = [];
        
        for (const item of itemsWithDescriptions) {
          // HOTFIX 09.13: Analisar campos de vídeo no payload do batch
          const hasVideoId = 'video_id' in item && item.video_id !== undefined && item.video_id !== null && typeof item.video_id === 'string' && item.video_id.trim().length > 0;
          const videoIdType = 'video_id' in item ? typeof item.video_id : 'undefined';
          const hasVideosArray = 'videos' in item && Array.isArray(item.videos) && item.videos.length > 0;
          const videosCount = Array.isArray(item.videos) ? item.videos.length : null;
          
          // Verificar attributes para campos relacionados a vídeo
          const hasAttributesVideo = item.attributes && Array.isArray(item.attributes) 
            ? item.attributes.some((attr: any) => {
                const id = (attr.id || '').toUpperCase();
                const name = (attr.name || '').toUpperCase();
                return id.includes('VIDEO') || name.includes('VIDEO') || id.includes('MEDIA') || name.includes('MEDIA');
              })
            : false;
          
          // Coletar chaves relevantes presentes
          const rawKeys: string[] = [];
          if ('video_id' in item) rawKeys.push('video_id');
          if ('videos' in item) rawKeys.push('videos');
          if ('pictures' in item) rawKeys.push('pictures');
          if ('attributes' in item) rawKeys.push('attributes');
          
          // HOTFIX 09.13: Armazenar debug info inicial do batch
          debugInfoMap.set(item.id, {
            endpointUsed: 'items', // GET /items?ids=...
            mlFieldsSummary: {
              hasVideoId,
              videoIdType,
              hasVideosArray,
              videosCount,
              hasAttributesVideo,
              rawKeys,
            },
            fallbackTried: false,
          });
          
          if (debugMedia) {
            console.log(`[ML-SYNC] DEBUG_MEDIA: Verificando necessidade de GET individual para ${item.id}:`, {
              listing_id_ext: item.id,
              hasVideoId,
              hasVideosArray,
              needsIndividualFetch: !hasVideoId && !hasVideosArray,
              mlFieldsSummary: debugInfoMap.get(item.id)?.mlFieldsSummary,
            });
          }
          
          // Se não tem video_id nem videos array, precisamos buscar individualmente
          if (!hasVideoId && !hasVideosArray) {
            itemsNeedingVideoCheck.push(item);
          }
        }
        
        // HOTFIX 09.13: Buscar detalhes completos (incluindo video_id) para itens que não têm no batch
        if (itemsNeedingVideoCheck.length > 0) {
          console.log(`[ML-SYNC] Buscando detalhes completos (incluindo video_id) para ${itemsNeedingVideoCheck.length} itens que não têm no batch...`);
          const itemsWithVideoDetails = await Promise.all(
            itemsNeedingVideoCheck.map(async (item) => {
              try {
                // HOTFIX 09.13: Atualizar debug info para indicar que fallback será tentado
                const debugInfo = debugInfoMap.get(item.id);
                if (debugInfo) {
                  debugInfo.fallbackTried = true;
                  debugInfo.fallbackEndpoint = `/items/${item.id}`;
                }
                
                // Fazer GET /items/{id} individual para obter video_id completo
                const response = await axios.get(`${ML_API_BASE}/items/${item.id}`, {
                  headers: { Authorization: `Bearer ${this.accessToken}` },
                });
                
                const fullItem = response.data as MercadoLivreItem;
                
                // HOTFIX 09.13: Analisar campos de vídeo no fallback
                const fallbackHasVideoId = fullItem.video_id !== null && fullItem.video_id !== undefined && typeof fullItem.video_id === 'string' && fullItem.video_id.trim().length > 0;
                const fallbackHasVideosArray = fullItem.videos !== undefined && Array.isArray(fullItem.videos) && fullItem.videos.length > 0;
                const fallbackVideosCount = Array.isArray(fullItem.videos) ? fullItem.videos.length : null;
                
                // HOTFIX 09.13: Atualizar debug info com resultados do fallback
                if (debugInfo) {
                  debugInfo.fallbackHadVideoId = fallbackHasVideoId || undefined;
                  debugInfo.fallbackVideosCount = fallbackVideosCount;
                }
                
                // Enriquecer item com video_id/videos se encontrado
                if (fallbackHasVideoId && fullItem.video_id) {
                  item.video_id = fullItem.video_id;
                  if (debugMedia) {
                    console.log(`[ML-SYNC] DEBUG_MEDIA: video_id encontrado via GET individual para ${item.id}:`, {
                      listing_id_ext: item.id,
                      videoId: `${fullItem.video_id.substring(0, 10)}...`,
                      source: 'GET_items_id_individual',
                    });
                  }
                }
                
                if (fallbackHasVideosArray && fullItem.videos) {
                  item.videos = fullItem.videos;
                  if (debugMedia) {
                    console.log(`[ML-SYNC] DEBUG_MEDIA: videos array encontrado via GET individual para ${item.id}:`, {
                      listing_id_ext: item.id,
                      videosCount: fullItem.videos.length,
                      source: 'GET_items_id_individual',
                    });
                  }
                }
                
                return item;
              } catch (error) {
                // HOTFIX 09.13: Marcar fallback como falhou no debug info
                const debugInfo = debugInfoMap.get(item.id);
                if (debugInfo) {
                  debugInfo.fallbackTried = true;
                  debugInfo.fallbackEndpoint = `/items/${item.id}`;
                  debugInfo.fallbackHadVideoId = false;
                  debugInfo.fallbackVideosCount = null;
                }
                
                // Se falhar, logar mas continuar com item original
                if (axios.isAxiosError(error)) {
                  const status = error.response?.status;
                  console.warn(`[ML-SYNC] Erro ao buscar detalhes completos de ${item.id} (${status}):`, error.message);
                } else {
                  console.warn(`[ML-SYNC] Erro ao buscar detalhes completos de ${item.id}:`, error instanceof Error ? error.message : 'Erro desconhecido');
                }
                return item; // Retornar item original se falhar
              }
            })
          );
          
          // Substituir items originais pelos enriquecidos
          for (let i = 0; i < itemsWithDescriptions.length; i++) {
            const enriched = itemsWithVideoDetails.find(e => e.id === itemsWithDescriptions[i].id);
            if (enriched) {
              itemsWithDescriptions[i] = enriched;
            }
          }
        }
        
        // HOTFIX 09.13: Armazenar debug info no item para uso posterior (via propriedade não enumerável)
        for (const item of itemsWithDescriptions) {
          const debugInfo = debugInfoMap.get(item.id);
          if (debugInfo) {
            Object.defineProperty(item, '_videoDebugInfo', {
              value: debugInfo,
              enumerable: false,
              writable: false,
            });
          }
        }

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

  async upsertListings(
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
      
      // HOTFIX 09.11: Verificar se tem vídeo usando helper robusto
      // Assumir status 200 se item veio do batch (code === 200)
      // Se vier de outro lugar (fallback), passar null para indicar incerteza
      const httpStatusForVideo = 200; // Items do batch sempre vêm com code 200
      
      // HOTFIX 09.11: Log de debug obrigatório quando DEBUG_MEDIA=1
      const debugMedia = process.env.DEBUG_MEDIA === '1' || process.env.DEBUG_MEDIA === 'true';
      if (debugMedia) {
        console.log(`[ML-SYNC] DEBUG_MEDIA: Item ${item.id} - Verificando campos de mídia no payload batch:`, {
          listing_id_ext: item.id,
          hasVideoId: 'video_id' in item && item.video_id !== undefined && item.video_id !== null,
          videoIdValue: 'video_id' in item ? (typeof item.video_id === 'string' ? `${item.video_id.substring(0, 10)}...` : item.video_id) : 'not_present',
          hasVideosArray: 'videos' in item && Array.isArray(item.videos),
          videosCount: Array.isArray(item.videos) ? item.videos.length : 'not_array',
          picturesCount: Array.isArray(item.pictures) ? item.pictures.length : 'not_array',
          endpointUsed: 'batch_GET_items_ids',
        });
      }
      
      const videoExtraction = extractHasVideoFromMlItem(item, httpStatusForVideo);
      const hasVideoFromAPI = videoExtraction.hasVideo;
      
      // HOTFIX 09.11: Log detalhado quando DEBUG_MEDIA=1
      if (debugMedia) {
        console.log(`[ML-SYNC] DEBUG_MEDIA: Resultado da extração de vídeo para ${item.id}:`, {
          listing_id_ext: item.id,
          hasClipsDetected: hasVideoFromAPI,
          isDetectable: videoExtraction.isDetectable,
          evidenceCount: videoExtraction.evidence.length,
          evidence: videoExtraction.evidence,
          clipsEvidence: videoExtraction.clipsEvidence,
          fieldsUsed: [
            'video_id' in item ? 'video_id' : null,
            'videos' in item ? 'videos' : null,
          ].filter(Boolean),
          valueToPersist: hasVideoFromAPI, // true | false | null
        });
      }
      
      // HOTFIX: Log seguro com evidências e clipsEvidence (sem tokens)
      if (process.env.NODE_ENV !== 'production' && videoExtraction.evidence.length > 0) {
        console.log(`[ML-SYNC] Video extraction for ${item.id}:`, {
          tenantId: this.tenantId,
          hasVideo: hasVideoFromAPI,
          evidenceCount: videoExtraction.evidence.length,
          evidence: videoExtraction.evidence.slice(0, 3), // Limitar evidências no log
          clipsEvidence: videoExtraction.clipsEvidence, // HOTFIX: Incluir clipsEvidence
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
          select: {
            id: true,
            seller_id: true,
            promotion_checked_at: true,
            price_final: true,
            original_price: true,
            has_promotion: true,
            discount_percent: true,
            access_status: true,
            access_blocked_code: true,
            access_blocked_reason: true,
            has_clips: true, // HOTFIX: Incluir para regra "true é sticky"
            has_video: true, // HOTFIX: Incluir para regra "true é sticky"
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
        // FONTE DE VERDADE: extrair de prices.prices[], reference_prices[], original_price, sale_price, base_price
        const now = new Date();
        const currentPrice = item.price;
        
        // Logs instrumentados para diagnóstico (sem tokens/PII)
        const hasPricesField = !!item.prices;
        const pricesCount = item.prices?.prices ? (Array.isArray(item.prices.prices) ? item.prices.prices.length : 0) : 0;
        const hasReferencePrices = !!(item.reference_prices && Array.isArray(item.reference_prices) && item.reference_prices.length > 0);
        const hasSalePrice = item.sale_price !== undefined && item.sale_price !== null;
        const hasBasePrice = item.base_price !== undefined && item.base_price !== null;
        const hasOriginalPrice = item.original_price !== undefined && item.original_price !== null;
        
        console.log(`[ML-SYNC] Promoção - diagnóstico itemId=${item.id}`, {
          hasPricesField,
          pricesCount,
          hasReferencePrices,
          hasSalePrice,
          sale_price: item.sale_price,
          hasBasePrice,
          base_price: item.base_price,
          hasOriginalPrice,
          original_price: item.original_price,
          current_price: currentPrice,
          hasDeals: !!(item.deals && Array.isArray(item.deals) && item.deals.length > 0),
          hasPromotions: !!(item.promotions && Array.isArray(item.promotions) && item.promotions.length > 0),
        });
        
        // 1. Extrair preços da estrutura prices.prices[]
        let pricesFromStructure: number[] = [];
        if (item.prices?.prices && Array.isArray(item.prices.prices)) {
          pricesFromStructure = item.prices.prices
            .map(p => p.amount)
            .filter((amount): amount is number => typeof amount === 'number' && amount > 0);
        }
        
        // 2. Extrair preços de referência (reference_prices[])
        let referencePrices: number[] = [];
        if (item.reference_prices && Array.isArray(item.reference_prices)) {
          referencePrices = item.reference_prices
            .map(rp => rp.amount)
            .filter((amount): amount is number => typeof amount === 'number' && amount > 0);
        }
        
        // 3. Determinar price_final (menor preço ativo encontrado)
        // Prioridade: sale_price > menor de prices.prices[] > price
        let priceFinal: number = currentPrice;
        let candidateFinalPrice: number | null = null;
        
        if (item.sale_price !== undefined && item.sale_price !== null && item.sale_price > 0) {
          priceFinal = item.sale_price;
          candidateFinalPrice = item.sale_price;
        } else if (pricesFromStructure.length > 0) {
          const minPrice = Math.min(...pricesFromStructure);
          if (minPrice < currentPrice) {
            priceFinal = minPrice;
            candidateFinalPrice = minPrice;
          } else {
            priceFinal = currentPrice;
          }
        } else {
          priceFinal = currentPrice;
        }
        
        // 4. Determinar original_price (maior preço válido)
        // Prioridade: original_price > maior de reference_prices[] > base_price > price (se price > price_final)
        let originalPrice: number | null = null;
        
        if (item.original_price !== undefined && item.original_price !== null && item.original_price > 0) {
          originalPrice = item.original_price;
        } else if (referencePrices.length > 0) {
          originalPrice = Math.max(...referencePrices);
        } else if (item.base_price !== undefined && item.base_price !== null && item.base_price > 0) {
          originalPrice = item.base_price;
        } else if (currentPrice > priceFinal) {
          // Se price atual é maior que price_final, usar price como original_price
          originalPrice = currentPrice;
        } else {
          originalPrice = null;
        }
        
        // 5. Detectar promoção: original_price > price_final E diferença significativa (> 1%)
        let hasPromotion = false;
        let discountPercent: number | null = null;
        let promotionType: string | null = null;
        
        if (originalPrice !== null && originalPrice > priceFinal && originalPrice > 0) {
          const discount = ((originalPrice - priceFinal) / originalPrice) * 100;
          
          // Considerar promoção apenas se desconto > 1% (evitar falsos positivos por arredondamento)
          if (discount > 1) {
            hasPromotion = true;
            discountPercent = Math.round(discount);
            
            // Verificar se há deals/promotions para tipo de promoção
            if (item.deals && Array.isArray(item.deals) && item.deals.length > 0) {
              const activeDeal = item.deals[0];
              promotionType = activeDeal.type || 'PERCENTAGE';
              // Se deal já tem discount_percent, usar ele (mais preciso)
              if (activeDeal.discount_percent !== undefined && activeDeal.discount_percent !== null) {
                discountPercent = activeDeal.discount_percent;
              }
            } else if (item.promotions && Array.isArray(item.promotions) && item.promotions.length > 0) {
              const activePromo = item.promotions[0];
              promotionType = activePromo.type || 'PERCENTAGE';
              if (activePromo.discount_percent !== undefined && activePromo.discount_percent !== null) {
                discountPercent = activePromo.discount_percent;
              }
            } else {
              promotionType = 'PERCENTAGE';
            }
          } else {
            // Desconto muito pequeno, não considerar promoção
            hasPromotion = false;
            priceFinal = currentPrice;
            originalPrice = null;
            discountPercent = null;
            promotionType = null;
          }
        } else {
          // Sem promoção: price_final = price, original_price = null
          hasPromotion = false;
          priceFinal = currentPrice;
          originalPrice = null;
          discountPercent = null;
          promotionType = null;
        }
        
        // APLICAÇÃO ESCALÁVEL: usar /items/{id}/prices como source of truth para preço promocional
        // Baseado em TTL (Time To Live) para controlar rate limits e custos
        // Verifica shouldFetchMlPricesForPromo (flag + TTL) antes de buscar /prices
        const shouldFetch = shouldFetchMlPricesForPromo(existing || null);
        
        if (shouldFetch) {
          // Segurança extra: se item.prices não existe (ex: enrich retornou cedo), buscar /prices aqui mesmo
          let pricesForPromo: NonNullable<MercadoLivreItem['prices']>['prices'] | null =
            (item.prices?.prices && Array.isArray(item.prices.prices)) ? item.prices.prices : null;
          let usedPricesEndpoint = false;
          let fetchError: { statusCode?: number; reason?: string } | null = null;

          if (!pricesForPromo) {
            try {
              const pricesData = await this.fetchItemPrices(item.id);
              if (pricesData?.statusCode === 200 && pricesData.prices && pricesData.prices.length > 0) {
                const fetchedPrices = pricesData.prices;
                pricesForPromo = fetchedPrices;
                usedPricesEndpoint = true;

                // Preencher evidências no item (sem persistir payload bruto)
                item.prices = { prices: fetchedPrices };

                const promoEntry = fetchedPrices.find(p => p.type === 'promotion');
                const standardEntry = fetchedPrices.find(p => p.type === 'standard');
                if (promoEntry?.amount && promoEntry.amount > 0) {
                  item.sale_price = promoEntry.amount;
                }
                const forcedOriginal =
                  promoEntry?.regular_amount ??
                  standardEntry?.amount ??
                  null;
                if (forcedOriginal && forcedOriginal > 0) {
                  item.original_price = forcedOriginal;
                }
              } else if (pricesData) {
                // /prices retornou mas sem dados válidos
                fetchError = { statusCode: pricesData.statusCode, reason: 'no_valid_prices' };
              }
            } catch (error: any) {
              // Falha ao buscar /prices: não quebrar o sync, manter valores existentes
              const statusCode = error.response?.status || 0;
              fetchError = { 
                statusCode, 
                reason: statusCode === 429 ? 'rate_limit' : statusCode >= 500 ? 'server_error' : statusCode === 403 ? 'forbidden' : 'unknown' 
              };
              console.warn(`[ML-SYNC] ml-prices-skipped itemId=${item.id}`, {
                stage: 'ml-prices-skipped',
                listingIdExt: item.id,
                reason: 'fetch_failed',
                statusCode: fetchError.statusCode,
                tenantId: this.tenantId,
              });
            }
          }

          if (pricesForPromo) {
            const oldPriceFinal = priceFinal;
            const oldDiscount = discountPercent;

            const override = applyBuyerPricesOverrideFromMlPrices(
              {
                priceFinal,
                originalPrice,
                discountPercent,
                hasPromotion,
              },
              { prices: pricesForPromo }
            );

            if (override.applied) {
              priceFinal = override.next.priceFinal;
              originalPrice = override.next.originalPrice;
              discountPercent = override.next.discountPercent;
              hasPromotion = override.next.hasPromotion;

              // Log estruturado (sem tokens)
              console.log(`[ML-SYNC] ml-prices-applied itemId=${item.id}`, {
                stage: 'ml-prices-applied',
                listingIdExt: item.id,
                oldPriceFinal,
                newPriceFinal: priceFinal,
                oldDiscount,
                newDiscount: discountPercent,
                usedPricesEndpoint,
                tenantId: this.tenantId,
              });
            } else {
              // /prices retornou mas não há promoção efetiva
              console.log(`[ML-SYNC] ml-prices-skipped itemId=${item.id}`, {
                stage: 'ml-prices-skipped',
                listingIdExt: item.id,
                reason: 'promo_not_effective',
                tenantId: this.tenantId,
              });
            }
          } else if (!fetchError) {
            // Não havia prices no item e não tentamos buscar (ou tentamos mas não retornou)
            console.log(`[ML-SYNC] ml-prices-skipped itemId=${item.id}`, {
              stage: 'ml-prices-skipped',
              listingIdExt: item.id,
              reason: 'no_prices_available',
              tenantId: this.tenantId,
            });
          }
        } else {
          // TTL ainda válido ou flag desativada
          const useMlPricesForPromo = getBooleanEnv('USE_ML_PRICES_FOR_PROMO', false);
          const reason = !useMlPricesForPromo ? 'flag_off' : 'ttl_not_expired';
          console.log(`[ML-SYNC] ml-prices-skipped itemId=${item.id}`, {
            stage: 'ml-prices-skipped',
            listingIdExt: item.id,
            reason,
            promotionCheckedAt: existing?.promotion_checked_at?.toISOString() || null,
            tenantId: this.tenantId,
          });
        }
        
        // Log estruturado com candidateFinalPrice para diagnóstico
        console.log(`[ML-SYNC] Promoção - resultado final itemId=${item.id}`, {
          candidateFinalPrice,
          priceFinal,
          originalPrice,
          hasPromotion,
          discountPercent,
          promotionType,
        });

        // Atualizar campos de promoção (sempre persistir, mesmo sem promoção)
        // IMPORTANTE: Se shouldFetch foi true, atualizar promotion_checked_at para registrar que verificamos
        listingData.has_promotion = hasPromotion;
        listingData.price_final = priceFinal;
        listingData.original_price = originalPrice;
        listingData.discount_percent = discountPercent;
        listingData.promotion_type = promotionType;
        // Atualizar promotion_checked_at apenas se buscamos /prices (shouldFetch) ou se nunca foi verificado
        if (shouldFetch || !existing?.promotion_checked_at) {
          listingData.promotion_checked_at = now;
        } else {
          // Manter promotion_checked_at existente se não buscamos /prices (TTL ainda válido)
          listingData.promotion_checked_at = existing.promotion_checked_at;
        }
        
        // IMPORTANTE: price também deve refletir o preço atual do comprador (price_final se houver promoção)
        // Isso garante que a UI do grid mostre o preço correto
        listingData.price = hasPromotion ? priceFinal : currentPrice;
        
        // Log estruturado para debug (sem expor tokens) - já logado acima no resultado final

        // HOTFIX 09.11: Atualizar has_video/has_clips com regra de persistência "true é sticky"
        // - true: tem vídeo confirmado via API (sticky: não sobrescrever com null/false)
        // - false: confirmado que não tem vídeo (apenas se status 200 e evidência negativa confiável)
        // - null: não detectável via API (não acusar falta)
        // IMPORTANTE: has_clips deve ser boolean | null, NUNCA converter null para false
        // No fallback via Orders, não temos certeza, então setar null
        const debugMedia = process.env.DEBUG_MEDIA === '1' || process.env.DEBUG_MEDIA === 'true';
        
        if (source === 'orders_fallback') {
          // Fallback: não sobrescrever valores existentes
          if (existing) {
            // Manter valor existente (especialmente se for true)
            listingData.has_video = undefined; // Não atualizar
            listingData.has_clips = undefined; // Não atualizar
          } else {
            // Criação: setar null (não false)
            listingData.has_video = null;
            listingData.has_clips = null;
          }
        } else {
          // Fluxo normal: aplicar regra "true é sticky"
          const existingHasClips = existing ? (existing as any).has_clips : null;
          const existingHasVideo = existing ? (existing as any).has_video : null;
          
          if (debugMedia) {
            console.log(`[ML-SYNC] DEBUG_MEDIA: Persistência de has_clips para ${item.id}:`, {
              listing_id_ext: item.id,
              hasVideoFromAPI,
              existingHasClips,
              existingHasVideo,
              videoExtractionIsDetectable: videoExtraction.isDetectable,
            });
          }
          
          // Se já existe true, manter true (sticky)
          if (existingHasClips === true || existingHasVideo === true) {
            listingData.has_video = true;
            listingData.has_clips = true;
            if (debugMedia) {
              console.log(`[ML-SYNC] DEBUG_MEDIA: Mantendo true (sticky) para ${item.id}`);
            }
          } else {
            // Aplicar novo valor apenas se não for sobrescrever um true existente
            if (hasVideoFromAPI === true) {
              // Novo true: sempre aplicar
              listingData.has_video = true;
              listingData.has_clips = true;
              if (debugMedia) {
                console.log(`[ML-SYNC] DEBUG_MEDIA: Aplicando true (novo) para ${item.id}`);
              }
            } else if (hasVideoFromAPI === false) {
              // Novo false: só aplicar se não havia true antes E se foi detectável
              if (existingHasClips !== true && existingHasVideo !== true && videoExtraction.isDetectable) {
                listingData.has_video = false;
                listingData.has_clips = false;
                if (debugMedia) {
                  console.log(`[ML-SYNC] DEBUG_MEDIA: Aplicando false (confirmado sem vídeo) para ${item.id}`);
                }
              } else {
                // Manter true (sticky) ou não atualizar se não foi detectável
                if (existingHasClips === true || existingHasVideo === true) {
                  listingData.has_video = true;
                  listingData.has_clips = true;
                } else {
                  // Não atualizar se não foi detectável
                  listingData.has_video = undefined;
                  listingData.has_clips = undefined;
                }
                if (debugMedia) {
                  console.log(`[ML-SYNC] DEBUG_MEDIA: Mantendo valor existente (não sobrescrever) para ${item.id}`);
                }
              }
            } else {
              // hasVideoFromAPI === null: não sobrescrever valores existentes
              // HOTFIX 09.13: Se isDetectable=false, garantir que has_clips seja null (não false)
              // IMPORTANTE: null significa "não detectável", NÃO significa "false"
              if (existing) {
                // HOTFIX 09.13: Se não foi detectável e valor existente é false, pode ser que seja null
                // Manter valor existente (não atualizar) OU setar null se não foi detectável
                if (!videoExtraction.isDetectable) {
                  // Se não foi detectável, não devemos ter false persistido
                  // Manter null ou undefined (não atualizar)
                  listingData.has_video = undefined; // Não atualizar
                  listingData.has_clips = undefined; // Não atualizar
                } else {
                  // Foi detectável mas retornou null (caso raro) - manter existente
                  listingData.has_video = undefined; // Não atualizar
                  listingData.has_clips = undefined; // Não atualizar
                }
                if (debugMedia) {
                  console.log(`[ML-SYNC] DEBUG_MEDIA: Mantendo valor existente (null não detectável) para ${item.id}`, {
                    isDetectable: videoExtraction.isDetectable,
                  });
                }
              } else {
                // Criação: setar null (não false) quando não detectável
                listingData.has_video = null;
                listingData.has_clips = null;
                if (debugMedia) {
                  console.log(`[ML-SYNC] DEBUG_MEDIA: Setando null (não detectável) para novo listing ${item.id}`, {
                    isDetectable: videoExtraction.isDetectable,
                  });
                }
              }
            }
          }
          
          if (debugMedia) {
            console.log(`[ML-SYNC] DEBUG_MEDIA: Valor final a persistir para ${item.id}:`, {
              listing_id_ext: item.id,
              has_video: listingData.has_video,
              has_clips: listingData.has_clips,
              type_has_clips: typeof listingData.has_clips,
              isNull: listingData.has_clips === null,
              isFalse: listingData.has_clips === false,
              isTrue: listingData.has_clips === true,
            });
          }
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

        // HOTFIX 09.2: Extrair variations_count do item
        // Prioridade: item.variations?.length > item.variations_count > 0
        let variationsCount: number | null = null;
        if (Array.isArray(item.variations) && item.variations.length > 0) {
          variationsCount = item.variations.length;
        } else if (typeof (item as any).variations_count === 'number' && (item as any).variations_count >= 0) {
          variationsCount = (item as any).variations_count;
        } else if (typeof (item as any).variationsCount === 'number' && (item as any).variationsCount >= 0) {
          variationsCount = (item as any).variationsCount;
        }
        
        // Atualizar variations_count apenas se extraímos um valor válido
        if (variationsCount !== null && variationsCount >= 0) {
          listingData.variations_count = variationsCount;
        } else if (!existing) {
          // Se é criação e não tem variations, setar 0
          listingData.variations_count = 0;
        }
        // Se é update e não veio variations, NÃO atualizar (manter valor existente)

        // Atualizar source e discovery_blocked (sempre atualizar quando fornecidos)
        if (source !== undefined) {
          listingData.source = source;
        }
        listingData.discovery_blocked = discoveryBlocked;

        // HOTFIX 09.13: Atualizar last_synced_at quando forceRefresh ou source='force_refresh'
        if (source === 'force_refresh' || source === 'manual_import') {
          listingData.last_synced_at = new Date();
        }

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
      // HOTFIX DIA 05: Estrutura: Map<listingId, Map<dayStr, { orderIds: Set<string>, gmv: number }>>
      // Usar Set de order_ids para contar DISTINCT orders, não quantity
      const metricsByListingAndDay = new Map<string, Map<string, { orderIds: Set<string>; gmv: number }>>();
      
      for (const orderItem of orderItems) {
        if (!orderItem.listing_id) continue; // Pular items sem listing_id (não deveria acontecer após backfill)

        // HOTFIX DIA 05: Usar paid_date se disponível, senão order_date como fallback
        // Normalizar para timezone do Brasil antes de extrair dia
        const orderDate = orderItem.order.paid_date || orderItem.order.order_date;
        const paymentDate = new Date(orderDate);
        
        // HOTFIX DIA 05: Converter para timezone do Brasil antes de extrair dia
        // Usar UTC midnight como padrão (já que order_date/paid_date já devem estar em UTC)
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
        const existing = dayMap.get(dayStr) || { orderIds: new Set<string>(), gmv: 0 };
        
        // HOTFIX DIA 05: Adicionar order_id ao Set (conta DISTINCT orders)
        existing.orderIds.add(orderItem.order.id);
        existing.gmv += Number(orderItem.total_price); // Usar total_price já calculado
        
        dayMap.set(dayStr, existing);
      }

      console.log(`[ML-METRICS] Agregados ${metricsByListingAndDay.size} listings com métricas`);

      // 5. Para cada listing, fazer UPSERT para cada dia do range
      // HOTFIX DIA 05: Preservar visits e outros campos existentes no update
      const upsertPromises: Promise<void>[] = [];
      
      // HOTFIX P0: Logs estruturados para sample de 5 dias (incluir conversion)
      const sampleDays: Array<{ listingId: string; day: string; before: { orders: number | null; gmv: number | null; conversion: number | null; visits: number | null }; after: { orders: number; gmv: number; conversion: number | null; visits: number | null } }> = [];
      const maxSampleDays = 5;
      let sampleDaysCount = 0;
      
      for (const listing of listings) {
        // Usar listing.id em vez de listing_id_ext (agora agregamos por listing_id)
        const dayMap = metricsByListingAndDay.get(listing.id) || new Map();
        
        for (const dayStr of dayStrings) {
          const dayMetrics = dayMap.get(dayStr) || { orderIds: new Set<string>(), gmv: 0 };
          // HOTFIX DIA 05: Contar DISTINCT orders (tamanho do Set)
          const ordersCount = dayMetrics.orderIds.size;
          const gmvValue = dayMetrics.gmv;
          const dayDate = new Date(dayStr + 'T00:00:00.000Z');

          // HOTFIX DIA 05: Buscar valores atuais antes do upsert (para logs e preservação)
          const existingMetric = await prisma.listingMetricsDaily.findUnique({
            where: {
              tenant_id_listing_id_date: {
                tenant_id: tenantId,
                listing_id: listing.id,
                date: dayDate,
              },
            },
            select: {
              visits: true,
              orders: true,
              gmv: true,
              impressions: true,
              clicks: true,
              ctr: true,
              conversion: true,
              source: true,
            },
          });

          // HOTFIX P0: Calcular conversion para logs (fração 0..1)
          const conversionValue = existingMetric?.visits && existingMetric.visits > 0 
            ? Number((ordersCount / existingMetric.visits).toFixed(4))
            : null;

          // HOTFIX DIA 05: Coletar sample para logs (primeiros 5 dias com mudanças)
          if (sampleDaysCount < maxSampleDays && (ordersCount > 0 || gmvValue > 0)) {
            sampleDays.push({
              listingId: listing.id,
              day: dayStr,
              before: {
                orders: existingMetric?.orders ?? null,
                gmv: existingMetric?.gmv ? Number(existingMetric.gmv) : null,
                conversion: existingMetric?.conversion ? Number(existingMetric.conversion) : null,
                visits: existingMetric?.visits ?? null,
              },
              after: {
                orders: ordersCount,
                gmv: gmvValue,
                conversion: conversionValue,
                visits: existingMetric?.visits ?? null,
              },
            });
            sampleDaysCount++;
          }

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
                orders: ordersCount,
                gmv: gmvValue,
                conversion: null, // Sem visits, não calcular conversão
                impressions: null, // Não inventar dados
                clicks: null, // Não inventar dados
                ctr: null, // Não inventar dados
                source: 'ml_orders_daily',
                period_days: periodDays,
              },
              update: {
                // HOTFIX DIA 05: Preservar visits e outros campos existentes (não zerar)
                visits: existingMetric?.visits ?? undefined, // Preservar se existir
                orders: ordersCount, // Atualizar orders
                gmv: gmvValue, // Atualizar gmv
                // HOTFIX DIA 05: Preservar impressions, clicks, ctr se existirem
                impressions: existingMetric?.impressions ?? undefined,
                clicks: existingMetric?.clicks ?? undefined,
                ctr: existingMetric?.ctr ?? undefined,
                // HOTFIX P0: conversion como fração (0..1) para evitar overflow numeric(5,4)
                conversion: existingMetric?.visits && existingMetric.visits > 0 
                  ? Number((ordersCount / existingMetric.visits).toFixed(4))
                  : (existingMetric?.conversion ? Number(existingMetric.conversion) : undefined),
                // HOTFIX DIA 05: Atualizar source para indicar que orders foram atualizados
                source: existingMetric?.source === 'ml_visits_daily' 
                  ? 'ml_visits_and_orders_daily' 
                  : 'ml_orders_daily',
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
      
      // HOTFIX P0: Logs estruturados com conversion
      if (sampleDays.length > 0) {
        console.log(`[ML-METRICS] Sample de ${sampleDays.length} dias com orders/gmv/conversion atualizados:`);
        for (const sample of sampleDays) {
          console.log(`[ML-METRICS]   - Listing ${sample.listingId} dia ${sample.day}: orders ${sample.before.orders ?? 'null'}→${sample.after.orders}, gmv ${sample.before.gmv ?? 'null'}→${sample.after.gmv}, conversion ${sample.before.conversion ?? 'null'}→${sample.after.conversion ?? 'null'}, visits ${sample.before.visits ?? 'null'}`);
        }
      }

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
   * HOTFIX DIA 05: Materializa orders/gmv em listing_metrics_daily
   * 
   * Step independente que reutiliza a mesma base de listings do syncVisitsByRange.
   * Agrega orders pagos por listing_id e dia, fazendo upsert preservando visits.
   * 
   * @param tenantId ID do tenant
   * @param dateFrom Data inicial (inclusive)
   * @param dateTo Data final (inclusive)
   * @param listingIds Lista de listing IDs para processar (mesma base do visits)
   * @returns Resultado com listingsProcessed, rowsUpserted, etc.
   */
  async syncOrdersMetricsDaily(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    listingIds: string[]
  ): Promise<{
    success: boolean;
    listingsProcessed: number;
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
      rowsUpserted: 0,
      min_date: null as string | null,
      max_date: null as string | null,
      errors: [] as string[],
      duration: 0,
    };

    try {
      // Normalizar datas para UTC midnight
      const fromDate = new Date(dateFrom);
      fromDate.setUTCHours(0, 0, 0, 0);
      const toDate = new Date(dateTo);
      toDate.setUTCHours(23, 59, 59, 999);

      // Gerar array de dias do range (inclusive)
      const dayStrings: string[] = [];
      const currentDate = new Date(fromDate);
      while (currentDate <= toDate) {
        dayStrings.push(currentDate.toISOString().split('T')[0]); // YYYY-MM-DD
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      console.log(`[ML-ORDERS-METRICS] Iniciando materialização de orders/gmv para tenant: ${tenantId}`);
      console.log(`[ML-ORDERS-METRICS] Range: ${dayStrings[0]} até ${dayStrings[dayStrings.length - 1]} (${dayStrings.length} dias)`);
      console.log(`[ML-ORDERS-METRICS] Listings para processar: ${listingIds.length}`);

      if (listingIds.length === 0) {
        result.success = true;
        result.min_date = dayStrings[0] || null;
        result.max_date = dayStrings[dayStrings.length - 1] || null;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 1. Buscar pedidos pagos do período do banco de dados
      console.log(`[ML-ORDERS-METRICS] Buscando pedidos pagos do banco desde ${fromDate.toISOString()} até ${toDate.toISOString()}...`);

      const orderItems = await prisma.orderItem.findMany({
        where: {
          order: {
            tenant_id: tenantId,
            marketplace: Marketplace.mercadolivre,
            status: { in: [OrderStatus.paid, OrderStatus.shipped, OrderStatus.delivered] },
            order_date: {
              gte: fromDate,
              lte: toDate,
            },
          },
          listing_id: { in: listingIds }, // HOTFIX: Filtrar apenas pelos listings processados em visits
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

      console.log(`[ML-ORDERS-METRICS] Encontrados ${orderItems.length} order_items no período`);

      // 2. Agregar por listing_id e por dia (usar Set para DISTINCT orders)
      const metricsByListingAndDay = new Map<string, Map<string, { orderIds: Set<string>; gmv: number }>>();
      
      for (const orderItem of orderItems) {
        if (!orderItem.listing_id) continue;

        // Usar paid_date se disponível, senão order_date como fallback
        const orderDate = orderItem.order.paid_date || orderItem.order.order_date;
        const paymentDate = new Date(orderDate);
        paymentDate.setUTCHours(0, 0, 0, 0);
        const dayStr = paymentDate.toISOString().split('T')[0];

        // Verificar se o dia está no range
        if (!dayStrings.includes(dayStr)) {
          continue;
        }

        // Agregar por listing_id e dia
        if (!metricsByListingAndDay.has(orderItem.listing_id)) {
          metricsByListingAndDay.set(orderItem.listing_id, new Map());
        }
        
        const dayMap = metricsByListingAndDay.get(orderItem.listing_id)!;
        const existing = dayMap.get(dayStr) || { orderIds: new Set<string>(), gmv: 0 };
        
        existing.orderIds.add(orderItem.order.id);
        existing.gmv += Number(orderItem.total_price);
        
        dayMap.set(dayStr, existing);
      }

      console.log(`[ML-ORDERS-METRICS] Agregados ${metricsByListingAndDay.size} listings com métricas`);

      // 3. Para cada listing, fazer UPSERT para cada dia do range
      // HOTFIX P0: Incluir conversion nos logs
      const sampleDays: Array<{ listingId: string; day: string; before: { orders: number | null; gmv: number | null; conversion: number | null; visits: number | null }; after: { orders: number; gmv: number; conversion: number | null; visits: number | null } }> = [];
      const maxSampleDays = 5;
      let sampleDaysCount = 0;

      for (const listingId of listingIds) {
        const dayMap = metricsByListingAndDay.get(listingId) || new Map();
        
        for (const dayStr of dayStrings) {
          const dayMetrics = dayMap.get(dayStr) || { orderIds: new Set<string>(), gmv: 0 };
          const ordersCount = dayMetrics.orderIds.size;
          const gmvValue = dayMetrics.gmv;
          const dayDate = new Date(dayStr + 'T00:00:00.000Z');

          // Buscar valores atuais antes do upsert (para logs e preservação)
          const existingMetric = await prisma.listingMetricsDaily.findUnique({
            where: {
              tenant_id_listing_id_date: {
                tenant_id: tenantId,
                listing_id: listingId,
                date: dayDate,
              },
            },
            select: {
              visits: true,
              orders: true,
              gmv: true,
              impressions: true,
              clicks: true,
              ctr: true,
              conversion: true,
              source: true,
            },
          });

          // HOTFIX P0: Calcular conversion para logs (fração 0..1)
          const conversionValue = existingMetric?.visits && existingMetric.visits > 0 
            ? Number((ordersCount / existingMetric.visits).toFixed(4))
            : null;

          // Coletar sample para logs (primeiros 5 dias com mudanças)
          if (sampleDaysCount < maxSampleDays && (ordersCount > 0 || gmvValue > 0)) {
            sampleDays.push({
              listingId,
              day: dayStr,
              before: {
                orders: existingMetric?.orders ?? null,
                gmv: existingMetric?.gmv ? Number(existingMetric.gmv) : null,
                conversion: existingMetric?.conversion ? Number(existingMetric.conversion) : null,
                visits: existingMetric?.visits ?? null,
              },
              after: {
                orders: ordersCount,
                gmv: gmvValue,
                conversion: conversionValue,
                visits: existingMetric?.visits ?? null,
              },
            });
            sampleDaysCount++;
          }

          // UPSERT preservando visits
          await prisma.listingMetricsDaily.upsert({
            where: {
              tenant_id_listing_id_date: {
                tenant_id: tenantId,
                listing_id: listingId,
                date: dayDate,
              },
            },
            create: {
              tenant_id: tenantId,
              listing_id: listingId,
              date: dayDate,
              visits: null,
              orders: ordersCount,
              gmv: gmvValue,
              conversion: null,
              impressions: null,
              clicks: null,
              ctr: null,
              source: 'ml_orders_daily',
              period_days: dayStrings.length,
            },
            update: {
              // Preservar visits e outros campos existentes
              visits: existingMetric?.visits ?? undefined,
              orders: ordersCount,
              gmv: gmvValue,
              impressions: existingMetric?.impressions ?? undefined,
              clicks: existingMetric?.clicks ?? undefined,
              ctr: existingMetric?.ctr ?? undefined,
              // HOTFIX P0: conversion como fração (0..1) para evitar overflow numeric(5,4)
              conversion: existingMetric?.visits && existingMetric.visits > 0 
                ? Number((ordersCount / existingMetric.visits).toFixed(4))
                : (existingMetric?.conversion ? Number(existingMetric.conversion) : undefined),
              source: existingMetric?.source === 'ml_visits_daily' 
                ? 'ml_visits_and_orders_daily' 
                : 'ml_orders_daily',
              period_days: dayStrings.length,
            },
          });

          result.rowsUpserted++;
        }
        
        result.listingsProcessed++;
      }

      // HOTFIX P0: Logs estruturados com conversion
      if (sampleDays.length > 0) {
        console.log(`[ML-ORDERS-METRICS] Sample de ${sampleDays.length} dias com orders/gmv/conversion atualizados:`);
        for (const sample of sampleDays) {
          console.log(`[ML-ORDERS-METRICS]   - Listing ${sample.listingId} dia ${sample.day}: orders ${sample.before.orders ?? 'null'}→${sample.after.orders}, gmv ${sample.before.gmv ?? 'null'}→${sample.after.gmv}, conversion ${sample.before.conversion ?? 'null'}→${sample.after.conversion ?? 'null'}, visits ${sample.before.visits ?? 'null'}`);
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;
      result.min_date = dayStrings[0] || null;
      result.max_date = dayStrings[dayStrings.length - 1] || null;

      console.log(`[ML-ORDERS-METRICS] Sync concluído em ${result.duration}ms`);
      console.log(`[ML-ORDERS-METRICS] Processados: ${result.listingsProcessed} listings, ${dayStrings.length} dias`);
      console.log(`[ML-ORDERS-METRICS] Rows upserted: ${result.rowsUpserted}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-ORDERS-METRICS] Erro fatal no sync de orders metrics:', errorMsg);
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

