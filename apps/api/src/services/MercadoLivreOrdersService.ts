import axios, { AxiosError } from 'axios';
import { PrismaClient, Marketplace, ConnectionStatus, OrderStatus } from '@prisma/client';
import { markConnectionReauthRequired } from '../utils/mark-connection-reauth';

const prisma = new PrismaClient();

const ML_API_BASE = 'https://api.mercadolibre.com';

// Interfaces para tipagem da API do Mercado Livre
interface MLOrderItem {
  item: {
    id: string;
    title: string;
  };
  quantity: number;
  unit_price: number;
  full_unit_price: number;
}

interface MLPayment {
  id: number;
  status: string;
  date_approved: string | null;
}

interface MLShipping {
  id: number;
  status: string;
  date_created: string;
}

interface MLOrder {
  id: number;
  status: string;
  status_detail: string | null;
  date_created: string;
  date_closed: string | null;
  total_amount: number;
  currency_id: string;
  buyer: {
    id: number;
    nickname: string;
  };
  order_items: MLOrderItem[];
  payments: MLPayment[];
  shipping: MLShipping;
}

interface MLOrdersSearchResponse {
  results: MLOrder[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
}


interface OrderSyncResult {
  success: boolean;
  ordersProcessed: number;
  ordersCreated: number;
  ordersUpdated: number;
  totalGMV: number;
  errors: string[];
  duration: number;
  fetched?: number; // Total de orders buscados da API
  inRangeCount?: number; // Orders dentro do range após filtro local
  fallbackUsed?: boolean; // Se foi usado fallback (busca sem filtro)
  fallbackFetched?: number; // Quantos orders foram buscados no fallback
}

export class MercadoLivreOrdersService {
  private tenantId: string;
  private accessToken: string = '';
  private providerAccountId: string = '';
  private sellerId: string = ''; // ID real do usuário do ML (de users/me)
  private connectionId: string = '';
  private refreshToken: string = '';

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Busca informações do usuário atual do ML (users/me)
   * Usa o ID retornado como fonte de verdade para seller
   */
  private async fetchMe(): Promise<{ id: number; nickname: string; site_id: string }> {
    const response = await this.executeWithRetryOn401(async () => {
      return await axios.get(`${ML_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
    });

    const me = response.data;
    console.log(`[ML-ORDERS] users/me: id=${me.id}, nickname=${me.nickname}, site_id=${me.site_id}`);

    // Se providerAccountId divergir de me.id, logar WARN
    if (this.providerAccountId && String(me.id) !== String(this.providerAccountId)) {
      console.log(`[ML-ORDERS] ⚠️  WARN: providerAccountId (${this.providerAccountId}) diverge de me.id (${me.id}). Usando me.id como seller.`);
    }

    return {
      id: me.id,
      nickname: me.nickname,
      site_id: me.site_id,
    };
  }

  /**
   * Sincroniza pedidos dos últimos N dias
   */
  async syncOrders(daysBack: number = 30): Promise<OrderSyncResult> {
    const dateTo = new Date();
    dateTo.setUTCHours(0, 0, 0, 0);
    
    const dateFrom = new Date(dateTo);
    dateFrom.setUTCDate(dateFrom.getUTCDate() - (daysBack - 1)); // Incluir hoje no range
    
    return this.syncOrdersByRange(dateFrom, dateTo);
  }

  /**
   * Sincroniza pedidos em um range específico de datas (dateFrom até dateTo inclusive)
   */
  async syncOrdersByRange(dateFrom: Date, dateTo: Date): Promise<OrderSyncResult> {
    const startTime = Date.now();
    const result: OrderSyncResult = {
      success: false,
      ordersProcessed: 0,
      ordersCreated: 0,
      ordersUpdated: 0,
      totalGMV: 0,
      errors: [],
      duration: 0,
    };

    try {
      console.log(`[ML-ORDERS] Iniciando sincronização de pedidos para tenant: ${this.tenantId}`);
      console.log(`[ML-ORDERS] Range: ${dateFrom.toISOString()} até ${dateTo.toISOString()}`);

      // 1. Buscar conexão do Mercado Livre
      await this.loadConnection();

      // 2. Verificar/renovar token se necessário
      await this.ensureValidToken();

      // 3. Buscar users/me para obter seller ID real
      try {
        const me = await this.fetchMe();
        this.sellerId = String(me.id);
        console.log(`[ML-ORDERS] Seller ID confirmado via users/me: ${this.sellerId}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[ML-ORDERS] Erro ao buscar users/me: ${errorMsg}`);
        // Continuar com providerAccountId como fallback, mas logar
        this.sellerId = this.providerAccountId;
        console.log(`[ML-ORDERS] Usando providerAccountId como fallback: ${this.sellerId}`);
      }

      // 3. Normalizar datas para UTC (from: 00:00:00.000Z, to: 23:59:59.999Z)
      const dateFromUtc = new Date(dateFrom);
      dateFromUtc.setUTCHours(0, 0, 0, 0);
      const dateFromISO = dateFromUtc.toISOString(); // YYYY-MM-DDT00:00:00.000Z

      const dateToUtc = new Date(dateTo);
      dateToUtc.setUTCHours(23, 59, 59, 999);
      const dateToISO = dateToUtc.toISOString(); // YYYY-MM-DDT23:59:59.999Z

      // Logs estruturados para debug
      console.log(`[ML-ORDERS] ========== SYNC ORDERS BY RANGE ==========`);
      console.log(`[ML-ORDERS] Tenant ID: ${this.tenantId}`);
      console.log(`[ML-ORDERS] Connection ID: ${this.connectionId}`);
      console.log(`[ML-ORDERS] Seller ID: ${this.providerAccountId}`);
      console.log(`[ML-ORDERS] Range From: ${dateFromISO}`);
      console.log(`[ML-ORDERS] Range To: ${dateToISO}`);

      // 4. Buscar pedidos da API do ML com filtro de data
      const orders = await this.fetchOrders(dateFromISO, dateToISO);
      result.fetched = orders.length;
      console.log(`[ML-ORDERS] Orders buscados da API: ${orders.length}`);

      // 5. Filtrar orders localmente pelo range (date_created)
      const ordersInRange = orders.filter(order => {
        const orderDate = new Date(order.date_created);
        return orderDate >= dateFromUtc && orderDate <= dateToUtc;
      });
      result.inRangeCount = ordersInRange.length;
      console.log(`[ML-ORDERS] Orders dentro do range após filtro local: ${ordersInRange.length}`);

      // 6. Fallback: se fetched === 0, buscar últimos pedidos sem filtro
      let finalOrders = ordersInRange;
      if (orders.length === 0) {
        console.log(`[ML-ORDERS] ⚠️  Nenhum pedido encontrado com filtro. Tentando fallback (últimos 100 pedidos sem filtro)...`);
        const fallbackOrders = await this.fetchOrdersFallback(100);
        result.fallbackUsed = true;
        result.fallbackFetched = fallbackOrders.length;
        console.log(`[ML-ORDERS] Fallback: ${fallbackOrders.length} pedidos buscados`);

        // Filtrar localmente pelo range
        const fallbackInRange = fallbackOrders.filter(order => {
          const orderDate = new Date(order.date_created);
          return orderDate >= dateFromUtc && orderDate <= dateToUtc;
        });
        console.log(`[ML-ORDERS] Fallback: ${fallbackInRange.length} pedidos dentro do range`);
        finalOrders = fallbackInRange;
        result.inRangeCount = fallbackInRange.length;
      }

      if (finalOrders.length === 0) {
        console.log(`[ML-ORDERS] ⚠️  Nenhum pedido encontrado no range ${dateFromISO} até ${dateToISO}`);
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 7. Processar cada pedido
      for (const order of finalOrders) {
        try {
          const { created, gmv } = await this.upsertOrder(order);
          result.ordersProcessed++;
          result.totalGMV += gmv;
          
          if (created) {
            result.ordersCreated++;
          } else {
            result.ordersUpdated++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          result.errors.push(`Pedido ${order.id}: ${errorMsg}`);
          console.error(`[ML-ORDERS] Erro ao processar pedido ${order.id}:`, errorMsg);
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      console.log(`[ML-ORDERS] Sincronização concluída em ${result.duration}ms`);
      console.log(`[ML-ORDERS] Processados: ${result.ordersProcessed}, Criados: ${result.ordersCreated}, Atualizados: ${result.ordersUpdated}`);
      console.log(`[ML-ORDERS] GMV Total: R$ ${result.totalGMV.toFixed(2)}`);

      return result;
    } catch (error) {
      // Não engolir erros - propagar para o caller
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Se for erro da API do ML com statusCode, propagar
      if ((error as any).statusCode) {
        console.error('[ML-ORDERS] Erro da API do ML propagado:', errorMsg);
        throw error; // Propagar erro com statusCode
      }
      
      // Erros de autenticação/token: propagar
      if (errorMsg.includes('Conexão') || errorMsg.includes('token') || errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('AUTH_REVOKED')) {
        console.error('[ML-ORDERS] Erro de autenticação propagado:', errorMsg);
        throw error; // Propagar erros de autenticação
      }
      
      // Outros erros: adicionar ao result e retornar (não propagar)
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-ORDERS] Erro não crítico na sincronização:', errorMsg);
      result.success = false;
      
      return result;
    }
  }

  /**
   * Processa um único pedido (para webhooks em tempo real)
   */
  async processOrderById(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[ML-ORDERS] Processando pedido individual: ${orderId}`);

      // Carregar conexão se ainda não carregada
      if (!this.accessToken) {
        await this.loadConnection();
        await this.ensureValidToken();
      }

      // Buscar detalhes do pedido
      const order = await this.fetchOrderDetails(orderId);
      
      if (!order) {
        return { success: false, error: 'Pedido não encontrado na API do ML' };
      }

      await this.upsertOrder(order);
      
      console.log(`[ML-ORDERS] Pedido ${orderId} processado com sucesso`);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[ML-ORDERS] Erro ao processar pedido ${orderId}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Busca a conexão do Mercado Livre para o tenant usando resolver centralizado
   */
  private async loadConnection(): Promise<void> {
    console.log(`[ML-ORDERS] ========== BUSCANDO CONEXÃO ==========`);
    console.log(`[ML-ORDERS] Tenant ID: ${this.tenantId}`);

    const { resolveMercadoLivreConnection } = await import('../utils/ml-connection-resolver');
    const resolved = await resolveMercadoLivreConnection(this.tenantId);
    
    this.connectionId = resolved.connection.id;
    this.providerAccountId = resolved.connection.provider_account_id;
    this.refreshToken = ''; // Será obtido via getValidAccessToken se necessário

    console.log(`[ML-ORDERS] ✅ Conexão carregada: Provider ${this.providerAccountId}, ConnectionId=${this.connectionId}, Reason=${resolved.reason}`);
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
      console.log(`[ML-ORDERS] Token renovado connectionId=${this.connectionId} expiresAt=${tokenResult.expiresAt.toISOString()}`);
    } else {
      console.log(`[ML-ORDERS] Token válido (não renovado) connectionId=${this.connectionId} expiresAt=${tokenResult.expiresAt.toISOString()}`);
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
        console.log(`[ML-ORDERS] Recebido 401. Tentando renovar token e retry connectionId=${this.connectionId}...`);
        
        // Renovar token via helper (que já trata refresh_token)
        const { getValidAccessToken } = await import('../utils/ml-token-helper');
        const tokenResult = await getValidAccessToken(this.connectionId);
        this.accessToken = tokenResult.token;
        
        console.log(`[ML-ORDERS] Token renovado. Executando retry connectionId=${this.connectionId}...`);
        return await fn();
      }
      throw error;
    }
  }

  /**
   * Busca pedidos da API do Mercado Livre com filtro de data (from até to)
   */
  private async fetchOrders(dateFrom: string, dateTo: string): Promise<MLOrder[]> {
    const allOrders: MLOrder[] = [];
    let offset = 0;
    // ML API limita limit a 51 (não aceita > 51)
    // Clamp explícito: garantir que nunca exceda 51
    const requestedLimit = 50; // Valor padrão
    const limit = Math.min(requestedLimit ?? 51, 51); // Clamp explícito: limit nunca excede 51

    console.log(`[ML-ORDERS] ========== INICIANDO FETCH DE PEDIDOS COM FILTRO ==========`);
    console.log(`[ML-ORDERS] Seller ID: ${this.providerAccountId}`);
    console.log(`[ML-ORDERS] Date From: ${dateFrom}`);
    console.log(`[ML-ORDERS] Date To: ${dateTo}`);

    while (true) {
      const orders = await this.executeWithRetryOn401(async () => {
        try {
          const url = `${ML_API_BASE}/orders/search`;
          const params: Record<string, string | number> = {
            seller: this.sellerId || this.providerAccountId, // Usar sellerId (de users/me) como fonte de verdade
            'order.date_created.from': dateFrom,
            'order.date_created.to': dateTo,
            sort: 'date_desc',
            offset,
            limit,
          };
          
          console.log(`[ML-ORDERS] Chamando API: ${url}`);
          console.log(`[ML-ORDERS] Query params enviados:`, JSON.stringify(params, null, 2));
          console.log(`[ML-ORDERS] Seller usado: ${params.seller} (sellerId=${this.sellerId}, providerAccountId=${this.providerAccountId})`);

          const response = await axios.get<MLOrdersSearchResponse>(url, {
            headers: { Authorization: `Bearer ${this.accessToken}` },
            params,
          });

          console.log(`[ML-ORDERS] Resposta status: ${response.status}`);
          console.log(`[ML-ORDERS] Paging: total=${response.data.paging.total}, offset=${response.data.paging.offset}, limit=${response.data.paging.limit}`);
          console.log(`[ML-ORDERS] Results neste lote: ${response.data.results.length}`);
          
          // Log do primeiro pedido para debug
          if (response.data.results.length > 0) {
            const firstOrder = response.data.results[0];
            console.log(`[ML-ORDERS] Exemplo de pedido: ID=${firstOrder.id}, Status=${firstOrder.status}, Total=${firstOrder.total_amount}, Date=${firstOrder.date_created}`);
          } else if (offset === 0) {
            console.log(`[ML-ORDERS] ⚠️  WARN: Nenhum pedido encontrado com os filtros aplicados`);
            console.log(`[ML-ORDERS] Seller ID: ${this.providerAccountId}`);
            console.log(`[ML-ORDERS] Date From: ${dateFrom}`);
            console.log(`[ML-ORDERS] Date To: ${dateTo}`);
          }

          return response.data;
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const data = error.response?.data;
            const dataStr = JSON.stringify(data);
            
            console.error(`[ML-ORDERS] ❌ Erro API ML (${status}):`, dataStr);
            console.error(`[ML-ORDERS] Headers da resposta:`, JSON.stringify(error.response?.headers));
            
            // Não engolir erros HTTP - propagar para o caller
            if (status === 401 || status === 403 || status === 400) {
              // Marcar conexão como reauth_required se for 401/403
              if (status === 401 || status === 403) {
                await markConnectionReauthRequired({
                  tenantId: this.tenantId,
                  statusCode: status,
                  errorMessage: data?.message || `ML API Error ${status}`,
                  connectionId: this.connectionId,
                });
              }

              // Criar erro customizado com informações sanitizadas
              const mlError = new Error(`ML API Error ${status}: ${data?.message || dataStr}`);
              (mlError as any).statusCode = status;
              (mlError as any).mlErrorBody = data; // Sanitizado (sem token)
              throw mlError;
            }
            
            throw error;
          }
          throw error;
        }
      });

      allOrders.push(...orders.results);
      console.log(`[ML-ORDERS] ✓ Buscados ${allOrders.length}/${orders.paging.total} pedidos`);

      if (offset + limit >= orders.paging.total || orders.paging.total === 0) {
        break;
      }

      offset += limit;
    }

    console.log(`[ML-ORDERS] ========== FIM DO FETCH: ${allOrders.length} pedidos ==========`);
    return allOrders;
  }

