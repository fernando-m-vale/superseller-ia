/**
 * ML Connection Resolver
 * 
 * Fonte única de verdade para seleção determinística de conexões Mercado Livre.
 * Sempre escolhe a conexão mais recente e válida do tenant.
 */

import { PrismaClient, Marketplace, ConnectionStatus } from '@prisma/client';

const prisma = new PrismaClient();

export type ConnectionSelectionReason = 
  | 'access_valid' 
  | 'refresh_available' 
  | 'latest_fallback';

export interface ResolvedConnection {
  connection: {
    id: string;
    provider_account_id: string;
    expires_at: Date | null;
    updated_at: Date;
    status: ConnectionStatus;
  };
  reason: ConnectionSelectionReason;
}

/**
 * Resolve a melhor conexão Mercado Livre para um tenant
 * 
 * Critérios de seleção (em ordem de prioridade):
 * 1. access_token presente E expires_at no futuro → prioridade máxima
 * 2. refresh_token presente → prioridade
 * 3. fallback: mais recente (updated_at DESC)
 * 
 * @param tenantId - ID do tenant
 * @returns Conexão escolhida e motivo da seleção
 * @throws Error se nenhuma conexão for encontrada
 */
export async function resolveMercadoLivreConnection(
  tenantId: string
): Promise<ResolvedConnection> {
  // Buscar todas as conexões ML ativas do tenant
  const connections = await prisma.marketplaceConnection.findMany({
    where: {
      tenant_id: tenantId,
      type: Marketplace.mercadolivre,
      status: ConnectionStatus.active,
    },
    orderBy: [
      { updated_at: 'desc' },
      { expires_at: 'desc' },
    ],
    select: {
      id: true,
      provider_account_id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      updated_at: true,
      status: true,
    },
  });

  if (connections.length === 0) {
    throw new Error(`Nenhuma conexão Mercado Livre ativa encontrada para tenant ${tenantId}`);
  }

  const now = new Date();
  const skewMs = 60 * 1000; // 60 segundos de margem

  // Prioridade 1: access_token válido (presente e expires_at no futuro)
  const validAccessConnections = connections.filter(conn => {
    return conn.access_token && 
           conn.expires_at && 
           conn.expires_at.getTime() > (now.getTime() + skewMs);
  });

  if (validAccessConnections.length > 0) {
    // Escolher a mais recente entre as válidas
    const chosen = validAccessConnections[0]; // Já ordenado por updated_at DESC
    
    // Log estruturado (sem tokens)
    console.log(`[ML-CONN-RESOLVER] Conexão selecionada tenantId=${tenantId} connectionId=${chosen.id} providerAccountId=${chosen.provider_account_id} reason=access_valid expiresAt=${chosen.expires_at?.toISOString()} updatedAt=${chosen.updated_at.toISOString()}`);
    
    return {
      connection: {
        id: chosen.id,
        provider_account_id: chosen.provider_account_id,
        expires_at: chosen.expires_at,
        updated_at: chosen.updated_at,
        status: chosen.status,
      },
      reason: 'access_valid',
    };
  }

  // Prioridade 2: refresh_token presente
  const refreshAvailableConnections = connections.filter(conn => {
    return conn.refresh_token && conn.refresh_token.trim().length > 0;
  });

  if (refreshAvailableConnections.length > 0) {
    const chosen = refreshAvailableConnections[0]; // Já ordenado por updated_at DESC
    
    console.log(`[ML-CONN-RESOLVER] Conexão selecionada tenantId=${tenantId} connectionId=${chosen.id} providerAccountId=${chosen.provider_account_id} reason=refresh_available expiresAt=${chosen.expires_at?.toISOString() || 'null'} updatedAt=${chosen.updated_at.toISOString()}`);
    
    return {
      connection: {
        id: chosen.id,
        provider_account_id: chosen.provider_account_id,
        expires_at: chosen.expires_at,
        updated_at: chosen.updated_at,
        status: chosen.status,
      },
      reason: 'refresh_available',
    };
  }

  // Prioridade 3: fallback - mais recente
  const chosen = connections[0]; // Já ordenado por updated_at DESC
  
  console.log(`[ML-CONN-RESOLVER] Conexão selecionada tenantId=${tenantId} connectionId=${chosen.id} providerAccountId=${chosen.provider_account_id} reason=latest_fallback expiresAt=${chosen.expires_at?.toISOString() || 'null'} updatedAt=${chosen.updated_at.toISOString()}`);
  
  return {
    connection: {
      id: chosen.id,
      provider_account_id: chosen.provider_account_id,
      expires_at: chosen.expires_at,
      updated_at: chosen.updated_at,
      status: chosen.status,
    },
    reason: 'latest_fallback',
  };
}
