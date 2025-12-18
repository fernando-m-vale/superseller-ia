import { AuthGuard } from '@/components/AuthGuard'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

// Feature flag: Temporariamente desativado por instabilidade no backend (erro 500)
// Para reativar, alterar ENABLE_RECOMMENDATIONS em DashboardLayout.tsx para true
// e restaurar o conteúdo original desta página
const ENABLE_RECOMMENDATIONS = false

function RecommendationsPlaceholder() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recomendações</h1>
        <p className="text-muted-foreground">
          Funcionalidade em manutenção. Em breve estará disponível.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Funcionalidade Temporariamente Indisponível</CardTitle>
          </div>
          <CardDescription>
            Estamos trabalhando para melhorar esta funcionalidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            A página de recomendações está temporariamente em manutenção para correção de problemas no backend.
            Em breve estará disponível novamente.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RecommendationsPage() {
  // Se a feature flag estiver desativada, mostrar placeholder
  // Caso contrário, restaurar o conteúdo original:
  // import RecommendationsClient from './client'
  // return <RecommendationsClient />
  
  if (!ENABLE_RECOMMENDATIONS) {
    return (
      <AuthGuard>
        <DashboardLayout>
          <RecommendationsPlaceholder />
        </DashboardLayout>
      </AuthGuard>
    )
  }

  // Código original comentado para reativação futura:
  // return (
  //   <AuthGuard>
  //     <DashboardLayout>
  //       <Suspense fallback={...}>
  //         <RecommendationsClient />
  //       </Suspense>
  //     </DashboardLayout>
  //   </AuthGuard>
  // )
  
  // Por enquanto, sempre retornar placeholder
  return (
    <AuthGuard>
      <DashboardLayout>
        <RecommendationsPlaceholder />
      </DashboardLayout>
    </AuthGuard>
  )
}
