// apps/api/src/routes/mercado-livre-webhook.ts

import type { FastifyInstance, FastifyPluginAsync } from "fastify";

/**
 * Estrutura base do payload de webhook do Mercado Livre.
 * Referência (simplificada) da documentação:
 * https://developers.mercadolivre.com.br/en_us/products-receive-notifications
 */
interface MercadoLivreWebhookPayload {
  resource?: string;       // Ex.: "/orders/1234567890"
  user_id?: number | string;
  topic?: string;          // Ex.: "orders_v2", "items", "questions"
  application_id?: number | string;
  attempts?: number;
  sent?: string;           // ISO date
  received?: string;       // ISO date
}

/**
 * Plugin de rotas de webhook do Mercado Livre
 *
 * URL pública configurada no DevCenter:
 *   https://api.superselleria.com.br/api/v1/webhooks/mercadolivre
 */
export const mercadoLivreWebhookRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
) => {
  app.post<{
    Body: MercadoLivreWebhookPayload;
  }>(
    "/api/v1/webhooks/mercadolivre",
    async (request, reply) => {
      const payload = request.body ?? {};
      const {
        resource,
        topic,
        user_id,
        application_id,
        attempts,
        sent,
        received,
      } = payload;

      // 🔎 Log estruturado do evento recebido
      app.log.info(
        {
          source: "mercado-livre-webhook",
          topic,
          resource,
          user_id,
          application_id,
          attempts,
          sent,
          received,
          rawPayload: payload,
        },
        "Webhook do Mercado Livre recebido",
      );

      // ✅ Validação mínima de campos obrigatórios
      if (!resource || !topic || !user_id) {
        app.log.warn(
          {
            source: "mercado-livre-webhook",
            resource,
            topic,
            user_id,
          },
          "Payload de webhook do Mercado Livre sem campos mínimos (resource/topic/user_id)",
        );

        // Mesmo com payload inválido, retornamos 200 para evitar retries infinitos
        return reply.status(200).send({ ok: true });
      }

      // 🔄 Normalização de tipos
      const normalizedUserId = Number(user_id);
      const normalizedApplicationId =
        application_id !== undefined ? Number(application_id) : undefined;

      // 🗂️ Estrutura normalizada (futuro: fila / worker)
      const normalizedEvent = {
        provider: "mercado-livre" as const,
        topic,
        resource,
        userId: normalizedUserId,
        applicationId: normalizedApplicationId,
        attempts: attempts ?? 1,
        timestamps: {
          sent,
          received,
        },
      };

      app.log.debug(
        {
          source: "mercado-livre-webhook",
          normalizedEvent,
        },
        "Evento Mercado Livre normalizado para processamento interno",
      );

      // TODO: Persistir em fila / banco e disparar processamento assíncrono

      return reply.status(200).send({ ok: true });
    },
  );
};
