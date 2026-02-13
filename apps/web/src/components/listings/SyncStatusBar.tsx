/**
 * DIA 08: Barra de status de sync
 */

'use client';

import { useEffect } from 'react';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useManualSync } from '@/hooks/use-manual-sync';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();

  // Auto-sync ao montar componente (silent)
  useEffect(() => {
    autoSync.mutate();
  }, [autoSync]);

  // Tratar resultado do sync manual
  useEffect(() => {
    if (manualSync.isSuccess && manualSync.data) {
      const data = manualSync.data;
      
      if (data.started) {
        toast({
          title: 'Sincronização iniciada',
          description: 'Os dados serão atualizados em breve.',
        });
      } else {
        if (data.reason === 'cooldown' && data.retryAfterSeconds) {
          const minutes = Math.ceil(data.retryAfterSeconds / 60);
          toast({
            title: 'Aguarde antes de sincronizar novamente',
            description: `Aguarde ${minutes} minuto${minutes > 1 ? 's' : ''} antes de sincronizar novamente.`,
            variant: 'default',
          });
        } else if (data.reason === 'running') {
          toast({
            title: 'Sincronização em andamento',
            description: 'Uma sincronização já está sendo executada.',
            variant: 'default',
          });
        }
      }
    }
  }, [manualSync.isSuccess, manualSync.data, toast]);

  // Tratar erro do sync manual
  useEffect(() => {
    if (manualSync.isError && manualSync.error) {
      toast({
        title: 'Erro ao sincronizar',
        description: manualSync.error.message || 'Ocorreu um erro ao iniciar a sincronização.',
        variant: 'destructive',
      });
    }
  }, [manualSync.isError, manualSync.error, toast]);

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
