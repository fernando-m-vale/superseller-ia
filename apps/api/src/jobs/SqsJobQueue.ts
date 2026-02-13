/**
 * DIA 08: Stub para SQS Job Queue (não implementado ainda)
 * 
 * Esta implementação está preparada para futuro uso com AWS SQS.
 * Por enquanto, lança erro se tentar usar.
 * 
 * Quando implementar:
 * - enqueue: enviar mensagem para SQS queue
 * - dequeue: receber mensagem da SQS queue (long polling)
 * - markRunning: atualizar atributos da mensagem
 * - markSuccess: deletar mensagem da queue
 * - markError: mover para DLQ (Dead Letter Queue) ou atualizar atributos
 * - markSkipped: deletar mensagem
 * 
 * Mapeamento:
 * - JobType -> MessageAttributes.type
 * - JobPriority -> MessageAttributes.priority
 * - lockKey -> MessageAttributes.lockKey
 * - payload -> MessageBody (JSON)
 * - runAfter -> DelaySeconds (se runAfter > now)
 */

import type { JobQueue, EnqueueJobInput, DequeuedJob, JobPriority } from './JobQueue';

export class SqsJobQueue implements JobQueue {
  async enqueue(job: EnqueueJobInput): Promise<{ jobId: string }> {
    throw new Error('SQS Job Queue não está implementado ainda. Use JOB_QUEUE_DRIVER=db');
  }

  async dequeue(opts: { priorities: JobPriority[] }): Promise<DequeuedJob | null> {
    throw new Error('SQS Job Queue não está implementado ainda. Use JOB_QUEUE_DRIVER=db');
  }

  async markRunning(jobId: string): Promise<void> {
    throw new Error('SQS Job Queue não está implementado ainda. Use JOB_QUEUE_DRIVER=db');
  }

  async markSuccess(jobId: string): Promise<void> {
    throw new Error('SQS Job Queue não está implementado ainda. Use JOB_QUEUE_DRIVER=db');
  }

  async markError(jobId: string, error: string): Promise<void> {
    throw new Error('SQS Job Queue não está implementado ainda. Use JOB_QUEUE_DRIVER=db');
  }

  async markSkipped(jobId: string, reason: string): Promise<void> {
    throw new Error('SQS Job Queue não está implementado ainda. Use JOB_QUEUE_DRIVER=db');
  }
}
