import { Suspense } from 'react'
import RecommendationsClient from './client'
import { AuthGuard } from '@/components/AuthGuard'
import { DashboardLayout } from '@/components/DashboardLayout'

export default function RecommendationsPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <Suspense fallback={
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Recomendações</h1>
              <p className="text-muted-foreground">Carregando recomendações...</p>
            </div>
            <div className="h-96 bg-muted animate-pulse rounded" />
          </div>
        }>
          <RecommendationsClient />
        </Suspense>
      </DashboardLayout>
    </AuthGuard>
  )
}
