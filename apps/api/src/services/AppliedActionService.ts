/**
 * AppliedActionService
 * 
 * Service para gerenciar ações aplicadas pelo usuário.
 * Permite registrar quando uma sugestão foi aplicada (sem integração real com ML ainda).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ApplyActionInput {
  tenantId: string;
  listingId: string;
  actionType: 'seo' | 'midia' | 'cadastro' | 'competitividade';
  beforePayload: Record<string, unknown>;
  afterPayload: Record<string, unknown>;
}

export interface AppliedActionResult {
  id: string;
  tenantId: string;
  listingId: string;
  actionType: string;
  appliedAt: Date;
  createdAt: Date;
}

export class AppliedActionService {
  /**
   * Aplica uma ação (cria ou atualiza se já existir)
   */
  async applyAction(input: ApplyActionInput): Promise<AppliedActionResult> {
    const { tenantId, listingId, actionType, beforePayload, afterPayload } = input;

    // Validar se listing existe e pertence ao tenant
    const listing = await prisma.listing.findFirst({
      where: {
        id: listingId,
        tenant_id: tenantId,
      },
    });

    if (!listing) {
      throw new Error('Listing não encontrado ou não pertence ao tenant');
    }

    // Upsert: se já existe ação do mesmo tipo, atualiza; senão, cria
    const appliedAction = await prisma.appliedAction.upsert({
      where: {
        tenant_id_listing_id_action_type: {
          tenant_id: tenantId,
          listing_id: listingId,
          action_type: actionType,
        },
      },
      update: {
        before_payload: beforePayload as any,
        after_payload: afterPayload as any,
        applied_at: new Date(),
      },
      create: {
        tenant_id: tenantId,
        listing_id: listingId,
        action_type: actionType,
        before_payload: beforePayload as any,
        after_payload: afterPayload as any,
        applied_at: new Date(),
      },
    });

    return {
      id: appliedAction.id,
      tenantId: appliedAction.tenant_id,
      listingId: appliedAction.listing_id,
      actionType: appliedAction.action_type,
      appliedAt: appliedAction.applied_at,
      createdAt: appliedAction.created_at,
    };
  }

  /**
   * Busca ações aplicadas para um listing
   */
  async getAppliedActions(tenantId: string, listingId: string): Promise<AppliedActionResult[]> {
    const actions = await prisma.appliedAction.findMany({
      where: {
        tenant_id: tenantId,
        listing_id: listingId,
      },
      orderBy: {
        applied_at: 'desc',
      },
    });

    return actions.map((action) => ({
      id: action.id,
      tenantId: action.tenant_id,
      listingId: action.listing_id,
      actionType: action.action_type,
      appliedAt: action.applied_at,
      createdAt: action.created_at,
    }));
  }

  /**
   * Verifica se uma ação específica foi aplicada
   */
  async isActionApplied(
    tenantId: string,
    listingId: string,
    actionType: 'seo' | 'midia' | 'cadastro' | 'competitividade'
  ): Promise<boolean> {
    const action = await prisma.appliedAction.findUnique({
      where: {
        tenant_id_listing_id_action_type: {
          tenant_id: tenantId,
          listing_id: listingId,
          action_type: actionType,
        },
      },
    });

    return action !== null;
  }
}
