import axios, { AxiosError } from 'axios';
import { PrismaClient, Marketplace, ConnectionStatus, ListingStatus, OrderStatus } from '@prisma/client';
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
  pictures?: Array<{ id: string; url?: string; size?: string }>;
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

        // Atualizar has_video sempre (true/false) desde que o item tenha sido buscado com sucesso
        // O helper extractHasVideoFromMlItem sempre retorna boolean
        listingData.has_video = hasVideoFromAPI;

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
   * Busca métricas dos últimos periodDays e persiste em listing_metrics_daily.
   * Como a API do ML não fornece métricas diárias diretamente, usa aproximação
   * baseada em dados agregados e distribuição proporcional.
   * 
   * @param periodDays Período em dias para buscar métricas (padrão: 30)
   */
  async syncListingMetricsDaily(periodDays: number = 30): Promise<{
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
      console.log(`[ML-METRICS] Iniciando sync de métricas diárias para tenant: ${this.tenantId} (${periodDays} dias)`);

      // 1. Carregar conexão e garantir token válido
      await this.loadConnection();
      await this.ensureValidToken();

      // 2. Buscar todos os listings ativos do tenant
      const listings = await prisma.listing.findMany({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          status: ListingStatus.active,
        },
      });

      console.log(`[ML-METRICS] Encontrados ${listings.length} anúncios ativos`);

      if (listings.length === 0) {
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. Calcular data de corte para o período
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - periodDays);
      dateFrom.setHours(0, 0, 0, 0);
      const dateFromISO = dateFrom.toISOString();

      // 4. Buscar pedidos pagos do período via Orders API (fonte confiável)
      console.log(`[ML-METRICS] Buscando pedidos pagos desde ${dateFromISO}...`);
      
      interface MLOrderItem {
        item: { id: string; title: string };
        quantity: number;
        unit_price: number;
      }
      
      interface MLPayment {
        status: string;
        date_approved: string | null;
      }
      
      interface MLOrder {
        id: number;
        order_items: MLOrderItem[];
        payments: MLPayment[];
      }
      
      interface MLOrdersSearchResponse {
        results: MLOrder[];
        paging: { total: number; offset: number; limit: number };
      }

      // Buscar pedidos do período via Orders API
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
        
        if (offset + limit >= response.data.paging.total || response.data.paging.total === 0) {
          break;
        }
        
        offset += limit;
      }

      // Filtrar apenas pedidos pagos (com payment approved)
      const paidOrders = allOrders.filter(order => {
        const paidPayment = order.payments?.find(p => p.status === 'approved');
        return paidPayment && paidPayment.date_approved;
      });

      console.log(`[ML-METRICS] Encontrados ${paidOrders.length} pedidos pagos no período (de ${allOrders.length} total)`);

      // 5. Agrupar pedidos por listing_id_ext e calcular métricas
      const metricsByListing = new Map<string, { orders: number; gmv: number }>();
      
      for (const order of paidOrders) {
        for (const orderItem of order.order_items || []) {
          const listingIdExt = orderItem.item.id;
          const existing = metricsByListing.get(listingIdExt) || { orders: 0, gmv: 0 };
          
          existing.orders += orderItem.quantity;
          existing.gmv += orderItem.quantity * orderItem.unit_price;
          
          metricsByListing.set(listingIdExt, existing);
        }
      }

      // 6. Para cada listing, buscar visitas e persistir métricas agregadas
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const listing of listings) {
        try {
          // Buscar métricas de orders do período (se existirem)
          const orderMetrics = metricsByListing.get(listing.listing_id_ext);
          const orders_30d = orderMetrics?.orders || 0;
          const gmv_30d = orderMetrics?.gmv || 0;

          // Tentar buscar visitas via endpoint /items/{id}
          // Nota: visits pode não estar disponível ou ser lifetime, não período
          let visits_30d: number | null = null;
          let visitsSource = 'unknown';
          
          try {
            const itemData = await this.executeWithRetryOn401(async () => {
              const response = await axios.get(`${ML_API_BASE}/items/${listing.listing_id_ext}`, {
                headers: { Authorization: `Bearer ${this.accessToken}` },
              });
              return response.data as MercadoLivreItem;
            });

            // Se visits existir no payload, pode ser lifetime ou período - marcar como ml_items_aggregate
            if (itemData.visits !== undefined && itemData.visits !== null) {
              visits_30d = itemData.visits;
              visitsSource = 'ml_items_aggregate'; // Pode ser lifetime, não período
            }
          } catch (error) {
            // Se falhar ao buscar item, visits permanece null (unknown)
            console.log(`[ML-METRICS] Não foi possível buscar visitas para ${listing.listing_id_ext}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          }

          // Determinar origem dos dados
          let dataSource: string;
          if (orders_30d > 0) {
            dataSource = 'ml_orders_period'; // Orders do período via Orders API
          } else if (visits_30d !== null) {
            dataSource = visitsSource;
          } else {
            dataSource = 'unknown'; // Sem dados disponíveis
          }

          // Calcular conversão apenas se visits for conhecido
          const conversion = visits_30d !== null && visits_30d > 0 ? orders_30d / visits_30d : null;
          
          // Impressions/clicks/ctr: null quando não houver fonte real (sem estimativas)
          // NOTA: Não estimamos impressions/clicks/ctr - aguardar integração com Visits API ou Ads API
          const impressions = null;
          const clicks = null;
          const ctr = null;

          // Salvar como ponto único no dia atual (representando agregado do período)
          const existingToday = await prisma.listingMetricsDaily.findUnique({
            where: {
              tenant_id_listing_id_date: {
                tenant_id: this.tenantId,
                listing_id: listing.id,
                date: today,
              },
            },
          });

          if (existingToday) {
            // Atualizar métrica existente
            await prisma.listingMetricsDaily.update({
              where: { id: existingToday.id },
              data: {
                visits: visits_30d,
                orders: orders_30d,
                conversion: conversion,
                impressions: impressions,
                clicks: clicks,
                ctr: ctr,
                gmv: gmv_30d,
                source: dataSource,
                period_days: periodDays,
              },
            });
            result.rowsUpserted++;
          } else {
            // Criar nova métrica para hoje
            await prisma.listingMetricsDaily.create({
              data: {
                tenant_id: this.tenantId,
                listing_id: listing.id,
                date: today,
                visits: visits_30d,
                orders: orders_30d,
                conversion: conversion,
                impressions: impressions,
                clicks: clicks,
                ctr: ctr,
                gmv: gmv_30d,
                source: dataSource,
                period_days: periodDays,
              },
            });
            result.metricsCreated++;
            result.rowsUpserted++;
          }

          // Atualizar min_date e max_date
          const dateStr = today.toISOString().split('T')[0];
          if (!result.min_date || dateStr < result.min_date) {
            result.min_date = dateStr;
          }
          if (!result.max_date || dateStr > result.max_date) {
            result.max_date = dateStr;
          }

          // Atualizar visits_last_7d e sales_last_7d no listing
          // Calcular últimos 7 dias das métricas diárias
          const last7Days = new Date();
          last7Days.setDate(last7Days.getDate() - 7);
          last7Days.setHours(0, 0, 0, 0);

          const last7DaysMetrics = await prisma.listingMetricsDaily.findMany({
            where: {
              tenant_id: this.tenantId,
              listing_id: listing.id,
              date: {
                gte: last7Days,
              },
            },
          });

          // Somar visits: null se todos forem null, senão soma apenas valores não-null
          const visitsValues = last7DaysMetrics.map(m => m.visits).filter((v): v is number => v !== null);
          const visitsLast7d = visitsValues.length > 0 ? visitsValues.reduce((sum, v) => sum + v, 0) : null;
          const salesLast7d = last7DaysMetrics.reduce((sum, m) => sum + m.orders, 0);

          await prisma.listing.update({
            where: { id: listing.id },
            data: {
              visits_last_7d: visitsLast7d,
              sales_last_7d: salesLast7d,
            },
          });

          result.listingsProcessed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          result.errors.push(`Listing ${listing.id}: ${errorMsg}`);
          console.error(`[ML-METRICS] Erro ao processar listing ${listing.id}:`, errorMsg);
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      console.log(`[ML-METRICS] Sync concluído em ${result.duration}ms`);
      console.log(`[ML-METRICS] Processados: ${result.listingsProcessed}, Métricas criadas: ${result.metricsCreated}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-METRICS] Erro fatal no sync de métricas:', errorMsg);
      return result;
    }
  }
}

