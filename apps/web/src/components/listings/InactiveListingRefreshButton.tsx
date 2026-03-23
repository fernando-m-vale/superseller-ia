'use client'

import { useState, type MouseEvent } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props {
  listingExtId: string
  listingTitle: string
  onRefreshSuccess?: () => void
}

export function InactiveListingRefreshButton({
  listingExtId,
  onRefreshSuccess,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleRefresh = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()

    setStatus('loading')
    setErrorMsg('')

    try {
      const token = localStorage.getItem('accessToken')

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/sync/mercadolivre/listings/${listingExtId}/force-refresh`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }))
        throw new Error(error.message ?? `HTTP ${response.status}`)
      }

      setStatus('success')
      onRefreshSuccess?.()

      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar'
      setErrorMsg(msg)
      setStatus('error')

      setTimeout(() => {
        setStatus('idle')
        setErrorMsg('')
      }, 5000)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleRefresh}
        disabled={status === 'loading'}
        className={`
          inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border
          transition-colors duration-150
          ${status === 'idle'
            ? 'text-muted-foreground border-border hover:bg-muted hover:text-foreground'
            : ''}
          ${status === 'loading'
            ? 'text-muted-foreground border-border opacity-60 cursor-not-allowed'
            : ''}
          ${status === 'success'
            ? 'text-green-700 border-green-300 bg-green-50'
            : ''}
          ${status === 'error'
            ? 'text-red-600 border-red-300 bg-red-50'
            : ''}
        `}
      >
        <RefreshCw
          className={`w-3 h-3 ${status === 'loading' ? 'animate-spin' : ''}`}
        />
        {status === 'idle' && 'Atualizar dados'}
        {status === 'loading' && 'Atualizando...'}
        {status === 'success' && 'Atualizado!'}
        {status === 'error' && 'Tentar novamente'}
      </button>

      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  )
}
