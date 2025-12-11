import { AuthGuard } from '@/components/AuthGuard'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
            <p className="text-muted-foreground">
              Gerencie as configurações da sua conta
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Configurações da Conta</CardTitle>
              <CardDescription>
                Em breve você poderá gerenciar suas preferências aqui
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Esta página está em desenvolvimento. Em breve você poderá:
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Alterar informações da conta</li>
                <li>Gerenciar integrações com marketplaces</li>
                <li>Configurar notificações</li>
                <li>Definir preferências de relatórios</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}

