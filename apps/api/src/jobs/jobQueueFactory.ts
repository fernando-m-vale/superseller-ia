/**
 * DIA 08: Factory para criar instância de JobQueue
 * 
 * Suporta:
 * - db: DBQueue (Prisma) - padrão
 * - sqs: SqsJobQueue (stub, não implementado)
 */

import { DbJobQueue } from './DbJobQueue';
import { SqsJobQueue } from './SqsJobQueue';
import type { JobQueue } from './JobQueue';

let instance: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (instance) {
    return instance;
  }

  const driver = process.env.JOB_QUEUE_DRIVER || 'db';

  switch (driver) {
    case 'db':
      instance = new DbJobQueue();
      break;
    case 'sqs':
      instance = new SqsJobQueue();
      break;
    default:
      throw new Error(`JOB_QUEUE_DRIVER inválido: ${driver}. Use 'db' ou 'sqs'.`);
  }

  return instance;
}
