// apps/api/src/services/mercado-livre-webhook-processor.ts

import type { FastifyInstance } from 'fastify';

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
 * Processador genérico de webhooks do Mercado Livre.
 *
 * Futuro:
 * - Persistir em fila (SQS, etc.)
 * - Disparar workers assíncronos
 * - Atualizar modelos internos (Health Score, etc.)
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

async function handleOrderEvent(
  app: FastifyInstance,
  event: MercadoLivreWebhookEvent,
): Promise<void> {
  app.log.info(
    {
      source: 'mercado-livre-webhook-processor',
      topic: event.topic,
      resource: event.resource,
    },
    'Recebido evento de pedido (orders) do Mercado Livre',
  );

  // TODO:
  // - Buscar detalhes do pedido usando o resource (ex.: /orders/{id})
  // - Persistir/atualizar entidade Order no Prisma
  // - Atualizar métricas internas (ex.: taxa de conversão)
}

async function handleItemEvent(
  app: FastifyInstance,
  event: MercadoLivreWebhookEvent,
): Promise<void> {
  app.log.info(
    {
      source: 'mercado-livre-webhook-processor',
      topic: event.topic,
      resource: event.resource,
    },
    'Recebido evento de item (items) do Mercado Livre',
  );

  // TODO:
  // - Buscar detalhes do item usando o resource (ex.: /items/{id})
  // - Atualizar tabela listing no Prisma
  // - Recalcular Health Score do anúncio
}

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

  // TODO:
  // - Buscar detalhes da pergunta
  // - Atualizar histórico de atendimento / SLA de respostas
}
