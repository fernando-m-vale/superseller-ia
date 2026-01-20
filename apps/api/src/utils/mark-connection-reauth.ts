/**
 * Utility para marcar conexão do Mercado Livre como reauth_required
 * quando houver erros 401/403 da API do ML
 */

import { PrismaClient, Marketplace, ConnectionStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface MarkConnectionReauthOptions {
  tenantId: string;
  statusCode: number;
  errorMessage: string;
  connectionId?: string; // Opcional: se já souber o connectionId
}

/**
 * Marca conexão do Mercado Livre como reauth_required quando houver erro 401/403
 * Salva last_error_code, last_error_at, last_error_message
 */
export async function markConnectionReauthRequired(
  options: MarkConnectionReauthOptions
): Promise<void> {
  const { tenantId, statusCode, errorMessage, connectionId } = options;

  try {
    // Se connectionId não foi fornecido, buscar conexão do tenant
    let connId = connectionId;
    if (!connId) {
      const connection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: Marketplace.mercadolivre,
        },
        orderBy: { updated_at: 'desc' },
      });

      if (!connection) {
        console.warn(`[MARK-REAUTH] Nenhuma conexão encontrada para tenant ${tenantId}`);
        return;
      }

      connId = connection.id;
    }

    // Atualizar conexão com status reauth_required e informações do erro
    await prisma.marketplaceConnection.update({
      where: { id: connId },
      data: {
        status: ConnectionStatus.reauth_required,
        last_error_code: String(statusCode),
        last_error_at: new Date(),
        last_error_message: errorMessage.substring(0, 500), // Limitar tamanho
      },
    });

    console.log(
      {
        tenantId,
        connectionId: connId,
        statusCode,
        errorMessage: errorMessage.substring(0, 100),
      },
      '[MARK-REAUTH] Conexão marcada como reauth_required'
    );
  } catch (error) {
    console.error(
      {
        tenantId,
        connectionId,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      '[MARK-REAUTH] Erro ao marcar conexão como reauth_required'
    );
    // Não propagar erro - apenas logar
  }
}