  /**
   * Busca últimos N pedidos sem filtro de data (fallback quando filtro retorna 0)
   * ML API limita limit a 51 (não aceita > 51)
   */
  private async fetchOrdersFallback(requestedLimit: number = 100): Promise<MLOrder[]> {
    // Clamp explícito: limit nunca excede 51 (ML API não aceita > 51)
    const limit = Math.min(requestedLimit ?? 51, 51);
    
    console.log(`[ML-ORDERS] ========== FALLBACK: BUSCANDO ÚLTIMOS ${limit} PEDIDOS SEM FILTRO ==========`);
    console.log(`[ML-ORDERS] Fallback - requestedLimit=${requestedLimit}, clamped limit=${limit}`);
    
    const url = `${ML_API_BASE}/orders/search`;
    const params: Record<string, string | number> = {
      seller: this.sellerId || this.providerAccountId, // Usar sellerId (de users/me) como fonte de verdade
      sort: 'date_desc',
      offset: 0,
      limit, // Garantido <= 51
    };
    
    console.log(`[ML-ORDERS] Fallback - Chamando API: ${url}`);
    console.log(`[ML-ORDERS] Fallback - Query params:`, JSON.stringify(params, null, 2));
    console.log(`[ML-ORDERS] Fallback - Seller usado: ${params.seller}`);

    const response = await this.executeWithRetryOn401(async () => {
      try {
        return await axios.get<MLOrdersSearchResponse>(url, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          params,
        });
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const data = error.response?.data;
          const dataStr = JSON.stringify(data);
          
          console.error(`[ML-ORDERS] Fallback - ❌ Erro API ML (${status}):`, dataStr);
          
            // Não engolir erros HTTP - propagar
            if (status === 401 || status === 403 || status === 400) {
              // Marcar conexão como reauth_required se for 401/403
              if (status === 401 || status === 403) {
                await markConnectionReauthRequired({
                  tenantId: this.tenantId,
                  statusCode: status,
                  errorMessage: data?.message || `ML API Error ${status}`,
                  connectionId: this.connectionId,
                });
              }

              const mlError = new Error(`ML API Error ${status}: ${data?.message || dataStr}`);
              (mlError as any).statusCode = status;
              (mlError as any).mlErrorBody = data;
              throw mlError;
            }
        }
        throw error;
      }
    });

