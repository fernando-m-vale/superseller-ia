import { Suspense } from 'react'
import RecommendationsClient from './client'
import { AuthGuard } from '@/components/AuthGuard'

export default function RecommendationsPage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div className="space-y-6 p-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Ações Sugeridas</h2>
            <p className="text-muted-foreground">Carregando recomendações...</p>
          </div>
          <div className="h-96 bg-muted animate-pulse rounded" />
        </div>
      }>
        <RecommendationsClient />
      </Suspense>
    </AuthGuard>
  )
}
