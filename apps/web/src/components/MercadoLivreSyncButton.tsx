'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMercadoLivreHealth, useMercadoLivreSync } from '@/hooks/use-mercadolivre'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

export function MercadoLivreSyncButton() {
  const [mounted, setMounted] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data: health, isLoading: healthLoading } = useMercadoLivreHealth()
  const syncMutation = useMercadoLivreSync()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (syncMessage) {
      const timer = setTimeout(() => setSyncMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [syncMessage])

  const handleSync = async () => {
    setSyncMessage(null)
    try {
      const result = await syncMutation.mutateAsync()
      setSyncMessage({
        type: 'success',
        text: `${result.synced} anúncios sincronizados com sucesso!`,
      })
    } catch (error) {
      // Garantir que a mensagem seja sempre uma string válida
      let errorMessage = 'Erro ao sincronizar';
      
      if (error instanceof Error) {
        errorMessage = String(error.message || 'Erro ao sincronizar');
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        const errorObj = error as { message?: unknown };
        errorMessage = String(errorObj.message || 'Erro ao sincronizar');
      }
      
      // Garantir que não seja string vazia
      if (!errorMessage || errorMessage.trim().length === 0) {
        errorMessage = 'Erro ao sincronizar';
      }
      
      setSyncMessage({
        type: 'error',
        text: errorMessage,
      })
    }
  }

  if (!mounted || healthLoading) {
    return null
  }

  if (!health || !health.connected) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      {syncMessage && (
        <Badge
          variant={syncMessage.type === 'success' ? 'default' : 'destructive'}
          className={syncMessage.type === 'success' ? 'bg-green-600' : ''}
        >
          {syncMessage.type === 'success' ? (
            <CheckCircle className="h-3 w-3 mr-1" />
          ) : (
            <AlertCircle className="h-3 w-3 mr-1" />
          )}
          {syncMessage.text}
        </Badge>
      )}
      <Button
        onClick={handleSync}
        disabled={syncMutation.isPending}
        variant="outline"
        size="sm"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
        {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar Mercado Livre'}
      </Button>
    </div>
  )
}
