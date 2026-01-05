import axios, { AxiosError } from 'axios';
import { PrismaClient, Marketplace, ConnectionStatus, OrderStatus } from '@prisma/client';

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

interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface OrderSyncResult {
  success: boolean;
  ordersProcessed: number;
  ordersCreated: number;
  ordersUpdated: number;
  totalGMV: number;
  errors: string[];
  duration: number;
}

export class MercadoLivreOrdersService {
  private tenantId: string;
  private accessToken: string = '';
  private providerAccountId: string = '';
  private connectionId: string = '';
  private refreshToken: string = '';

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Sincroniza pedidos dos últimos N dias
   */
  async syncOrders(daysBack: number = 30): Promise<OrderSyncResult> {
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

      // 1. Buscar conexão do Mercado Livre
      await this.loadConnection();

      // 2. Verificar/renovar token se necessário
      await this.ensureValidToken();

      // 3. Calcular data de corte
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - daysBack);
      const dateFromISO = dateFrom.toISOString();

      console.log(`[ML-ORDERS] Buscando pedidos desde: ${dateFromISO}`);

      // 4. Buscar pedidos da API do ML
      const orders = await this.fetchOrders(dateFromISO);
      console.log(`[ML-ORDERS] Encontrados ${orders.length} pedidos`);