    const httpStatus = response.status;
    const pagingTotal = response.data.paging.total;
    const resultsLength = response.data.results.length;

    console.log(`[ML-ORDERS] Fallback - HTTP Status: ${httpStatus}`);
    console.log(`[ML-ORDERS] Fallback - Paging Total: ${pagingTotal}`);
    console.log(`[ML-ORDERS] Fallback - Results Length: ${resultsLength}`);

    // Se paging.total > 0 mas results.length === 0, logar WARN
    if (pagingTotal > 0 && resultsLength === 0) {
      console.log(`[ML-ORDERS] Fallback - ⚠️  WARN: paging.total=${pagingTotal} mas results.length=0. Possível problema de paginação ou offset.`);
    }

    if (resultsLength > 0) {
      const firstOrder = response.data.results[0];
      const lastOrder = response.data.results[resultsLength - 1];
      console.log(`[ML-ORDERS] Fallback - Primeiro pedido: ID=${firstOrder.id}, Date=${firstOrder.date_created}`);
      console.log(`[ML-ORDERS] Fallback - Último pedido: ID=${lastOrder.id}, Date=${lastOrder.date_created}`);
    } else if (pagingTotal === 0) {
      console.log(`[ML-ORDERS] Fallback - ⚠️  WARN: Nenhum pedido encontrado (paging.total=0). Verificar seller ID e token.`);
    }

