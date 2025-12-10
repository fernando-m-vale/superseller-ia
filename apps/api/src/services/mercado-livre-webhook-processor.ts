// apps/api/src/services/mercado-livre-webhook-processor.ts

import type { FastifyInstance } from 'fastify';
import { PrismaClient, Marketplace, ConnectionStatus } from '@prisma/client';
import { MercadoLivreOrdersService } from './MercadoLivreOrdersService';
import { MercadoLivreSyncService } from './MercadoLivreSyncService';

const prisma = new PrismaClient();

export interface MercadoLivreWebhookEvent {
  provider: 'mercado-livre';
  topic: string;
  resource: string;
  userId: number;
  applicationId?: number;
  attempts: number;
  timestamps: {
    sent?: string;
    received?: string;
  };
}

/**
 * Processador de webhooks do Mercado Livre.
 * 
 * Tópicos suportados:
 * - orders / orders_v2: Notificações de pedidos (novos, atualizados)
 * - items: Notificações de alterações em anúncios
 * - questions: Perguntas de compradores
 */
export async function handleMercadoLivreWebhook(
  app: FastifyInstance,
  event: MercadoLivreWebhookEvent,
): Promise<void> {
  app.log.info(
    {
      source: 'mercado-livre-webhook-processor',
      event,
    },
    'Processando webhook do Mercado Livre',
  );

  switch (event.topic) {
    case 'orders_v2':
    case 'orders':
      await handleOrderEvent(app, event);
      break;

    case 'items':
      await handleItemEvent(app, event);
      break;

    case 'questions':
      await handleQuestionEvent(app, event);
      break;

    default:
      app.log.info(
        {
          source: 'mercado-livre-webhook-processor',
          topic: event.topic,
        },
        'Webhook de tópico não tratado ainda, ignorando por enquanto',
      );
  }
}

/**
 * Processa eventos de pedidos (orders/orders_v2)
 * O resource vem no formato "/orders/{order_id}"
 */
async function handleOrderEvent(
  app: FastifyInstance,
  event: MercadoLivreWebhookEvent,
): Promise<void> {
  app.log.info(
    {
      source: 'mercado-livre-webhook-processor',
      topic: event.topic,
      resource: event.resource,
      userId: event.userId,
    },
    'Recebido evento de pedido (orders) do Mercado Livre',
  );

  try {
    // Extrair order ID do resource (ex: /orders/12345678)
    const orderId = extractIdFromResource(event.resource);
    
    if (!orderId) {
      app.log.error({ resource: event.resource }, 'Não foi possível extrair order ID do resource');
      return;
    }

    // Encontrar tenant pelo userId do ML (provider_account_id)
    const tenantId = await findTenantByMLUserId(String(event.userId));
    
    if (!tenantId) {
      app.log.warn(
        { userId: event.userId },
        'Nenhum tenant encontrado para o userId do Mercado Livre',
      );
      return;
    }

    app.log.info(
      { orderId, tenantId },
      'Processando pedido para tenant',
    );

    // Instanciar service e processar pedido
    const ordersService = new MercadoLivreOrdersService(tenantId);
    const result = await ordersService.processOrderById(orderId);

    if (result.success) {
      app.log.info({ orderId }, 'Pedido processado com sucesso via webhook');
    } else {
      app.log.error({ orderId, error: result.error }, 'Erro ao processar pedido via webhook');
    }
  } catch (error) {
    app.log.error(
      { error, resource: event.resource },
      'Erro fatal ao processar evento de pedido',
    );
  }
}

/**
 * Processa eventos de items (anúncios)
 * O resource vem no formato "/items/{item_id}"
 */
async function handleItemEvent(
  app: FastifyInstance,
  event: MercadoLivreWebhookEvent,
): Promise<void> {
  app.log.info(
    {
      source: 'mercado-livre-webhook-processor',
      topic: event.topic,
      resource: event.resource,
      userId: event.userId,
    },
    'Recebido evento de item (items) do Mercado Livre',
  );

  try {
    // Extrair item ID do resource (ex: /items/MLB123456)
    const itemId = extractIdFromResource(event.resource);
    
    if (!itemId) {
      app.log.error({ resource: event.resource }, 'Não foi possível extrair item ID do resource');
      return;
    }

    // Encontrar tenant pelo userId do ML
    const tenantId = await findTenantByMLUserId(String(event.userId));
    
    if (!tenantId) {
      app.log.warn(
        { userId: event.userId },
        'Nenhum tenant encontrado para o userId do Mercado Livre',
      );
      return;
    }

    app.log.info(
      { itemId, tenantId },
      'Item alterado - Disparando sync completo para o tenant',
    );

    // Por simplicidade, dispara sync completo dos listings
    // Em produção, poderia fazer sync apenas do item específico
    const syncService = new MercadoLivreSyncService(tenantId);
    await syncService.syncListings();

    app.log.info({ itemId }, 'Sync de listings concluído após evento de item');
  } catch (error) {
    app.log.error(
      { error, resource: event.resource },
      'Erro ao processar evento de item',
    );
  }
}

/**
 * Processa eventos de perguntas
 * O resource vem no formato "/questions/{question_id}"
 */
async function handleQuestionEvent(
  app: FastifyInstance,
  event: MercadoLivreWebhookEvent,
): Promise<void> {
  app.log.info(
    {
      source: 'mercado-livre-webhook-processor',
      topic: event.topic,
      resource: event.resource,
    },
    'Recebido evento de pergunta (questions) do Mercado Livre',
  );

  // TODO: Implementar processamento de perguntas
  // - Buscar detalhes da pergunta via API
  // - Armazenar no banco para SLA de respostas
  // - Notificar usuário (email/push)
  
  app.log.info('Processamento de perguntas ainda não implementado - ignorando');
}

/**
 * Extrai o ID de um resource string
 * Ex: "/orders/12345" -> "12345"
 * Ex: "/items/MLB123456" -> "MLB123456"
 */
function extractIdFromResource(resource: string): string | null {
  const parts = resource.split('/').filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

/**
 * Encontra o tenantId baseado no userId do Mercado Livre
 */
async function findTenantByMLUserId(mlUserId: string): Promise<string | null> {
  const connection = await prisma.marketplaceConnection.findFirst({
    where: {
      type: Marketplace.mercadolivre,
      provider_account_id: mlUserId,
      status: ConnectionStatus.active,
    },
    select: {
      tenant_id: true,
    },
  });

  return connection?.tenant_id || null;
}
