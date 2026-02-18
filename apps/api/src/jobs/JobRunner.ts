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

  const driver = process.env.JOB_QUEUE_DRIVER || 'db';
  const processId = process.pid;
  const debug = process.env.DEBUG_JOB_RUNNER === '1' || process.env.NODE_ENV === 'development';

  console.log('[JOB_RUNNER] Iniciando runner...');
  console.log(`[JOB_RUNNER] Driver: ${driver}`);
  console.log(`[JOB_RUNNER] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[JOB_RUNNER] Process ID: ${processId}`);

  let heartbeatCounter = 0;

  // Loop principal
  while (!shouldStop) {
    try {
      await processNextJob();
    } catch (error) {
      console.error('[JOB_RUNNER] Erro no loop principal:', error);
    }

    // Heartbeat a cada 30s (10 ciclos de 3s)
    heartbeatCounter++;
    if (debug && heartbeatCounter >= 10) {
      console.log(`[JOB_RUNNER] Heartbeat (processId=${processId}, driver=${driver})`);
      heartbeatCounter = 0;
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
  const debug = process.env.DEBUG === '1' || process.env.DEBUG_JOB_RUNNER === '1' || process.env.NODE_ENV === 'development';

  // HOTFIX: Logs estruturados com requestId e tenantId
  const requestId = `job-${job.jobId}-${Date.now()}`;
  
  if (debug) {
    console.log(`[JOB_RUNNER] Processando job`, {
      requestId,
      jobId: job.jobId,
      type: job.type,
      tenantId: job.tenantId,
      lockKey: job.lockKey,
    });
  }

  try {
    // HOTFIX: Removido checkLock após dequeue
    // O dequeue() já faz claim atômico com transação, então não precisamos verificar lock novamente.
    // O enqueue() já tem dedupe por lock_key e o índice único parcial garante que não há duplicação.
    // Verificar lock aqui causava self-lock: o job acabava de ser marcado como 'running' pelo dequeue(),
    // e o checkLock encontrava o próprio job como "lock ativo", marcando-o como skipped.

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
      console.log(`[JOB_RUNNER] Job concluído`, {
        requestId,
        jobId: job.jobId,
        type: job.type,
        tenantId: job.tenantId,
        duration: `${duration}ms`,
        status: 'success',
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const duration = Date.now() - startTime;

    // Verificar se deve retry
    // Por enquanto, marcar como erro (retry pode ser implementado depois)
    await queue.markError(job.jobId, errorMessage);

    console.error(`[JOB_RUNNER] Erro ao processar job`, {
      requestId,
      jobId: job.jobId,
      type: job.type,
      tenantId: job.tenantId,
      duration: `${duration}ms`,
      error: errorMessage,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