    return response.data.results;
  }

  /**
   * Busca detalhes de um pedido específico
   */
  private async fetchOrderDetails(orderId: string): Promise<MLOrder | null> {
    return this.executeWithRetryOn401(async () => {
      try {
        const url = `${ML_API_BASE}/orders/${orderId}`;
        console.log(`[ML-ORDERS] Buscando detalhes do pedido: ${url}`);

        const response = await axios.get<MLOrder>(url, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });

        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            return null;
          }
          const status = error.response?.status;
          const data = JSON.stringify(error.response?.data);
          console.error(`[ML-ORDERS] Erro ao buscar pedido (${status}):`, data);
          throw error;
        }
        throw error;
      }
    });
  }

  /**
   * Faz upsert de um pedido no banco
   */
  private async upsertOrder(mlOrder: MLOrder): Promise<{ created: boolean; gmv: number }> {
    const orderStatus = this.mapMLStatusToOrderStatus(mlOrder.status);
    const totalAmount = mlOrder.total_amount;

    console.log(`[ML-ORDERS] Processando pedido ${mlOrder.id}: status=${mlOrder.status} -> ${orderStatus}, total=${totalAmount}`);

    // Encontrar data de pagamento
    const paidPayment = mlOrder.payments?.find(p => p.status === 'approved');
    const paidDate = paidPayment?.date_approved ? new Date(paidPayment.date_approved) : null;

    // Verificar se já existe
    const existing = await prisma.order.findUnique({
      where: {
        tenant_id_marketplace_order_id_ext: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          order_id_ext: String(mlOrder.id),
        },
      },
    });

    if (existing) {
      // Update
      console.log(`[ML-ORDERS] ✓ Atualizando pedido existente: ${existing.id}`);
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          status: orderStatus,
          total_amount: totalAmount,
          paid_date: paidDate,
          buyer_nickname: mlOrder.buyer?.nickname,
        },
      });

      return { created: false, gmv: totalAmount };
    } else {
      // Create order com items
      console.log(`[ML-ORDERS] ✓ Criando novo pedido no banco...`);
      const order = await prisma.order.create({
        data: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          order_id_ext: String(mlOrder.id),
          status: orderStatus,
          total_amount: totalAmount,
          currency: mlOrder.currency_id || 'BRL',
          buyer_nickname: mlOrder.buyer?.nickname,
          buyer_id_ext: mlOrder.buyer?.id ? String(mlOrder.buyer.id) : null,
          order_date: new Date(mlOrder.date_created),
          paid_date: paidDate,
        },
      });
      console.log(`[ML-ORDERS] ✓ Pedido criado com ID interno: ${order.id}`);

      // Criar order items
      console.log(`[ML-ORDERS] Criando ${mlOrder.order_items?.length || 0} items...`);
      
      // Buscar listings em batch antes de criar items (mais eficiente)
      const listingIdExts = (mlOrder.order_items || []).map(item => item.item.id);
      const listings = await prisma.listing.findMany({
        where: {
          tenant_id: this.tenantId,
          marketplace: Marketplace.mercadolivre,
          listing_id_ext: { in: listingIdExts },
        },
        select: {
          id: true,
          listing_id_ext: true,
        },
      });

      // Criar mapa de lookup: listing_id_ext -> listing.id
      const listingMap = new Map<string, string>();
      for (const listing of listings) {
        listingMap.set(listing.listing_id_ext, listing.id);
      }

      // Criar order items com listing_id preenchido
      for (const item of mlOrder.order_items || []) {
        const listingId = listingMap.get(item.item.id) || null;
        
        if (!listingId) {
          console.log(`[ML-ORDERS] ⚠️  Listing não encontrado para item ${item.item.id} (${item.item.title})`);
        }

        await prisma.orderItem.create({
          data: {
            order_id: order.id,
            listing_id: listingId, // Preencher com ID do listing encontrado ou null
            listing_id_ext: item.item.id,
            title: item.item.title,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
          },
        });
      }
      console.log(`[ML-ORDERS] ✓ Items criados com sucesso (${listings.length}/${listingIdExts.length} com listing_id preenchido)`);

      return { created: true, gmv: totalAmount };
    }
  }

  /**
   * Mapeia status do ML para OrderStatus
   */
  private mapMLStatusToOrderStatus(mlStatus: string): OrderStatus {
    switch (mlStatus.toLowerCase()) {
      case 'confirmed':
      case 'payment_required':
        return OrderStatus.pending;
      case 'paid':
      case 'partially_paid':
        return OrderStatus.paid;
      case 'shipped':
      case 'ready_to_ship':
        return OrderStatus.shipped;
      case 'delivered':
        return OrderStatus.delivered;
      case 'cancelled':
        return OrderStatus.cancelled;
      default:
        return OrderStatus.pending;
    }
  }
}

