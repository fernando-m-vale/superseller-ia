/**
 * DIA 08: Interface para Job Queue (preparado para SQS)
 * 
 * Implementações:
 * - DBQueue: usa Prisma (implementação atual)
 * - SqsJobQueue: stub para futuro (AWS SQS)
 */

export type JobPriority = 'interactive' | 'background';
export type JobType = 'TENANT_SYNC' | 'LISTING_SYNC';

export interface EnqueueJobInput {
  tenantId: string;
  type: JobType;
  priority: JobPriority;
  lockKey: string;
  runAfter?: Date;
  payload: Record<string, any>;
}

export interface DequeuedJob {
  jobId: string;
  type: JobType;
  tenantId: string;
  payload: any;
  lockKey: string;
}

export interface JobQueue {
  /**
   * Enfileira um novo job
   */
  enqueue(job: EnqueueJobInput): Promise<{ jobId: string }>;

  /**
   * Remove um job da fila e retorna para processamento
   * Retorna null se não houver jobs elegíveis
   */
  dequeue(opts: { priorities: JobPriority[] }): Promise<DequeuedJob | null>;

  /**
   * Marca job como em execução (claim)
   */
  markRunning(jobId: string): Promise<void>;

  /**
   * Marca job como concluído com sucesso
   */
  markSuccess(jobId: string): Promise<void>;

  /**
   * Marca job como erro
   */
  markError(jobId: string, error: string): Promise<void>;

  /**
   * Marca job como pulado (ex: lock ativo, cooldown)
   */
  markSkipped(jobId: string, reason: string): Promise<void>;
}
