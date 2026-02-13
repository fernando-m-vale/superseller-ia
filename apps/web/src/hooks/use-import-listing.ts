'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getApiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

interface ImportListingResponse {
  message: string
  data: {
    id: string
    title: string
    status: string
    listingIdExt: string
    price: number
    stock: number
    marketplace: string
    alreadyExists: boolean
  }
}

interface ImportListingError {
  error: string
  message: string
  details?: unknown
}

export function useImportListing() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const importListing = async (externalId: string): Promise<ImportListingResponse['data']> => {
    setIsLoading(true)
    setError(null)

    try {
      const apiUrl = getApiBaseUrl()
      const token = getAccessToken()

      if (!token) {
        throw new Error('Usuário não autenticado')
      }

      const response = await fetch(`${apiUrl}/listings/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'mercadolivre',
          externalId,
        }),
      })

      // TAREFA B: Verificar content-type antes de parsear JSON
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')

      if (!response.ok) {
        let errorMessage = `Erro HTTP ${response.status}`
        
        if (isJson) {
          try {
            const errorData = await response.json() as ImportListingError
            errorMessage = errorData.message || errorData.error || errorMessage
          } catch {
            // Se falhar ao parsear JSON mesmo com content-type correto, usar mensagem genérica
            errorMessage = `Erro ao processar resposta da API (status ${response.status})`
          }
        } else {
          // Resposta não é JSON (provavelmente HTML de erro 404 do Next.js)
          const textBody = await response.text().catch(() => '')
          const preview = textBody.substring(0, 200)
          
          // Debug em desenvolvimento
          if (process.env.NODE_ENV === 'development') {
            console.error('Resposta não-JSON recebida:', {
              status: response.status,
              url: response.url,
              contentType,
              bodyPreview: preview,
              apiUrl,
            })
          }
          
          errorMessage = `Resposta inesperada da API (status ${response.status}). Verifique NEXT_PUBLIC_API_URL / rota.`
          
          // Se detectar HTML (página 404 do Next.js), mensagem mais específica
          if (textBody.includes('<!DOCTYPE') || textBody.includes('<html')) {
            errorMessage = 'Falha ao importar: configuração da API inválida (rota não encontrada). Verifique o ambiente NEXT_PUBLIC_API_URL.'
          }
        }
        
        throw new Error(errorMessage)
      }

      // Parse JSON apenas se content-type for correto
      if (!isJson) {
        await response.text() // Consumir body para evitar warning
        throw new Error(`Resposta não-JSON recebida (content-type: ${contentType}). Verifique NEXT_PUBLIC_API_URL.`)
      }

      const result = await response.json() as ImportListingResponse
      
      // Invalidar cache de listings para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ['listings'] })

      return result.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao importar anúncio'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    importListing,
    isLoading,
    error,
  }
}
