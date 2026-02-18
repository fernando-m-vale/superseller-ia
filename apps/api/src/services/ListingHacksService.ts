/**
 * ListingHacksService - DIA 09
 * 
 * Service para gerenciar feedback do usuário sobre hacks sugeridos.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface HackFeedbackInput {
  tenantId: string;
  listingId: string;
  hackId: string;
  status: 'confirmed' | 'dismissed';
  notes?: string | null;
}

export interface HackHistory {
  hackId: string;
  status: 'confirmed' | 'dismissed';
  dismissedAt?: Date | null;
  confirmedAt?: Date | null;
}

/**
 * Salva feedback do usuário sobre um hack
 */
export async function saveHackFeedback(input: HackFeedbackInput): Promise<void> {
  const { tenantId, listingId, hackId, status, notes } = input;
  
  const now = new Date();
  
  // Verificar se já existe
  const existing = await prisma.listingHack.findFirst({
    where: {
      listing_id: listingId,
      hack_id: hackId,
    },
  });

  if (existing) {
    // Atualizar existente
    await prisma.listingHack.update({
      where: {
        id: existing.id,
      },
      data: {
        status,
        notes: notes || null,
        confirmed_at: status === 'confirmed' ? now : null,
        dismissed_at: status === 'dismissed' ? now : null,
        updated_at: now,
      },
    });
  } else {
    // Criar novo
    await prisma.listingHack.create({
      data: {
        tenant_id: tenantId,
        listing_id: listingId,
        hack_id: hackId,
        status,
        notes: notes || null,
        confirmed_at: status === 'confirmed' ? now : null,
        dismissed_at: status === 'dismissed' ? now : null,
      },
    });
  }
}

/**
 * Busca histórico de feedbacks para um listing
 */
export async function getHackHistory(
  tenantId: string,
  listingId: string
): Promise<HackHistory[]> {
  const hacks = await prisma.listingHack.findMany({
    where: {
      tenant_id: tenantId,
      listing_id: listingId,
    },
    select: {
      hack_id: true,
      status: true,
      dismissed_at: true,
      confirmed_at: true,
    },
  });
  
  return hacks.map(h => ({
    hackId: h.hack_id,
    status: h.status as 'confirmed' | 'dismissed',
    dismissedAt: h.dismissed_at,
    confirmedAt: h.confirmed_at,
  }));
}
