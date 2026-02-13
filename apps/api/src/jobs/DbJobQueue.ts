/**
 * DIA 08: Implementação de JobQueue usando Prisma (DBQueue)
 * 
 * Usa tabela sync_jobs para armazenar jobs.
 * Suporta locks transacionais para evitar duplicação em múltiplas réplicas.
 */

import { PrismaClient, SyncJobStatus, SyncJobType, SyncJobPriority } from '@prisma/client';
import type { JobQueue, EnqueueJobInput, DequeuedJob, JobPriority } from './JobQueue';

const prisma = new PrismaClient();

export class DbJobQueue implements JobQueue {
  async enqueue(job: EnqueueJobInput): Promise<{ jobId: string }> {
    // HOTFIX: Dedupe de TENANT_SYNC - verificar se já existe job ativo com mesmo lock_key
    if (job.type === 'TENANT_SYNC') {
      const existingJob = await prisma.syncJob.findFirst({
        where: {
          lock_key: job.lockKey,
          status: {
            in: [SyncJobStatus.queued, SyncJobStatus.running],
          },
        },
        select: {
          id: true,
        },
      });

      if (existingJob) {
        // Job já existe, retornar ID existente
        const debug = process.env.DEBUG === '1' || process.env.NODE_ENV === 'development';
        if (debug) {
          console.log(`[DB_QUEUE] Job duplicado evitado: lock_key=${job.lockKey}, jobId existente=${existingJob.id}`);
        }
        return { jobId: existingJob.id };
      }
    }

    const syncJob = await prisma.syncJob.create({
      data: {
        tenant_id: job.tenantId,
        type: job.type as SyncJobType,
        status: SyncJobStatus.queued,
        priority: job.priority as SyncJobPriority,
        payload: job.payload,
        lock_key: job.lockKey,
        run_after: job.runAfter || new Date(),
      },
      select: {
        id: true,
      },
    });

    return { jobId: syncJob.id };
  }

  async dequeue(opts: { priorities: JobPriority[] }): Promise<DequeuedJob | null> {
    // HOTFIX: Usar transação para buscar e claim atomicamente
    // Prisma converte new Date() para timestamptz automaticamente
    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      
      // Buscar job elegível usando Prisma
      const job = await tx.syncJob.findFirst({
        where: {
          status: SyncJobStatus.queued,
          priority: { in: opts.priorities as SyncJobPriority[] },
          run_after: { lte: now },
        },
        orderBy: [
          { priority: 'asc' }, // interactive vem antes de background
          { run_after: 'asc' },
        ],
      });

      if (!job) {
        return null;
      }

      // Claim transacional: atualizar status para running apenas se ainda estiver queued
      const updated = await tx.syncJob.updateMany({
        where: {
          id: job.id,
          status: SyncJobStatus.queued, // Apenas se ainda estiver queued
        },
        data: {
          status: SyncJobStatus.running,
          started_at: new Date(),
          attempts: { increment: 1 },
        },
      });

      // Se não atualizou (outra réplica pegou), retornar null
      if (updated.count === 0) {
        return null;
      }

      return {
        jobId: job.id,
        type: job.type as SyncJobType,
        tenantId: job.tenant_id,
        payload: job.payload as Record<string, any>,
        lockKey: job.lock_key,
      };
    });
  }

  async markRunning(jobId: string): Promise<void> {
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: SyncJobStatus.running,
        started_at: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async markSuccess(jobId: string): Promise<void> {
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: SyncJobStatus.success,
        finished_at: new Date(),
        error: null,
      },
    });
  }

  async markError(jobId: string, error: string): Promise<void> {
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: SyncJobStatus.error,
        finished_at: new Date(),
        error: error.substring(0, 10000), // Limitar tamanho do erro
      },
    });
  }

  async markSkipped(jobId: string, reason: string): Promise<void> {
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: SyncJobStatus.skipped,
        finished_at: new Date(),
        error: reason,
      },
    });
  }
}
