/**
 * DIA 08: JobRunner
 * 
 * Processa jobs da fila em loop contínuo.
 * Só roda se ENABLE_JOB_RUNNER=true.
 * 
 * Em produção com múltiplas réplicas, locks transacionais devem impedir duplicação.
 */

import { getJobQueue } from './jobQueueFactory';
import { handleTenantSync } from './handlers/TenantSyncOrchestrator';
import { handleListingSync } from './handlers/ListingSyncWorker';
import { checkLock } from './locks';

const POLL_INTERVAL_MS = 3000; // 3 segundos
const MAX_RETRIES = 3;

let isRunning = false;
let shouldStop = false;

export async function startJobRunner(): Promise<void> {
  if (process.env.ENABLE_JOB_RUNNER !== 'true') {
    console.log('[JOB_RUNNER] Desabilitado (ENABLE_JOB_RUNNER != true)');
    return;
  }

  if (isRunning) {
    console.warn('[JOB_RUNNER] Já está rodando');
    return;
  }

  isRunning = true;
  shouldStop = false;

  console.log('[JOB_RUNNER] Iniciando runner...');
  console.log(`[JOB_RUNNER] Poll interval: ${POLL_INTERVAL_MS}ms`);

  // Loop principal
  while (!shouldStop) {
    try {
      await processNextJob();
    } catch (error) {
      console.error('[JOB_RUNNER] Erro no loop principal:', error);
    }

    // Aguardar antes do próximo poll
    await sleep(POLL_INTERVAL_MS);
  }

  isRunning = false;
  console.log('[JOB_RUNNER] Runner parado');
}

export function stopJobRunner(): void {
  shouldStop = true;
  console.log('[JOB_RUNNER] Parando runner...');
}

async function processNextJob(): Promise<void> {
  const queue = getJobQueue();

  // Tentar pegar próximo job (prioridade: interactive primeiro)
  const job = await queue.dequeue({
    priorities: ['interactive', 'background'],
  });

  if (!job) {
    // Sem jobs disponíveis
    return;
  }

  const startTime = Date.now();
  const debug = process.env.DEBUG === '1' || process.env.NODE_ENV === 'development';

  if (debug) {
    console.log(`[JOB_RUNNER] Processando job ${job.jobId} type=${job.type} tenantId=${job.tenantId}`);
  }

  try {
    // Verificar lock antes de executar
    const lockCheck = await checkLock(job.lockKey);
    
    if (lockCheck.isLocked && !lockCheck.isStale) {
      // Lock ativo (outra réplica pegou)
      await queue.markSkipped(job.jobId, `Lock ativo: ${lockCheck.reason}`);
      
      if (debug) {
        console.log(`[JOB_RUNNER] Job ${job.jobId} pulado: lock ativo`);
      }
      return;
    }

    // Executar handler baseado no tipo
    switch (job.type) {
      case 'TENANT_SYNC':
        await handleTenantSync(job.tenantId);
        await queue.markSuccess(job.jobId);
        break;

      case 'LISTING_SYNC':
        await handleListingSync(job.tenantId, job.payload);
        await queue.markSuccess(job.jobId);
        break;

      default:
        throw new Error(`Tipo de job desconhecido: ${job.type}`);
    }

    const duration = Date.now() - startTime;
    
    if (debug) {
      console.log(`[JOB_RUNNER] Job ${job.jobId} concluído em ${duration}ms`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const duration = Date.now() - startTime;

    // Verificar se deve retry
    // Por enquanto, marcar como erro (retry pode ser implementado depois)
    await queue.markError(job.jobId, errorMessage);

    console.error(`[JOB_RUNNER] Erro ao processar job ${job.jobId} duration=${duration}ms:`, error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