      if (orders.length === 0) {
        console.log('[ML-ORDERS] Nenhum pedido encontrado para sincronizar');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 5. Processar cada pedido
      for (const order of orders) {
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
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      console.error('[ML-ORDERS] Erro fatal na sincronização:', errorMsg);
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
   * Busca a conexão do Mercado Livre para o tenant
   * Flexibilizado para tentar renovar tokens de conexões expiradas
   */
  private async loadConnection(): Promise<void> {
    console.log(`[ML-ORDERS] ========== BUSCANDO CONEXÃO ==========`);
    console.log(`[ML-ORDERS] Tenant ID: ${this.tenantId}`);
    console.log(`[ML-ORDERS] Marketplace: ${Marketplace.mercadolivre}`);

    // Primeiro, buscar conexão ativa
    let connection = await prisma.marketplaceConnection.findFirst({
      where: {
        tenant_id: this.tenantId,
        type: Marketplace.mercadolivre,
        status: ConnectionStatus.active,
      },
    });

    // Se não encontrou ativa, buscar qualquer conexão do ML para debug
    if (!connection) {
      console.log(`[ML-ORDERS] ❌ Nenhuma conexão ATIVA encontrada. Buscando qualquer conexão...`);
      
      const allConnections = await prisma.marketplaceConnection.findMany({
        where: {
          tenant_id: this.tenantId,
          type: Marketplace.mercadolivre,
        },
      });

      console.log(`[ML-ORDERS] Conexões encontradas para este tenant/marketplace: ${allConnections.length}`);
      
      if (allConnections.length > 0) {
        for (const conn of allConnections) {
          console.log(`[ML-ORDERS] - ID: ${conn.id}, Status: ${conn.status}, Provider: ${conn.provider_account_id}, ExpiresAt: ${conn.expires_at}`);
        }

        // Tentar usar uma conexão expirada e renovar o token
        const expiredConnection = allConnections.find(c => c.status === ConnectionStatus.expired);
        if (expiredConnection && expiredConnection.refresh_token) {
          console.log(`[ML-ORDERS] 🔄 Encontrada conexão EXPIRADA com refresh_token. Tentando renovar...`);
          
          this.connectionId = expiredConnection.id;
          this.refreshToken = expiredConnection.refresh_token;
          this.providerAccountId = expiredConnection.provider_account_id;
          
          try {
            await this.refreshAccessToken(expiredConnection.refresh_token);
            console.log(`[ML-ORDERS] ✅ Token renovado com sucesso! Conexão reativada.`);
            
            // Recarregar a conexão atualizada
            connection = await prisma.marketplaceConnection.findUnique({
              where: { id: this.connectionId },
            });
          } catch (refreshError) {
            console.error(`[ML-ORDERS] ❌ Falha ao renovar token:`, refreshError);
            throw new Error('Conexão expirada e falha ao renovar token. Reconecte a conta do Mercado Livre.');
          }
        }
      }

      // Se ainda não encontrou conexão válida, listar todas do tenant para debug
      if (!connection) {
        const allTenantConnections = await prisma.marketplaceConnection.findMany({
          where: { tenant_id: this.tenantId },
        });
        console.log(`[ML-ORDERS] Todas as conexões do tenant: ${allTenantConnections.length}`);
        for (const conn of allTenantConnections) {
          console.log(`[ML-ORDERS] - Type: ${conn.type}, Status: ${conn.status}, Provider: ${conn.provider_account_id}`);
        }
        
        throw new Error('Conexão com Mercado Livre não encontrada ou inativa. Verifique se a conta está conectada.');
      }
    }

    this.connectionId = connection.id;
    this.accessToken = connection.access_token;
    this.providerAccountId = connection.provider_account_id;
    this.refreshToken = connection.refresh_token || '';

    console.log(`[ML-ORDERS] ✅ Conexão carregada com sucesso!`);
    console.log(`[ML-ORDERS] - Connection ID: ${this.connectionId}`);
    console.log(`[ML-ORDERS] - Provider Account ID: ${this.providerAccountId}`);
    console.log(`[ML-ORDERS] - Status: ${connection.status}`);
    console.log(`[ML-ORDERS] - Expires At: ${connection.expires_at}`);
    console.log(`[ML-ORDERS] - Has Refresh Token: ${!!this.refreshToken}`);
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

    if (expiresAt && expiresAt.getTime() - bufferMs < now.getTime()) {
      console.log('[ML-ORDERS] Token expirado ou prestes a expirar. Renovando...');
      
      if (!connection.refresh_token) {
        throw new Error('Refresh token não disponível. Reconecte a conta.');
      }

      await this.refreshAccessToken(connection.refresh_token);
    } else {
      console.log('[ML-ORDERS] Token válido');
    }
  }

  /**
   * Renova o access token usando o refresh token
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
      console.log('[ML-ORDERS] Token renovado com sucesso');
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error('[ML-ORDERS] Erro ao renovar token:', error.response?.data);
        
        await prisma.marketplaceConnection.update({
          where: { id: this.connectionId },
          data: { status: ConnectionStatus.expired },
        });
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
        console.log('[ML-ORDERS] Recebido 401. Tentando renovar token e retry...');
        
        if (!this.refreshToken) {
          throw new Error('Refresh token não disponível. Reconecte a conta.');
        }

        await this.refreshAccessToken(this.refreshToken);
        
        console.log('[ML-ORDERS] Token renovado. Executando retry...');
        return await fn();
      }
      throw error;
    }
  }

  /**
   * Busca pedidos da API do Mercado Livre
   */
  private async fetchOrders(dateFrom: string): Promise<MLOrder[]> {
    const allOrders: MLOrder[] = [];
    let offset = 0;
    const limit = 50;

    console.log(`[ML-ORDERS] ========== INICIANDO FETCH DE PEDIDOS ==========`);
    console.log(`[ML-ORDERS] Seller ID: ${this.providerAccountId}`);
    console.log(`[ML-ORDERS] Data From: ${dateFrom}`);
    // Log seguro: não expor token

    while (true) {
      const orders = await this.executeWithRetryOn401(async () => {
        try {
          const url = `${ML_API_BASE}/orders/search`;
          const params = {
            seller: this.providerAccountId,
            'order.date_created.from': dateFrom,
            sort: 'date_desc',
            offset,
            limit,
          };
          
          console.log(`[ML-ORDERS] Chamando API: ${url}`);
          console.log(`[ML-ORDERS] Params:`, JSON.stringify(params));

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
          }

          return response.data;
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const data = JSON.stringify(error.response?.data);
            console.error(`[ML-ORDERS] ❌ Erro API ML (${status}):`, data);
            console.error(`[ML-ORDERS] Headers da resposta:`, JSON.stringify(error.response?.headers));
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
      for (const item of mlOrder.order_items || []) {
        // Tentar encontrar o listing correspondente
        const listing = await prisma.listing.findUnique({
          where: {
            tenant_id_marketplace_listing_id_ext: {
              tenant_id: this.tenantId,
              marketplace: Marketplace.mercadolivre,
              listing_id_ext: item.item.id,
            },
          },
        });

        await prisma.orderItem.create({
          data: {
            order_id: order.id,
            listing_id: listing?.id || null,
            listing_id_ext: item.item.id,
            title: item.item.title,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
          },
        });
      }
      console.log(`[ML-ORDERS] ✓ Items criados com sucesso`);

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

