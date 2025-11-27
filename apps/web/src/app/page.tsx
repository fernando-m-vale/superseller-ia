import { ActivationChecklist } from '@/components/ActivationChecklist'
import { ListingsTable } from '@/components/listings-table'
import { MercadoLivreSyncButton } from '@/components/MercadoLivreSyncButton'

export default function HomePage() {
  return (
    <div className="space-y-6">
      <ActivationChecklist />
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Anúncios</h2>
          <p className="text-muted-foreground">
            Gerencie seus anúncios nos marketplaces conectados
          </p>
        </div>
        <MercadoLivreSyncButton />
      </div>
      
      <ListingsTable />
    </div>
  )
}
