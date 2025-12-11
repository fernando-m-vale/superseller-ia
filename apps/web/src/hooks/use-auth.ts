"use client"

import { useQuery } from '@tanstack/react-query'
import { getCurrentUser, type AuthUser } from '@/lib/auth'

export function useAuth() {
  return useQuery<AuthUser | null>({
    queryKey: ['current-user'],
    queryFn: async () => {
      return await getCurrentUser()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  })
}

