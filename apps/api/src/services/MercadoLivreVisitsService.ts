import axios, { AxiosError } from 'axios';
import { PrismaClient, Marketplace, ConnectionStatus, ListingStatus } from '@prisma/client';

const prisma = new PrismaClient();

const ML_API_BASE = 'https://api.mercadolibre.com';

interface VisitsTimeWindowResponse {
  visits: Array<{
    date: string; // ISO date string (YYYY-MM-DD)
    visits: number;
  }>;
}

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
  private refreshToken: string = '';

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Busca a conexão do Mercado Livre para o tenant
   */
  private async loadConnection(): Promise<void> {
    console.log(`[ML-VISITS] Buscando conexão para tenant: ${this.tenantId}`);

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

    console.log(`[ML-VISITS] Conexão carregada: Provider ${this.providerAccountId}`);
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

    const now = new Date();
    const expiresAt = connection.expires_at;
    const bufferMs = 5 * 60 * 1000; // 5 minutos

    if (!expiresAt || expiresAt.getTime() - bufferMs < now.getTime()) {
      console.log('[ML-VISITS] Token expirado. Renovando...');
      
      if (!connection.refresh_token) {
        throw new Error('Refresh token não disponível. Reconecte a conta.');
      }

      await this.refreshAccessToken(connection.refresh_token);
    }
  }

  /**
   * Renova o access token usando o refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<void> {
    try {
      const credentials = await import('../lib/secrets').then(m => m.getMercadoLivreCredentials());
      
      const response = await axios.post(
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
      console.log('[ML-VISITS] Token renovado com sucesso');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 400 || status === 401) {
          await prisma.marketplaceConnection.update({
            where: { id: this.connectionId },
            data: { status: ConnectionStatus.revoked },
          });
          throw new Error('Conexão expirada. Reconecte sua conta.');
        }
      }
      throw new Error('Falha ao renovar token. Reconecte a conta do Mercado Livre.');
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
        console.log('[ML-VISITS] Recebido 401. Tentando renovar token e retry...');
        
        if (!this.refreshToken) {
          throw new Error('Refresh token não disponível. Reconecte a conta.');
        }

        await this.refreshAccessToken(this.refreshToken);
        console.log('[ML-VISITS] Token renovado. Executando retry...');
        return await fn();
      }
      throw error;
    }
  }

  /**
   * Busca visitas de um item usando Visits API (time_window)
   * 
   * @param itemId ID do item no Mercado Livre
   * @param lastDays Número de dias para buscar (ex: 2, 30)
   * @returns Array de visitas por dia
   */
  async fetchVisitsTimeWindow(itemId: string, lastDays: number): Promise<VisitsTimeWindowResponse['visits']> {
    return this.executeWithRetryOn401(async () => {
      const url = `${ML_API_BASE}/items/${itemId}/visits/time_window`;
      console.log(`[ML-VISITS] Buscando visitas para item ${itemId}, últimos ${lastDays} dias`);

      const response = await axios.get<VisitsTimeWindowResponse>(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        params: {
          last: lastDays,
          unit: 'day',
        },
      });

      return response.data.visits || [];
    });
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

      // 2. Buscar todos os listings ativos do tenant
      const listings = await prisma.listing.findMany({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          status: ListingStatus.active,
        },
      });

      console.log(`[ML-VISITS] Encontrados ${listings.length} anúncios ativos`);

      if (listings.length === 0) {
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. Processar cada listing
      for (const listing of listings) {
        try {
          const visits = await this.fetchVisitsTimeWindow(listing.listing_id_ext, lastDays);

          // 4. Persistir visitas (1 row por dia)
          for (const visitData of visits) {
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
                const visits = await this.fetchVisitsTimeWindow(listing.listing_id_ext, lastDays);
                // Processar visitas normalmente após retry
                for (const visitData of visits) {
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

      // 2. Buscar todos os listings ativos do tenant
      const listings = await prisma.listing.findMany({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          status: ListingStatus.active,
        },
      });

      console.log(`[ML-VISITS] [${requestId}] Encontrados ${listings.length} anúncios ativos`);

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
            const visits = await this.fetchVisitsTimeWindow(listing.listing_id_ext, lastDays);

            // Persistir visitas
            for (const visitData of visits) {
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

            console.log(`[ML-VISITS] [${listingRequestId}] ✓ Processado: ${visits.length} dias de visitas`);
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
                  const visits = await this.fetchVisitsTimeWindow(listing.listing_id_ext, lastDays);
                  // Processar visitas após retry
                  for (const visitData of visits) {
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

      // 2. Buscar todos os listings do tenant (marketplace=mercadolivre)
      const listings = await prisma.listing.findMany({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
        },
        select: {
          id: true,
          listing_id_ext: true,
        },
      });

      result.listingsConsidered = listings.length;
      console.log(`[ML-VISITS-BACKFILL] [${requestId}] Listings encontrados: ${listings.length} tenantId=${this.tenantId}`);

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
      // Buscar listing pelo itemId
      const listing = await prisma.listing.findFirst({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          listing_id_ext: itemId,
        },
        select: { id: true },
      });

      if (!listing) {
        console.log(`[ML-VISITS-BACKFILL] [${requestId}] Listing não encontrado para itemId=${itemId}`);
        return;
      }

      // Buscar visitas com retry e backoff
      let visits: VisitsTimeWindowResponse['visits'] = [];
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          visits = await this.fetchVisitsTimeWindow(itemId, days);
          break; // Sucesso
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;

            // 401/403: abortar (problema de autenticação)
            if (status === 401 || status === 403) {
              const errorMsg = `Erro de autenticação (${status}) para itemId ${itemId}`;
              result.errors.push(errorMsg);
              console.error(`[ML-VISITS-BACKFILL] [${requestId}] ${errorMsg}`);
              return;
            }

            // 429/5xx: backoff e retry
            if (status === 429 || (status && status >= 500)) {
              retries++;
              if (retries < maxRetries) {
                const backoffMs = Math.min(1000 * Math.pow(2, retries), 10000); // Exponential backoff, max 10s
                console.log(`[ML-VISITS-BACKFILL] [${requestId}] Erro ${status} para itemId ${itemId}, retry ${retries}/${maxRetries} após ${backoffMs}ms`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue;
              }
            }

            // Outros erros: log e continuar (visits = null)
            console.log(`[ML-VISITS-BACKFILL] [${requestId}] Erro ${status} para itemId ${itemId}, visits será null`);
            visits = []; // Array vazio = visits será null
            break;
          }

          // Erro não-Axios: log e continuar
          console.log(`[ML-VISITS-BACKFILL] [${requestId}] Erro não-Axios para itemId ${itemId}:`, error instanceof Error ? error.message : 'Erro desconhecido');
          visits = []; // Array vazio = visits será null
          break;
        }
      }

      // Se não conseguiu buscar visitas após retries, visits = null
      if (visits.length === 0 && retries >= maxRetries) {
        // Criar/atualizar métricas com visits = null para cada dia do range
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let dayOffset = 0; dayOffset < days; dayOffset++) {
          const date = new Date(today);
          date.setDate(date.getDate() - dayOffset);

          const existing = await prisma.listingMetricsDaily.findUnique({
            where: {
              tenant_id_listing_id_date: {
                tenant_id: this.tenantId,
                listing_id: listing.id,
                date,
              },
            },
          });

          if (existing) {
            // Update: apenas visits = null (não sobrescrever outros campos)
            await prisma.listingMetricsDaily.update({
              where: { id: existing.id },
              data: {
                visits: null,
                source: 'ml_visits_api_daily',
              },
            });
            result.rowsUpserted++;
            result.rowsWithNull++;
          } else {
            // Create: visits = null
            await prisma.listingMetricsDaily.create({
              data: {
                tenant_id: this.tenantId,
                listing_id: listing.id,
                date,
                visits: null,
                source: 'ml_visits_api_daily',
                orders: 0,
                gmv: 0,
                impressions: null,
                clicks: null,
                ctr: null,
                conversion: null,
              },
            });
            result.rowsUpserted++;
            result.rowsWithNull++;
          }
        }
        return;
      }

      // Processar visitas retornadas (granular por dia)
      for (const visitData of visits) {
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
          // Update: apenas visits e source
          await prisma.listingMetricsDaily.update({
            where: { id: existing.id },
            data: {
              visits: visitData.visits,
              source: 'ml_visits_api_daily',
            },
          });
          result.rowsUpserted++;
        } else {
          // Create: visits, date, source
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
          result.rowsUpserted++;
        }
      }
    } catch (error) {
      const errorMsg = `Erro ao processar itemId ${itemId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      result.errors.push(errorMsg);
      console.error(`[ML-VISITS-BACKFILL] [${requestId}] ${errorMsg}`);
    }
  }
}

