import axios, { AxiosError } from 'axios';
import { PrismaClient, Marketplace, ConnectionStatus, ListingStatus, ListingAccessStatus } from '@prisma/client';

const prisma = new PrismaClient();

const ML_API_BASE = 'https://api.mercadolibre.com';

type VisitPoint = {
  date: string; // ISO date string (YYYY-MM-DD)
  visits: number;
};

interface VisitsTimeWindowResponse {
  visits: Array<VisitPoint>;
}

type VisitsFetchResult =
  | { 
      ok: true; 
      status: number; 
      visits: VisitPoint[]; 
      rawShape?: string;
    }
  | { 
      ok: false; 
      status?: number; 
      errorType: 'FORBIDDEN' | 'UNAUTHORIZED' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'TIMEOUT' | 'NETWORK' | 'UNKNOWN'; 
      message: string; 
      details?: any;
    };

interface VisitsSyncResult {
  success: boolean;
  listingsProcessed: number;
  metricsCreated: number;
  metricsUpdated: number;
  errors: string[];
  duration: number;
}

export class MercadoLivreVisitsService {
  private tenantId: string;
  private accessToken: string = '';
  private providerAccountId: string = '';
  private connectionId: string = '';

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Busca a conexão do Mercado Livre para o tenant usando resolver centralizado
   */
  private async loadConnection(): Promise<void> {
    console.log(`[ML-VISITS] Buscando conexão para tenant: ${this.tenantId}`);

    const { resolveMercadoLivreConnection } = await import('../utils/ml-connection-resolver');
    const resolved = await resolveMercadoLivreConnection(this.tenantId);
    
    this.connectionId = resolved.connection.id;
    this.providerAccountId = resolved.connection.provider_account_id;

    console.log(`[ML-VISITS] Conexão carregada: Provider ${this.providerAccountId}, ConnectionId=${this.connectionId}, Reason=${resolved.reason}`);
  }

  /**
   * Obtém access_token válido usando helper centralizado
   * Não exige refresh_token se access_token ainda é válido
   */
  private async ensureValidToken(): Promise<void> {
    const { getValidAccessToken } = await import('../utils/ml-token-helper');
    const tokenResult = await getValidAccessToken(this.connectionId);
    
    this.accessToken = tokenResult.token;
    
    if (tokenResult.usedRefresh) {
      console.log(`[ML-VISITS] Token renovado connectionId=${this.connectionId} expiresAt=${tokenResult.expiresAt.toISOString()}`);
    } else {
      console.log(`[ML-VISITS] Token válido (não renovado) connectionId=${this.connectionId} expiresAt=${tokenResult.expiresAt.toISOString()}`);
    }
  }


  /**
   * Executa uma função com retry automático em caso de 401
   */
  private async executeWithRetryOn401<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log('[ML-VISITS] Recebido 401. Tentando obter token válido (refresh se necessário) e retry...');
        
