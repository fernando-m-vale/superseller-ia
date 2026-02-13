/**
 * DIA 08: Barra de status de sync
 */

'use client';

import { useEffect } from 'react';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useManualSync } from '@/hooks/use-manual-sync';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Nunca';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `Há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
}

export function SyncStatusBar() {
  const { data: status, isLoading } = useSyncStatus();
  const autoSync = useAutoSync();
  const manualSync = useManualSync();

  // Auto-sync ao montar componente (silent)
  useEffect(() => {
    autoSync.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch listings quando sync terminar com sucesso
  useEffect(() => {
    if (status?.lastSyncStatus === 'success' && status.lastSyncFinishedAt) {
      // Invalidar query de listings para refetch automático
      // Isso será feito pelo React Query automaticamente se configurado
    }
  }, [status?.lastSyncStatus, status?.lastSyncFinishedAt]);

  if (isLoading || !status) {
    return null;
  }

  const isRunning = status.isRunning;
  const hasError = status.lastSyncStatus === 'error';
  const lastSyncAt = status.lastAutoSyncAt || status.lastManualSyncAt;

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">Atualizando dados...</span>
            </>
          ) : hasError ? (
            <>
              <AlertCircle className="h-4 w-4 text-destructive" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-destructive">
                  Falha ao atualizar
                </span>
                {status.lastSyncError && (
                  <span className="text-xs text-muted-foreground">
                    {status.lastSyncError}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">
                Dados atualizados {formatTimeAgo(lastSyncAt)}
              </span>
            </>
          )}
        </div>

        <Button
          onClick={() => manualSync.mutate()}
          disabled={isRunning || manualSync.isPending}
          size="sm"
          variant="outline"
        >
          {manualSync.isPending || isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar agora
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
