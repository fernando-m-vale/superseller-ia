import { AuthGuard } from '@/components/AuthGuard'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ListingsTable } from '@/components/listings-table'
import { MercadoLivreSyncButton } from '@/components/MercadoLivreSyncButton'

export default function ListingsPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Cabeçalho da seção de anúncios com botão de sync */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Anúncios</h1>
              <p className="text-muted-foreground">
                Gerencie seus anúncios nos marketplaces conectados
              </p>
            </div>
            <MercadoLivreSyncButton />
          </div>
          
          {/* Tabela de anúncios */}
          <ListingsTable />
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}

