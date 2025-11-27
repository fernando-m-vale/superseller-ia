import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMercadoLivreHealth, syncMercadoLivreListings, MercadoLivreHealthResponse, MercadoLivreSyncResponse } from '@/lib/marketplaces'

export function useMercadoLivreHealth() {
  return useQuery<MercadoLivreHealthResponse | null>({
    queryKey: ['mercadolivre', 'health'],
    queryFn: getMercadoLivreHealth,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useMercadoLivreSync() {
  const queryClient = useQueryClient()

  return useMutation<MercadoLivreSyncResponse, Error>({
    mutationFn: syncMercadoLivreListings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['mercadolivre', 'health'] })
    },
  })
}
