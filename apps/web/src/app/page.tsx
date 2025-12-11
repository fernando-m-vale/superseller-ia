'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAccessToken } from '@/lib/auth'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const token = getAccessToken()
    if (token) {
      // Se já está logado, redirecionar para o dashboard
      router.push('/overview')
    }
  }, [router])

  const token = getAccessToken()
  
  // Se não está logado, mostrar landing/login
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-background">
        <div className="max-w-md w-full space-y-8 text-center p-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Super Seller IA</h1>
            <p className="text-muted-foreground">
              Plataforma de IA para otimizar seus anúncios em marketplaces
            </p>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Faça login para acessar o dashboard
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Se está logado mas ainda não redirecionou (loading state)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    </div>
  )
}