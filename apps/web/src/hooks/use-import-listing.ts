'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

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
      const response = await fetch('/api/v1/listings/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'mercadolivre',
          externalId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorData = data as ImportListingError
        throw new Error(errorData.message || errorData.error || `Erro HTTP ${response.status}`)
      }

      const result = data as ImportListingResponse
      
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
