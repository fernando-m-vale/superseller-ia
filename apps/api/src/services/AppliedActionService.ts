/**
 * AppliedActionService
 * 
 * Service para gerenciar ações aplicadas pelo usuário.
 * Permite registrar quando uma sugestão foi aplicada (sem integração real com ML ainda).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// DIA 06.1: ActionTypes granulares para melhor rastreamento
export type ActionType = 
  | 'seo_title'        // Título SEO
  | 'seo_description' // Descrição SEO
  | 'media_images'    // Plano de imagens
  | 'promo_cover_badge' // Selo de desconto na capa
  | 'promo_banner'    // Banner promo imagem 2/3
  | 'seo'             // Compatibilidade: seo_title + seo_description
  | 'midia'           // Compatibilidade: media_images
  | 'cadastro'        // Compatibilidade legado
  | 'competitividade'; // Compatibilidade legado

export interface ApplyActionInput {
  tenantId: string;
  listingId: string;
  actionType: ActionType;
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
   * HOTFIX: Suporta filtrar por data da análise (para resetar badges ao regerar)
   */
  async getAppliedActions(
    tenantId: string, 
    listingId: string,
    analysisCreatedAt?: Date | null
  ): Promise<AppliedActionResult[]> {
    const where: any = {
      tenant_id: tenantId,
      listing_id: listingId,
    };

    // HOTFIX: Se analysisCreatedAt for fornecido, filtrar apenas ações aplicadas após a análise
    // Isso permite que ao regerar análise, os badges sejam resetados
    if (analysisCreatedAt) {
      where.applied_at = {
        gte: analysisCreatedAt,
      };
    }

    const actions = await prisma.appliedAction.findMany({
      where,
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
   * DIA 06.1: Suporta compatibilidade com actionTypes legados
   */
  async isActionApplied(
    tenantId: string,
    listingId: string,
    actionType: ActionType
  ): Promise<boolean> {
    // Verificar ação específica primeiro
    const action = await prisma.appliedAction.findUnique({
      where: {
        tenant_id_listing_id_action_type: {
          tenant_id: tenantId,
          listing_id: listingId,
          action_type: actionType,
        },
      },
    });

    if (action) {
      return true;
    }

    // DIA 06.1: Compatibilidade com actionTypes legados
    // Se procurar "seo", verificar se existe "seo_title" ou "seo_description"
    if (actionType === 'seo') {
      const seoTitle = await prisma.appliedAction.findUnique({
        where: {
          tenant_id_listing_id_action_type: {
            tenant_id: tenantId,
            listing_id: listingId,
            action_type: 'seo_title',
          },
        },
      });
      const seoDescription = await prisma.appliedAction.findUnique({
        where: {
          tenant_id_listing_id_action_type: {
            tenant_id: tenantId,
            listing_id: listingId,
            action_type: 'seo_description',
          },
        },
      });
      return seoTitle !== null || seoDescription !== null;
    }

    // Se procurar "midia", verificar se existe "media_images"
    if (actionType === 'midia') {
      const mediaImages = await prisma.appliedAction.findUnique({
        where: {
          tenant_id_listing_id_action_type: {
            tenant_id: tenantId,
            listing_id: listingId,
            action_type: 'media_images',
          },
        },
      });
      return mediaImages !== null;
    }

    return false;
  }
}