        await this.ensureValidToken();
        console.log('[ML-VISITS] Token atualizado. Executando retry...');
        return await fn();
      }
      throw error;
    }
  }

  /**
   * Marca listing como unauthorized quando recebe 403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES
   */
  private async markListingAsUnauthorized(itemIdExt: string, errorCode: string, errorMessage: string): Promise<void> {
    try {
      const listing = await prisma.listing.findFirst({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          listing_id_ext: itemIdExt,
        },
      });

      if (listing) {
        await prisma.listing.update({
          where: { id: listing.id },
          data: {
            access_status: ListingAccessStatus.blocked_by_policy,
            access_blocked_code: errorCode,
            access_blocked_at: new Date(),
            access_blocked_reason: 'Anúncio não acessível pela conta Mercado Livre conectada (possível conexão antiga/revogada)',
          },
        });
        console.log(`[ML-VISITS] Listing ${itemIdExt} marcado como unauthorized: connectionId=${this.connectionId}, code=${errorCode}`);
      }
    } catch (error) {
      console.error(`[ML-VISITS] Erro ao marcar listing ${itemIdExt} como unauthorized:`, error);
    }
  }

  /**
   * Busca visitas de um item usando Visits API (time_window)
   * 
   * @param itemId ID do item no Mercado Livre
   * @param lastDays Número de dias para buscar (ex: 2, 30)
   * @returns Resultado estruturado com ok/error e detalhes
   */
  async fetchVisitsTimeWindow(itemId: string, lastDays: number): Promise<VisitsFetchResult> {
    try {
      return await this.executeWithRetryOn401(async () => {
        const url = `${ML_API_BASE}/items/${itemId}/visits/time_window`;
        const params = {
          last: lastDays,
          unit: 'day',
        };

        console.log(`[ML-VISITS] Buscando visitas para item ${itemId}, últimos ${lastDays} dias`);
        console.log(`[ML-VISITS] Request: GET ${url}`);
        console.log(`[ML-VISITS] Query params:`, JSON.stringify(params, null, 2));

        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          params,
        });

        const statusCode = response.status;
        console.log(`[ML-VISITS] Response status: ${statusCode}, itemId: ${itemId}`);

        // Parser robusto do retorno do ML
        let visitsArray: VisitPoint[] = [];
        let rawShape: string = 'unknown';
        
        const responseData = response.data as any;
        
        /**
         * Extrai o valor de visitas de um entry seguindo a ordem de prioridade:
         * 1. entry.visits (se number)
         * 2. entry.total (se number)
         * 3. soma de entry.visits_detail[].quantity (se array)
         * 4. null (ignorar item)
         */
        const extractVisitsValue = (entry: any): number | null => {
          // Prioridade 1: entry.visits
          if (typeof entry.visits === 'number') {
            return entry.visits;
          }
          
          // Prioridade 2: entry.total
          if (typeof entry.total === 'number') {
            return entry.total;
          }
          
          // Prioridade 3: soma de entry.visits_detail[].quantity
          if (Array.isArray(entry.visits_detail) && entry.visits_detail.length > 0) {
            const sum = entry.visits_detail.reduce((acc: number, detail: any) => {
              const qty = typeof detail.quantity === 'number' ? detail.quantity : 0;
              return acc + qty;
            }, 0);
            if (sum > 0) {
              return sum;
            }
          }
          
          // Se nenhum campo válido encontrado, retornar null (item será ignorado)
          return null;
        };
        
        // Type predicate para filtrar null
        const isVisitPoint = (p: VisitPoint | null): p is VisitPoint => p !== null;
        
        if (responseData) {
          // Tentar responseData.results (formato real do ML)
          if (Array.isArray(responseData.results)) {
            rawShape = 'results';
            visitsArray = responseData.results
              .map((item: any): VisitPoint | null => {
                const visitsValue = extractVisitsValue(item);
                if (visitsValue === null) {
                  return null; // Ignorar item inválido
                }
                return {
                  date: item.date || item.day || item.fecha,
                  visits: visitsValue,
                };
              })
              .filter(isVisitPoint); // Remover itens ignorados com type guard
          }
          // Tentar responseData.visits (formato alternativo)
          else if (Array.isArray(responseData.visits)) {
            rawShape = 'visits';
            visitsArray = responseData.visits
              .map((item: any): VisitPoint | null => {
                const visitsValue = extractVisitsValue(item);
                if (visitsValue === null) {
                  return null;
                }
                return {
                  date: item.date || item.day || item.fecha,
                  visits: visitsValue,
                };
              })
              .filter(isVisitPoint);
          }
          // Tentar responseData diretamente se for array
          else if (Array.isArray(responseData)) {
            rawShape = 'array';
            visitsArray = responseData
              .map((item: any): VisitPoint | null => {
                const visitsValue = extractVisitsValue(item);
                if (visitsValue === null) {
                  return null;
                }
                return {
                  date: item.date || item.day || item.fecha,
                  visits: visitsValue,
                };
              })
              .filter(isVisitPoint);
          }
        }

        // Normalizar datas para YYYY-MM-DD em UTC
        visitsArray = visitsArray.map(item => {
          let normalizedDate: string;
          try {
            // Aceitar date em ISO "2026-01-22T00:00:00Z" ou YYYY-MM-DD
            const dateObj = new Date(item.date);
            if (isNaN(dateObj.getTime())) {
              // Se falhar parsing, tentar usar como está se já for YYYY-MM-DD
              normalizedDate = item.date || '';
            } else {
              normalizedDate = dateObj.toISOString().slice(0, 10); // YYYY-MM-DD UTC
            }
          } catch {
            // Se falhar, usar como está se já for YYYY-MM-DD
            normalizedDate = item.date || '';
          }
          return {
            date: normalizedDate,
            visits: item.visits, // Já validado pelo extractVisitsValue
          };
        });

        // Log de diagnóstico (primeiro item ou sample)
        if (itemId) {
          const payloadKeys = Object.keys(responseData || {});
          const payloadSample = JSON.stringify(responseData || {}).slice(0, 400);
          
          // Calcular min/max corretamente (ordem cronológica)
          let minDate: string | null = null;
          let maxDate: string | null = null;
          if (visitsArray.length > 0) {
            const dates = visitsArray.map(v => v.date).sort();
            minDate = dates[0];
            maxDate = dates[dates.length - 1];
          }
          
          console.log(`[ML-VISITS] Diagnóstico itemId=${itemId} periodDays=${lastDays} statusCode=${statusCode}`);
          console.log(`[ML-VISITS] Payload keys: ${payloadKeys.join(', ')}`);
          console.log(`[ML-VISITS] Payload sample: ${payloadSample}`);
          console.log(`[ML-VISITS] Visits retornados: ${visitsArray.length}`);
          console.log(`[ML-VISITS] Date range retornado: ${minDate || 'N/A'} até ${maxDate || 'N/A'}`);
        }

        return {
          ok: true,
          status: statusCode,
          visits: visitsArray,
          rawShape,
        };
      });
        } catch (error) {
          // Classificar erro HTTP
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const data = error.response?.data;
            const code = error.code;
            const errorCode = data?.error || data?.message;
            
            let errorType: 'FORBIDDEN' | 'UNAUTHORIZED' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'TIMEOUT' | 'NETWORK' | 'UNKNOWN' = 'UNKNOWN';
            let message = error.message;
            
            if (status === 401) {
              errorType = 'UNAUTHORIZED';
              message = `Unauthorized (401): ${data?.message || 'Token inválido ou expirado'}`;
            } else if (status === 403) {
              errorType = 'FORBIDDEN';
              message = `Forbidden (403): ${data?.message || 'Acesso negado'}`;
              
              // Se for 403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES, marcar listing como unauthorized
              if (errorCode === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' || 
                  (typeof errorCode === 'string' && errorCode.includes('UNAUTHORIZED'))) {
                // Marcar listing como unauthorized (assíncrono, não bloquear)
                this.markListingAsUnauthorized(itemId, errorCode, message).catch(err => {
                  console.error(`[ML-VISITS] Erro ao marcar listing ${itemId} como unauthorized:`, err);
                });
              }
            } else if (status === 429) {
          errorType = 'RATE_LIMIT';
          message = `Rate limit (429): ${data?.message || 'Muitas requisições'}`;
        } else if (status && status >= 500) {
          errorType = 'SERVER_ERROR';
          message = `Server error (${status}): ${data?.message || 'Erro no servidor ML'}`;
        } else if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
          errorType = 'TIMEOUT';
          message = `Timeout: ${error.message}`;
        } else if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ENETUNREACH') {
          errorType = 'NETWORK';
          message = `Network error: ${error.message}`;
        }
        
        return {
          ok: false,
          status,
          errorType,
          message,
          details: data ? { ...data } : undefined,
        };
      }
      
      // Erro não-Axios
      return {
        ok: false,
        errorType: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Sincroniza visitas por range de datas
   * 
   * @param tenantId ID do tenant
   * @param dateFrom Data inicial (UTC midnight)
   * @param dateTo Data final (UTC end of day)
   * @returns Resultado da sincronização
   */
  async syncVisitsByRange(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    success: boolean;
    listingsProcessed: number;
    rowsUpserted: number;
    min_date: string | null;
    max_date: string | null;
    errors: string[];
    duration: number;
    visits_status: 'ok' | 'partial' | 'unavailable';
    failures_summary: Record<string, number>;
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
      visits_status: 'unavailable' as 'ok' | 'partial' | 'unavailable',
      failures_summary: {} as Record<string, number>,
    };
    
    // Contadores para agregação de status
    let listingsOk = 0;
    let listingsFailed = 0;
    const failuresByType: Record<string, number> = {};

    try {
      this.tenantId = tenantId;
      
      // Normalizar range para UTC midnight
      const fromDate = new Date(dateFrom);
      fromDate.setUTCHours(0, 0, 0, 0);
      const toDate = new Date(dateTo);
      toDate.setUTCHours(23, 59, 59, 999);

      // Calcular número de dias
      const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      console.log(`[ML-VISITS] ========== SYNC VISITS BY RANGE ==========`);
      console.log(`[ML-VISITS] Tenant ID: ${tenantId}`);
      console.log(`[ML-VISITS] Date From: ${fromDate.toISOString()}`);
      console.log(`[ML-VISITS] Date To: ${toDate.toISOString()}`);
      console.log(`[ML-VISITS] Days: ${daysDiff}`);

      // 1. Carregar conexão e garantir token válido
      await this.loadConnection();
      await this.ensureValidToken();

      // 2. Buscar conexão ativa mais recente para filtrar listings
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

      if (!activeConnection) {
        console.log(`[ML-VISITS] Nenhuma conexão ativa encontrada para tenant ${tenantId}`);
        result.success = true;
        result.duration = Date.now() - startTime;
        result.min_date = fromDate.toISOString().split('T')[0];
        result.max_date = toDate.toISOString().split('T')[0];
        return result;
      }

      // 3. Buscar listings do tenant APENAS da conexão ativa
      // IMPORTANTE: Incluir active E paused, mas EXCLUIR blocked_by_policy e unauthorized
      
      // HOTFIX DIA 05: Logs de diagnóstico antes da query
      const totalListingsCount = await prisma.listing.count({
        where: {
          tenant_id: tenantId,
          marketplace: Marketplace.mercadolivre,
        },
      });
      
      const activePausedCount = await prisma.listing.count({
        where: {
          tenant_id: tenantId,
          marketplace: Marketplace.mercadolivre,
          status: { in: [ListingStatus.active, ListingStatus.paused] },
        },
      });
      
      const accessibleCount = await prisma.listing.count({
        where: {
          tenant_id: tenantId,
          marketplace: Marketplace.mercadolivre,
          status: { in: [ListingStatus.active, ListingStatus.paused] },
          access_status: ListingAccessStatus.accessible,
        },
      });
      
      const withConnectionCount = await prisma.listing.count({
        where: {
          tenant_id: tenantId,
          marketplace: Marketplace.mercadolivre,
          status: { in: [ListingStatus.active, ListingStatus.paused] },
          access_status: ListingAccessStatus.accessible,
          marketplace_connection_id: activeConnection.id,
        },
      });
      
      console.log(`[ML-VISITS] Diagnóstico de listings elegíveis:`);
      console.log(`[ML-VISITS]   - Total ML: ${totalListingsCount}`);
      console.log(`[ML-VISITS]   - Active/Paused: ${activePausedCount}`);
      console.log(`[ML-VISITS]   - Accessible: ${accessibleCount}`);
      console.log(`[ML-VISITS]   - Com connection_id=${activeConnection.id}: ${withConnectionCount}`);
      
      const listings = await prisma.listing.findMany({
        where: {
          tenant_id: tenantId,
          marketplace: Marketplace.mercadolivre,
          status: { in: [ListingStatus.active, ListingStatus.paused] }, // Processar active e paused
          access_status: ListingAccessStatus.accessible, // Apenas listings acessíveis
          marketplace_connection_id: activeConnection.id, // Filtrar por conexão ativa
        },
        select: {
          id: true,
          listing_id_ext: true,
        },
      });

      console.log(`[ML-VISITS] Encontrados ${listings.length} listings ativos/pausados acessíveis`);
      
      // HOTFIX DIA 05: Log IDs dos listings que serão processados
      let listingsToProcess = listings;
      
      if (listings.length > 0) {
        const listingIds = listings.map(l => l.id).slice(0, 10); // Primeiros 10 para não poluir log
        console.log(`[ML-VISITS] IDs de listings que serão processados (primeiros 10): ${listingIds.join(', ')}`);
        if (listings.length > 10) {
          console.log(`[ML-VISITS] ... e mais ${listings.length - 10} listings`);
        }
      } else {
        // HOTFIX DIA 05: Se nenhum listing encontrado, tentar sem filtro de connection_id (fallback)
        console.log(`[ML-VISITS] ⚠️ Nenhum listing encontrado com filtros completos. Tentando fallback sem filtro de connection_id...`);
        const listingsWithoutConnectionFilter = await prisma.listing.findMany({
          where: {
            tenant_id: tenantId,
            marketplace: Marketplace.mercadolivre,
            status: { in: [ListingStatus.active, ListingStatus.paused] },
            access_status: ListingAccessStatus.accessible,
          },
          select: {
            id: true,
            listing_id_ext: true,
            marketplace_connection_id: true,
          },
        });
        
        if (listingsWithoutConnectionFilter.length > 0) {
          console.log(`[ML-VISITS] ⚠️ Fallback: Encontrados ${listingsWithoutConnectionFilter.length} listings sem connection_id ou com connection_id diferente`);
          console.log(`[ML-VISITS] ⚠️ Usando fallback: processando ${listingsWithoutConnectionFilter.length} listings sem filtro de connection_id`);
          
          // Usar fallback apenas se houver poucos listings (evitar processar listings de outras conexões por engano)
          if (listingsWithoutConnectionFilter.length <= 20) {
            listingsToProcess = listingsWithoutConnectionFilter.map(l => ({
              id: l.id,
              listing_id_ext: l.listing_id_ext,
            }));
            console.log(`[ML-VISITS] ⚠️ Fallback aplicado: ${listingsToProcess.length} listings serão processados`);
          } else {
            console.log(`[ML-VISITS] ⚠️ Fallback não aplicado: muitos listings (${listingsWithoutConnectionFilter.length}) sem connection_id. Pode indicar problema de sincronização.`);
          }
        } else {
          console.log(`[ML-VISITS] ⚠️ Fallback também não encontrou listings. Verificar se há listings ML no tenant.`);
        }
      }

      if (listingsToProcess.length === 0) {
        result.success = true;
        result.duration = Date.now() - startTime;
        result.min_date = fromDate.toISOString().split('T')[0];
        result.max_date = toDate.toISOString().split('T')[0];
        return result;
      }

      // 3. Processar listings em batches (5-10 concorrentes)
      const batchSize = 5;
      const batches: typeof listingsToProcess[] = [];
      for (let i = 0; i < listingsToProcess.length; i += batchSize) {
        batches.push(listingsToProcess.slice(i, i + batchSize));
      }

      console.log(`[ML-VISITS] Processando ${batches.length} lotes de até ${batchSize} listings`);

      // Processar cada lote
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`[ML-VISITS] Processando lote ${batchIndex + 1}/${batches.length} (${batch.length} listings)`);

        // Gerar array de dias do range (YYYY-MM-DD UTC) ANTES do loop
        const dayStrings: string[] = [];
        const currentDate = new Date(fromDate);
        while (currentDate <= toDate) {
          dayStrings.push(currentDate.toISOString().split('T')[0]); // YYYY-MM-DD
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        console.log(`[ML-VISITS] Range de datas gerado: ${dayStrings[0]} até ${dayStrings[dayStrings.length - 1]} (${dayStrings.length} dias)`);

        // Processar listings do lote em paralelo
        const batchPromises = batch.map(async (listing) => {
          let fetchResult: VisitsFetchResult | null = null;
          let visitsMap = new Map<string, number>();
          
          try {
            // Buscar visitas da API do ML
            fetchResult = await this.fetchVisitsTimeWindow(listing.listing_id_ext, daysDiff);
            
            // Log estruturado para cada listing
            const logData = {
              listingId: listing.id,
              itemIdExt: listing.listing_id_ext,
              ok: fetchResult.ok,
              status: fetchResult.ok ? fetchResult.status : fetchResult.status,
              errorType: fetchResult.ok ? undefined : fetchResult.errorType,
            };
            console.log(`[ML-VISITS] Listing ${listing.id} fetch result:`, JSON.stringify(logData));

            // Tratar resultado
            if (fetchResult.ok) {
              // Sucesso: criar mapa de visitas por data
              // IMPORTANTE: Garantir normalização de data para YYYY-MM-DD UTC antes de salvar no map
              for (const visitData of fetchResult.visits) {
                // Normalizar date para YYYY-MM-DD UTC (garantir que nunca fica ISO completo)
                let normalizedDateKey: string;
                try {
                  const dateObj = new Date(visitData.date);
                  if (isNaN(dateObj.getTime())) {
                    // Se falhar parsing, usar como está se já for YYYY-MM-DD
                    normalizedDateKey = visitData.date.length === 10 ? visitData.date : '';
                  } else {
                    normalizedDateKey = dateObj.toISOString().slice(0, 10); // YYYY-MM-DD UTC
                  }
                } catch {
                  normalizedDateKey = visitData.date.length === 10 ? visitData.date : '';
                }
                
                if (normalizedDateKey) {
                  visitsMap.set(normalizedDateKey, visitData.visits);
                } else {
                  console.warn(`[ML-VISITS] Listing ${listing.id}: data inválida ignorada: ${visitData.date}`);
                }
              }
              
              // Instrumentação: calcular métricas do visitsMap
              const mapKeys = Array.from(visitsMap.keys());
              const mapKeysSample = mapKeys.slice(0, 5);
              const mapSum = Array.from(visitsMap.values()).reduce((acc, val) => acc + val, 0);
              const mapMinKey = mapKeys.length > 0 ? mapKeys.sort()[0] : null;
              const mapMaxKey = mapKeys.length > 0 ? mapKeys.sort()[mapKeys.length - 1] : null;
              
              // Calcular intersectionCount (keys em visitsMap que existem em dayStrings)
              const intersectionCount = mapKeys.filter(key => dayStrings.includes(key)).length;
              
              console.log(`[ML-VISITS] Listing ${listing.id} (${listing.listing_id_ext}) visitsMap diagnóstico:`);
              console.log(`[ML-VISITS]   - mapSize: ${visitsMap.size}`);
              console.log(`[ML-VISITS]   - mapKeysSample: ${JSON.stringify(mapKeysSample)}`);
              console.log(`[ML-VISITS]   - mapSum: ${mapSum}`);
              console.log(`[ML-VISITS]   - mapMinKey: ${mapMinKey}`);
              console.log(`[ML-VISITS]   - mapMaxKey: ${mapMaxKey}`);
              console.log(`[ML-VISITS]   - dayStrings range: ${dayStrings[0]} até ${dayStrings[dayStrings.length - 1]} (${dayStrings.length} dias)`);
              console.log(`[ML-VISITS]   - intersectionCount: ${intersectionCount} (keys do map que existem em dayStrings)`);
              
              listingsOk++;
              console.log(`[ML-VISITS] Listing ${listing.id}: ${fetchResult.visits.length} pontos de visitas mapeados`);
            } else {
              // Falha: classificar e contar
              listingsFailed++;
              const errorType = fetchResult.errorType;
              failuresByType[errorType] = (failuresByType[errorType] || 0) + 1;
              
              // 401/403: marcar conexão como reauth_required
              if (errorType === 'UNAUTHORIZED' || errorType === 'FORBIDDEN') {
                const { markConnectionReauthRequired } = await import('../utils/mark-connection-reauth');
                await markConnectionReauthRequired({
                  tenantId,
                  statusCode: fetchResult.status || 401,
                  errorMessage: fetchResult.message,
                  connectionId: this.connectionId,
                });
                
                const errorMsg = `Erro de autenticação (${fetchResult.status}) para listing ${listing.id}: ${fetchResult.message}`;
                console.error(`[ML-VISITS] ${errorMsg}`);
                result.errors.push(errorMsg);
                return; // Continuar para próximo listing
              }

              // 429: retry simples com backoff (2 tentativas)
              if (errorType === 'RATE_LIMIT') {
                console.log(`[ML-VISITS] Rate limit (429) para listing ${listing.id}. Aguardando 2s e retry...`);
                await new Promise(resolve => setTimeout(resolve, 2000));

                const retryResult = await this.fetchVisitsTimeWindow(listing.listing_id_ext, daysDiff);
                
                if (retryResult.ok) {
                  // Retry bem-sucedido
                  listingsOk++;
                  listingsFailed--; // Descontar falha anterior
                  failuresByType[errorType] = (failuresByType[errorType] || 1) - 1;
                  
                  // Normalizar datas antes de salvar no map (mesma lógica do fetch principal)
                  for (const visitData of retryResult.visits) {
                    let normalizedDateKey: string;
                    try {
                      const dateObj = new Date(visitData.date);
                      if (isNaN(dateObj.getTime())) {
                        normalizedDateKey = visitData.date.length === 10 ? visitData.date : '';
                      } else {
                        normalizedDateKey = dateObj.toISOString().slice(0, 10); // YYYY-MM-DD UTC
                      }
                    } catch {
                      normalizedDateKey = visitData.date.length === 10 ? visitData.date : '';
                    }
                    
                    if (normalizedDateKey) {
                      visitsMap.set(normalizedDateKey, visitData.visits);
                    }
                  }
                  
                  fetchResult = retryResult; // Usar resultado do retry
                  console.log(`[ML-VISITS] Listing ${listing.id}: retry bem-sucedido, ${retryResult.visits.length} pontos mapeados`);
                } else {
                  // Retry também falhou
                  failuresByType[retryResult.errorType] = (failuresByType[retryResult.errorType] || 0) + 1;
                  const errorMsg = `Erro após retry (429) para listing ${listing.id}: ${retryResult.message}`;
                  console.error(`[ML-VISITS] ${errorMsg}`);
                  result.errors.push(errorMsg);
                  // fetchResult permanece com erro - não atualizar nada para este listing
                }
              } else {
                // Outros erros (5xx, timeout, network, etc)
                const errorMsg = `Erro ao buscar visitas para listing ${listing.id}: ${fetchResult.message}`;
                console.error(`[ML-VISITS] ${errorMsg}`);
                result.errors.push(errorMsg);
                // fetchResult permanece com erro - não atualizar nada para este listing
              }
            }

            // 4. Para cada dia do range, fazer UPSERT
            // Se fetch OK: gravar visitsMap.get(day) ?? 0 (0 = buscado e veio 0/ausente)
            // Se fetch falhou: gravar NULL
            let listingRowsUpserted = 0;
            
            const fetchOk = fetchResult?.ok === true;
            
            for (let dayIndex = 0; dayIndex < dayStrings.length; dayIndex++) {
              const dayStr = dayStrings[dayIndex];
              const dayDate = new Date(dayStr + 'T00:00:00.000Z');
              
              let visitsValue: number | null;
              const mapValue = visitsMap.get(dayStr);
              if (fetchOk) {
                // Se fetch OK: 0 significa "buscado e veio 0/ausente", não NULL
                visitsValue = mapValue ?? 0;
              } else {
                // Se fetch falhou: NULL significa "não foi possível buscar"
                visitsValue = null;
              }

              // Instrumentação: logar os 3 primeiros dias
              if (dayIndex < 3) {
                console.log(`[ML-VISITS] Listing ${listing.id} upsert[${dayIndex}]: dayStr=${dayStr}, mapValue=${mapValue ?? 'undefined'}, visitsValue=${visitsValue}, fetchOk=${fetchOk}`);
              }

              // UPSERT apenas visits (não sobrescrever orders/gmv)
              await prisma.listingMetricsDaily.upsert({
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
                  visits: visitsValue,
                  orders: 0, // Default para novos registros
                  gmv: 0, // Default para novos registros
                  source: 'ml_visits_daily',
                  period_days: daysDiff,
                  impressions: null,
                  clicks: null,
                  ctr: null,
                  conversion: null,
                },
                update: {
                  visits: visitsValue, // Atualizar apenas visits (preserva orders/gmv)
                  source: 'ml_visits_daily',
                },
              });

              // Read-back após upsert do 1º dia
              if (dayIndex === 0) {
                try {
                  const dbReadBack = await prisma.listingMetricsDaily.findUnique({
                    where: {
                      tenant_id_listing_id_date: {
                        tenant_id: tenantId,
                        listing_id: listing.id,
                        date: dayDate,
                      },
                    },
                    select: {
                      visits: true,
                    },
                  });
                  const dbReadBackVisits = dbReadBack?.visits ?? null;
                  console.log(`[ML-VISITS] Listing ${listing.id} read-back após upsert[0]: dayStr=${dayStr}, visitsValue escrito=${visitsValue}, dbReadBackVisits=${dbReadBackVisits}`);
                  
                  if (visitsValue !== null && visitsValue > 0 && dbReadBackVisits === 0) {
                    console.error(`[ML-VISITS] ⚠️ Listing ${listing.id} MISMATCH: escreveu visitsValue=${visitsValue} mas DB retornou ${dbReadBackVisits}`);
                  }
                } catch (readBackError) {
                  console.error(`[ML-VISITS] Erro no read-back para listing ${listing.id}:`, readBackError);
                }
              }

              listingRowsUpserted++;
              result.rowsUpserted++;
            }

            result.listingsProcessed++;
            console.log(`[ML-VISITS] Listing ${listing.id} processado: fetchOk=${fetchOk}, rowsUpserted=${listingRowsUpserted}, visitsPoints=${visitsMap.size}`);
          } catch (error) {
            // Erro não tratado acima
            const errorMsg = `Erro ao processar listing ${listing.id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
            console.error(`[ML-VISITS] ${errorMsg}`);
            result.errors.push(errorMsg);
            // Não incrementar rowsUpserted se houve erro não tratado
          }
        });

        // Aguardar lote atual terminar antes de processar próximo
        await Promise.allSettled(batchPromises);

        // Pequeno delay entre lotes para evitar rate-limit
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Calcular visits_status
      // 'ok' se todos listings tiveram ok:true
      // 'partial' se mistura de ok:true e ok:false
      // 'unavailable' se nenhum listing teve ok:true
      if (listingsOk > 0 && listingsFailed === 0) {
        result.visits_status = 'ok';
      } else if (listingsOk > 0 && listingsFailed > 0) {
        result.visits_status = 'partial';
      } else {
        result.visits_status = 'unavailable';
      }
      
      result.failures_summary = failuresByType;
      result.success = result.errors.length === 0 || result.rowsUpserted > 0;
      result.duration = Date.now() - startTime;
      result.min_date = fromDate.toISOString().split('T')[0];
      result.max_date = toDate.toISOString().split('T')[0];

      console.log(`[ML-VISITS] ========== SYNC VISITS CONCLUÍDO ==========`);
      console.log(`[ML-VISITS] Tenant ID: ${tenantId}`);
      console.log(`[ML-VISITS] Duration: ${result.duration}ms`);
      console.log(`[ML-VISITS] Listings processados: ${result.listingsProcessed}`);
      console.log(`[ML-VISITS] Listings OK: ${listingsOk}, Listings Failed: ${listingsFailed}`);
      console.log(`[ML-VISITS] Rows upserted: ${result.rowsUpserted}`);
      console.log(`[ML-VISITS] Visits status: ${result.visits_status}`);
      console.log(`[ML-VISITS] Failures summary:`, JSON.stringify(result.failures_summary));
      console.log(`[ML-VISITS] Min date: ${result.min_date}, Max date: ${result.max_date}`);
      console.log(`[ML-VISITS] Erros: ${result.errors.length}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-VISITS] Erro fatal no sync:', errorMsg);
      return result;
    }
  }

  /**
   * Sincroniza visitas incrementais (últimos 2-3 dias) para todos os listings do tenant
   * 
   * @param lastDays Número de dias para buscar (padrão: 2)
   */
  async syncVisitsIncremental(lastDays: number = 2): Promise<VisitsSyncResult> {
    const startTime = Date.now();
    const result: VisitsSyncResult = {
      success: false,
      listingsProcessed: 0,
      metricsCreated: 0,
      metricsUpdated: 0,
      errors: [],
      duration: 0,
    };

    try {
      console.log(`[ML-VISITS] Iniciando sync incremental de visitas para tenant: ${this.tenantId} (últimos ${lastDays} dias)`);

      // 1. Carregar conexão e garantir token válido
      await this.loadConnection();
      await this.ensureValidToken();

      // 2. Buscar conexão ativa mais recente para filtrar listings
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
        console.log(`[ML-VISITS] Nenhuma conexão ativa encontrada para tenant ${this.tenantId}`);
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. Buscar listings ativos/pausados APENAS da conexão ativa
      // IMPORTANTE: Incluir active E paused, mas EXCLUIR blocked_by_policy e unauthorized
      const listings = await prisma.listing.findMany({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          status: { in: [ListingStatus.active, ListingStatus.paused] }, // Processar active e paused
          access_status: ListingAccessStatus.accessible, // Apenas listings acessíveis
          marketplace_connection_id: activeConnection.id,
        },
      });

      console.log(`[ML-VISITS] Encontrados ${listings.length} anúncios ativos/pausados acessíveis (conexão: ${activeConnection.id})`);

      if (listings.length === 0) {
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. Processar cada listing
      for (const listing of listings) {
        try {
          const fetchResult = await this.fetchVisitsTimeWindow(listing.listing_id_ext, lastDays);

          if (!fetchResult.ok) {
            console.warn(`[ML-VISITS] Nenhuma visita retornada para listing ${listing.id}: ${fetchResult.message}`);
            continue;
          }

          // 4. Persistir visitas (1 row por dia)
          for (const visitData of fetchResult.visits) {
            const visitDate = new Date(visitData.date);
            visitDate.setHours(0, 0, 0, 0);

            const existing = await prisma.listingMetricsDaily.findUnique({
              where: {
                tenant_id_listing_id_date: {
                  tenant_id: this.tenantId,
                  listing_id: listing.id,
                  date: visitDate,
                },
              },
            });

            if (existing) {
              // Update: apenas visits e source (não sobrescrever outros campos)
              await prisma.listingMetricsDaily.update({
                where: { id: existing.id },
                data: {
                  visits: visitData.visits,
                  source: 'ml_visits_api_daily',
                },
              });
              result.metricsUpdated++;
            } else {
              // Create: apenas visits, date, source (não setar impressions/clicks/ctr)
              await prisma.listingMetricsDaily.create({
                data: {
                  tenant_id: this.tenantId,
                  listing_id: listing.id,
                  date: visitDate,
                  visits: visitData.visits,
                  source: 'ml_visits_api_daily',
                  orders: 0,
                  gmv: 0,
                  impressions: null,
                  clicks: null,
                  ctr: null,
                  conversion: null,
                },
              });
              result.metricsCreated++;
            }
          }

          result.listingsProcessed++;
        } catch (error) {
          // Tratamento de erros específicos
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            
            // 401/403: abortar para tenant (problema de autenticação)
            if (status === 401 || status === 403) {
              const errorMsg = `Erro de autenticação (${status}) para listing ${listing.id}. Abortando sync para tenant.`;
              console.error(`[ML-VISITS] ${errorMsg}`);
              result.errors.push(errorMsg);
              result.duration = Date.now() - startTime;
              return result; // Abortar imediatamente
            }

            // 429: rate limit - retry simples com backoff
            if (status === 429) {
              console.log(`[ML-VISITS] Rate limit (429) para listing ${listing.id}. Aguardando 2s e retry...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              try {
                const retryResult = await this.fetchVisitsTimeWindow(listing.listing_id_ext, lastDays);
                
                if (!retryResult.ok) {
                  console.warn(`[ML-VISITS] Nenhuma visita retornada após retry para listing ${listing.id}: ${retryResult.message}`);
                  continue;
                }
                
                // Processar visitas normalmente após retry
                for (const visitData of retryResult.visits) {
                  const visitDate = new Date(visitData.date);
                  visitDate.setHours(0, 0, 0, 0);

                  const existing = await prisma.listingMetricsDaily.findUnique({
                    where: {
                      tenant_id_listing_id_date: {
                        tenant_id: this.tenantId,
                        listing_id: listing.id,
                        date: visitDate,
                      },
                    },
                  });

                  if (existing) {
                    await prisma.listingMetricsDaily.update({
                      where: { id: existing.id },
                      data: {
                        visits: visitData.visits,
                        source: 'ml_visits_api_daily',
                      },
                    });
                    result.metricsUpdated++;
                  } else {
                    await prisma.listingMetricsDaily.create({
                      data: {
                        tenant_id: this.tenantId,
                        listing_id: listing.id,
                        date: visitDate,
                        visits: visitData.visits,
                        source: 'ml_visits_api_daily',
                        orders: 0,
                        gmv: 0,
                        impressions: null,
                        clicks: null,
                        ctr: null,
                        conversion: null,
                      },
                    });
                    result.metricsCreated++;
                  }
                }
                result.listingsProcessed++;
                continue; // Sucesso após retry
              } catch (retryError) {
                const errorMsg = `Erro após retry (429) para listing ${listing.id}: ${retryError instanceof Error ? retryError.message : 'Erro desconhecido'}`;
                console.error(`[ML-VISITS] ${errorMsg}`);
                result.errors.push(errorMsg);
                // Continuar para próximo listing
                continue;
              }
            }

            // Outros erros: log e continuar
            const errorMsg = `Erro ao processar listing ${listing.id} (${status}): ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`;
            console.error(`[ML-VISITS] ${errorMsg}`);
            result.errors.push(errorMsg);
            continue; // Continuar para próximo listing
          }

          // Erro não-Axios
          const errorMsg = `Erro ao processar listing ${listing.id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          console.error(`[ML-VISITS] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      result.success = result.errors.length === 0 || result.listingsProcessed > 0;
      result.duration = Date.now() - startTime;

      console.log(`[ML-VISITS] Sync incremental concluído em ${result.duration}ms`);
      console.log(`[ML-VISITS] Processados: ${result.listingsProcessed}, Criados: ${result.metricsCreated}, Atualizados: ${result.metricsUpdated}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-VISITS] Erro fatal no sync incremental:', errorMsg);
      return result;
    }
  }

  /**
   * Sincroniza visitas em backfill (últimos 30 dias) para todos os listings do tenant
   * 
   * @param lastDays Número de dias para buscar (padrão: 30)
   * @param batchSize Tamanho do lote (padrão: 10)
   * @param delayMs Delay entre lotes em ms (padrão: 1000)
   */
  async syncVisitsBackfill(
    lastDays: number = 30,
    batchSize: number = 10,
    delayMs: number = 1000
  ): Promise<VisitsSyncResult> {
    const startTime = Date.now();
    const result: VisitsSyncResult = {
      success: false,
      listingsProcessed: 0,
      metricsCreated: 0,
      metricsUpdated: 0,
      errors: [],
      duration: 0,
    };

    try {
      const requestId = `backfill-${Date.now()}`;
      console.log(`[ML-VISITS] [${requestId}] Iniciando backfill de visitas para tenant: ${this.tenantId} (últimos ${lastDays} dias, batch=${batchSize}, delay=${delayMs}ms)`);

      // 1. Carregar conexão e garantir token válido
      await this.loadConnection();
      await this.ensureValidToken();

      // 2. Buscar conexão ativa mais recente para filtrar listings
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
        console.log(`[ML-VISITS] [${requestId}] Nenhuma conexão ativa encontrada para tenant ${this.tenantId}`);
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. Buscar listings ativos/pausados APENAS da conexão ativa
      // IMPORTANTE: Incluir active E paused, mas EXCLUIR blocked_by_policy e unauthorized
      const listings = await prisma.listing.findMany({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          status: { in: [ListingStatus.active, ListingStatus.paused] }, // Processar active e paused
          access_status: ListingAccessStatus.accessible, // Apenas listings acessíveis
          marketplace_connection_id: activeConnection.id,
        },
      });

      console.log(`[ML-VISITS] [${requestId}] Encontrados ${listings.length} anúncios ativos/pausados acessíveis (conexão: ${activeConnection.id})`);

      if (listings.length === 0) {
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. Processar em lotes
      const batches: typeof listings[] = [];
      for (let i = 0; i < listings.length; i += batchSize) {
        batches.push(listings.slice(i, i + batchSize));
      }

      console.log(`[ML-VISITS] [${requestId}] Processando ${batches.length} lotes de até ${batchSize} listings`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`[ML-VISITS] [${requestId}] Processando lote ${batchIndex + 1}/${batches.length} (${batch.length} listings)`);

        // Processar listings do lote em paralelo (com limite)
        const batchPromises = batch.map(async (listing) => {
          const listingRequestId = `${requestId}-listing-${listing.id}`;
          
          try {
            console.log(`[ML-VISITS] [${listingRequestId}] Buscando visitas para listing ${listing.listing_id_ext}`);
            const fetchResult = await this.fetchVisitsTimeWindow(listing.listing_id_ext, lastDays);

            if (!fetchResult.ok) {
              console.warn(`[ML-VISITS] [${listingRequestId}] Nenhuma visita retornada: ${fetchResult.message}`);
              return { success: false, listingId: listing.id };
            }

            // Persistir visitas
            for (const visitData of fetchResult.visits) {
              const visitDate = new Date(visitData.date);
              visitDate.setHours(0, 0, 0, 0);

              const existing = await prisma.listingMetricsDaily.findUnique({
                where: {
                  tenant_id_listing_id_date: {
                    tenant_id: this.tenantId,
                    listing_id: listing.id,
                    date: visitDate,
                  },
                },
              });

              if (existing) {
                await prisma.listingMetricsDaily.update({
                  where: { id: existing.id },
                  data: {
                    visits: visitData.visits,
                    source: 'ml_visits_api_daily',
                  },
                });
                result.metricsUpdated++;
              } else {
                await prisma.listingMetricsDaily.create({
                  data: {
                    tenant_id: this.tenantId,
                    listing_id: listing.id,
                    date: visitDate,
                    visits: visitData.visits,
                    source: 'ml_visits_api_daily',
                    orders: 0,
                    gmv: 0,
                    impressions: null,
                    clicks: null,
                    ctr: null,
                    conversion: null,
                  },
                });
                result.metricsCreated++;
              }
            }

            const visitsCount = fetchResult.ok ? fetchResult.visits.length : 0;
            console.log(`[ML-VISITS] [${listingRequestId}] ✓ Processado: ${visitsCount} dias de visitas`);
            result.listingsProcessed++;
            return { success: true, listingId: listing.id };
          } catch (error) {
            // Tratamento de erros (mesmo padrão do incremental)
            if (axios.isAxiosError(error)) {
              const status = error.response?.status;
              
              if (status === 401 || status === 403) {
                const errorMsg = `Erro de autenticação (${status}) para listing ${listing.id}. Abortando backfill.`;
                console.error(`[ML-VISITS] [${listingRequestId}] ${errorMsg}`);
                result.errors.push(errorMsg);
                return { success: false, listingId: listing.id, abort: true };
              }

              if (status === 429) {
                console.log(`[ML-VISITS] [${listingRequestId}] Rate limit (429). Aguardando 2s e retry...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                try {
                  const retryResult = await this.fetchVisitsTimeWindow(listing.listing_id_ext, lastDays);
                  
                  if (!retryResult.ok) {
                    console.warn(`[ML-VISITS] [${listingRequestId}] Nenhuma visita retornada após retry: ${retryResult.message}`);
                    return { success: false, listingId: listing.id };
                  }
                  
                  // Processar visitas após retry
                  for (const visitData of retryResult.visits) {
                    const visitDate = new Date(visitData.date);
                    visitDate.setHours(0, 0, 0, 0);

                    const existing = await prisma.listingMetricsDaily.findUnique({
                      where: {
                        tenant_id_listing_id_date: {
                          tenant_id: this.tenantId,
                          listing_id: listing.id,
                          date: visitDate,
                        },
                      },
                    });

                    if (existing) {
                      await prisma.listingMetricsDaily.update({
                        where: { id: existing.id },
                        data: {
                          visits: visitData.visits,
                          source: 'ml_visits_api_daily',
                        },
                      });
                      result.metricsUpdated++;
                    } else {
                      await prisma.listingMetricsDaily.create({
                        data: {
                          tenant_id: this.tenantId,
                          listing_id: listing.id,
                          date: visitDate,
                          visits: visitData.visits,
                          source: 'ml_visits_api_daily',
                          orders: 0,
                          gmv: 0,
                          impressions: null,
                          clicks: null,
                          ctr: null,
                          conversion: null,
                        },
                      });
                      result.metricsCreated++;
                    }
                  }
                  result.listingsProcessed++;
                  return { success: true, listingId: listing.id };
                } catch (retryError) {
                  const errorMsg = `Erro após retry (429) para listing ${listing.id}`;
                  console.error(`[ML-VISITS] [${listingRequestId}] ${errorMsg}`);
                  result.errors.push(errorMsg);
                  return { success: false, listingId: listing.id };
                }
              }

              const errorMsg = `Erro ao processar listing ${listing.id} (${status})`;
              console.error(`[ML-VISITS] [${listingRequestId}] ${errorMsg}`);
              result.errors.push(errorMsg);
              return { success: false, listingId: listing.id };
            }

            const errorMsg = `Erro ao processar listing ${listing.id}`;
            console.error(`[ML-VISITS] [${listingRequestId}] ${errorMsg}`);
            result.errors.push(errorMsg);
            return { success: false, listingId: listing.id };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Verificar se algum resultado indica abort
        const shouldAbort = batchResults.some(r => (r as any).abort);
        if (shouldAbort) {
          console.error(`[ML-VISITS] [${requestId}] Abortando backfill devido a erro de autenticação`);
          result.duration = Date.now() - startTime;
          return result;
        }

        // Delay entre lotes (exceto no último lote)
        if (batchIndex < batches.length - 1) {
          console.log(`[ML-VISITS] [${requestId}] Aguardando ${delayMs}ms antes do próximo lote...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      result.success = result.errors.length === 0 || result.listingsProcessed > 0;
      result.duration = Date.now() - startTime;

      console.log(`[ML-VISITS] [${requestId}] Backfill concluído em ${result.duration}ms`);
      console.log(`[ML-VISITS] [${requestId}] Processados: ${result.listingsProcessed}, Criados: ${result.metricsCreated}, Atualizados: ${result.metricsUpdated}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-VISITS] Erro fatal no backfill:', errorMsg);
      return result;
    }
  }

  /**
   * Backfill granular de visitas por dia (30 dias)
   * Processa em batches por itemId e por dia com controle de concorrência
   * 
   * @param days Número de dias para buscar (padrão: 30)
   * @param batchSize Tamanho do batch de itemIds (padrão: 50)
   * @param concurrency Número de requests paralelas (padrão: 5)
   */
  async backfillVisitsGranular(
    days: number = 30,
    batchSize: number = 50,
    concurrency: number = 5
  ): Promise<{
    success: boolean;
    days: number;
    listingsConsidered: number;
    batchesPerDay: number;
    rowsUpserted: number;
    rowsWithNull: number;
    errors: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    const requestId = `backfill-granular-${Date.now()}`;
    const result = {
      success: false,
      days,
      listingsConsidered: 0,
      batchesPerDay: 0,
      rowsUpserted: 0,
      rowsWithNull: 0,
      errors: [] as string[],
      duration: 0,
    };

    try {
      console.log(`[ML-VISITS-BACKFILL] [${requestId}] Iniciando backfill granular tenantId=${this.tenantId} days=${days} batchSize=${batchSize} concurrency=${concurrency}`);

      // 1. Carregar conexão e garantir token válido
      await this.loadConnection();
      await this.ensureValidToken();

      console.log(`[ML-VISITS-BACKFILL] [${requestId}] Conexão carregada tenantId=${this.tenantId} sellerId=${this.providerAccountId}`);

      // 2. Buscar conexão ativa mais recente para filtrar listings
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
        console.log(`[ML-VISITS-BACKFILL] [${requestId}] Nenhuma conexão ativa encontrada para tenant ${this.tenantId}`);
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. Buscar listings APENAS da conexão ativa
      const listings = await prisma.listing.findMany({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          marketplace_connection_id: activeConnection.id,
        },
        select: {
          id: true,
          listing_id_ext: true,
        },
      });

      result.listingsConsidered = listings.length;
      console.log(`[ML-VISITS-BACKFILL] [${requestId}] Listings encontrados: ${listings.length} tenantId=${this.tenantId} (conexão: ${activeConnection.id})`);

      if (listings.length === 0) {
        result.success = true;
        result.duration = Date.now() - startTime;
        console.log(`[ML-VISITS-BACKFILL] [${requestId}] Nenhum listing encontrado, finalizando`);
        return result;
      }

      // 3. Dividir listings em batches de itemIds
      const itemIdBatches: string[][] = [];
      for (let i = 0; i < listings.length; i += batchSize) {
        const batch = listings.slice(i, i + batchSize).map(l => l.listing_id_ext);
        itemIdBatches.push(batch);
      }

      result.batchesPerDay = itemIdBatches.length;
      console.log(`[ML-VISITS-BACKFILL] [${requestId}] Criados ${itemIdBatches.length} batches de até ${batchSize} itemIds`);

      // 4. Processar cada batch com controle de concorrência
      for (let batchIndex = 0; batchIndex < itemIdBatches.length; batchIndex++) {
        const itemIdBatch = itemIdBatches[batchIndex];
        console.log(`[ML-VISITS-BACKFILL] [${requestId}] Processando batch ${batchIndex + 1}/${itemIdBatches.length} (${itemIdBatch.length} itemIds)`);

        // Processar items do batch em paralelo (com limite de concorrência)
        const batchPromises: Promise<void>[] = [];
        
        for (let i = 0; i < itemIdBatch.length; i += concurrency) {
          const chunk = itemIdBatch.slice(i, i + concurrency);
          const chunkPromises = chunk.map(itemId =>
            this.processItemVisitsGranular(itemId, days, requestId, result)
          );
          
          // Aguardar chunk atual antes de processar próximo
          await Promise.allSettled(chunkPromises);
        }
      }

      result.success = result.errors.length === 0 || result.rowsUpserted > 0;
      result.duration = Date.now() - startTime;

      console.log(`[ML-VISITS-BACKFILL] [${requestId}] Backfill concluído tenantId=${this.tenantId} sellerId=${this.providerAccountId} durationMs=${result.duration} rowsUpserted=${result.rowsUpserted} rowsWithNull=${result.rowsWithNull} errors=${result.errors.length}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error(`[ML-VISITS-BACKFILL] [${requestId}] Erro fatal:`, errorMsg);
      return result;
    }
  }

  /**
   * Processa visitas de um item específico (granular por dia)
   * 
   * Sempre faz UPSERT para TODOS os dias do range.
   * - Se API retornar visita para o dia: grava o valor
   * - Se API não retornar visita para o dia: grava visits=NULL
   * - NUNCA grava visits=0
   * 
   * @param itemId ID do item no Mercado Livre
   * @param days Número de dias para buscar
   * @param requestId ID da requisição para logs
   * @param result Objeto de resultado para atualizar contadores
   */
  private async processItemVisitsGranular(
    itemId: string,
    days: number,
    requestId: string,
    result: {
      rowsUpserted: number;
      rowsWithNull: number;
      errors: string[];
    }
  ): Promise<void> {
    try {
      // Buscar conexão ativa mais recente
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

      // Buscar listing pelo itemId (apenas da conexão ativa se existir)
      const listingWhere: any = {
        tenant_id: this.tenantId,
        marketplace: Marketplace.mercadolivre,
        listing_id_ext: itemId,
      };

      if (activeConnection) {
        listingWhere.marketplace_connection_id = activeConnection.id;
      }

      const listing = await prisma.listing.findFirst({
        where: listingWhere,
        select: { id: true },
      });

      if (!listing) {
        console.log(`[ML-VISITS-BACKFILL] [${requestId}] Listing não encontrado para itemId=${itemId}`);
        return;
      }

      // Preparar range de datas (hoje até days-1 dias atrás)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateRange: Date[] = [];
      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        const date = new Date(today);
        date.setDate(date.getDate() - dayOffset);
        dateRange.push(date);
      }

      // Buscar visitas da API com retry e backoff
      let visitsMap = new Map<string, number>(); // date (YYYY-MM-DD) -> visits count
      let apiCallSuccess = false;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          const endpoint = `/items/${itemId}/visits/time_window`;
          const url = `${ML_API_BASE}${endpoint}`;
          
          console.log(`[ML-VISITS-BACKFILL] [${requestId}] Chamando API: ${endpoint} itemId=${itemId} last=${days} unit=day`);

          const response = await axios.get<VisitsTimeWindowResponse>(url, {
            headers: { Authorization: `Bearer ${this.accessToken}` },
            params: {
              last: days,
              unit: 'day',
            },
          });

          const visitsData = response.data.visits || [];
          apiCallSuccess = true;

          // Criar mapa de visitas por data (YYYY-MM-DD)
          for (const visitData of visitsData) {
            const visitDate = new Date(visitData.date);
            visitDate.setHours(0, 0, 0, 0);
            const dateKey = visitDate.toISOString().split('T')[0]; // YYYY-MM-DD
            visitsMap.set(dateKey, visitData.visits);
          }

          console.log(`[ML-VISITS-BACKFILL] [${requestId}] API resposta: statusCode=${response.status} itemId=${itemId} count=${visitsData.length} idsRetornados`);

          break; // Sucesso
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const endpoint = `/items/${itemId}/visits/time_window`;

            // 401/403: abortar (problema de autenticação)
            if (status === 401 || status === 403) {
              const errorMsg = `Erro de autenticação (${status}) para itemId ${itemId} endpoint=${endpoint}`;
              result.errors.push(errorMsg);
              console.error(`[ML-VISITS-BACKFILL] [${requestId}] ${errorMsg}`);
              // Mesmo com erro de auth, vamos gravar NULL para todos os dias
              apiCallSuccess = false;
              break;
            }

            // 429/5xx: backoff e retry
            if (status === 429 || (status && status >= 500)) {
              retries++;
              if (retries < maxRetries) {
                const backoffMs = Math.min(1000 * Math.pow(2, retries), 10000); // Exponential backoff, max 10s
                console.log(`[ML-VISITS-BACKFILL] [${requestId}] Erro ${status} para itemId ${itemId} endpoint=${endpoint}, retry ${retries}/${maxRetries} após ${backoffMs}ms`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue;
              }
            }

            // Outros erros: log, adicionar em errors e continuar (visits = null para todos os dias)
            const errorMsg = `Erro ${status || 'unknown'} para itemId ${itemId} endpoint=${endpoint}`;
            result.errors.push(errorMsg);
            console.log(`[ML-VISITS-BACKFILL] [${requestId}] ${errorMsg} - visits será NULL para todos os dias`);
            apiCallSuccess = false;
            break;
          }

          // Erro não-Axios: log, adicionar em errors e continuar
          const errorMsg = `Erro não-Axios para itemId ${itemId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          result.errors.push(errorMsg);
          console.log(`[ML-VISITS-BACKFILL] [${requestId}] ${errorMsg} - visits será NULL para todos os dias`);
          apiCallSuccess = false;
          break;
        }
      }

      // Se não conseguiu buscar visitas após retries, visitsMap já está vazio (NULL para todos)
      if (!apiCallSuccess && retries >= maxRetries) {
        console.log(`[ML-VISITS-BACKFILL] [${requestId}] Falha ao buscar visitas após ${maxRetries} retries para itemId ${itemId} - gravando NULL para todos os dias`);
      }

      // Processar TODOS os dias do range (sempre fazer UPSERT)
      let itemRowsWithNull = 0;
      for (const date of dateRange) {
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const visitsCount = visitsMap.get(dateKey); // undefined se não retornou da API
        
        // Se não tem visita na resposta da API, gravar NULL (nunca 0)
        const visitsValue = visitsCount !== undefined ? visitsCount : null;

        // UPSERT usando upsert do Prisma
        await prisma.listingMetricsDaily.upsert({
          where: {
            tenant_id_listing_id_date: {
              tenant_id: this.tenantId,
              listing_id: listing.id,
              date,
            },
          },
          create: {
            tenant_id: this.tenantId,
            listing_id: listing.id,
            date,
            visits: visitsValue, // Pode ser número ou NULL
            source: 'visits_api',
            period_days: 1,
            orders: 0,
            gmv: 0,
            impressions: null,
            clicks: null,
            ctr: null,
            conversion: null,
          },
          update: {
            visits: visitsValue, // Atualiza visits (pode ser número ou NULL)
            source: 'visits_api',
            period_days: 1,
          },
        });

        // Contar linhas gravadas
        result.rowsUpserted++;

        // Se visits é NULL, contar em rowsWithNull
        if (visitsValue === null) {
          result.rowsWithNull++;
          itemRowsWithNull++;
        }
      }

      console.log(`[ML-VISITS-BACKFILL] [${requestId}] Processado itemId=${itemId} dias=${days} rowsUpserted=${days} rowsWithNull=${itemRowsWithNull}`);
    } catch (error) {
      const errorMsg = `Erro ao processar itemId ${itemId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      result.errors.push(errorMsg);
      console.error(`[ML-VISITS-BACKFILL] [${requestId}] ${errorMsg}`, error);
    }
  }
}

