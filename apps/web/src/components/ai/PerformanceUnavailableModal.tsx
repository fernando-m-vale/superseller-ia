'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

interface PerformanceUnavailableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PerformanceUnavailableModal({
  open,
  onOpenChange,
}: PerformanceUnavailableModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Por que os dados de performance estão indisponíveis?
          </DialogTitle>
          <DialogDescription>
            Entenda como funciona a coleta de dados de performance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">O que aconteceu?</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Os dados de performance (visitas, impressões e cliques) são obtidos através da API do Mercado Livre. 
              Em alguns casos, esses dados podem não estar disponíveis por limitações técnicas da própria API.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Motivos comuns:</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-500" />
                <span>Anúncio recém-criado (dados ainda não processados)</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-500" />
                <span>Período sem atividade significativa no anúncio</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-500" />
                <span>Limitação temporária da API do Mercado Livre</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-500" />
                <span>Dados de visitas não disponíveis para esta categoria</span>
              </li>
            </ul>
          </div>

          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="font-medium text-sm text-green-800 dark:text-green-200">
                  Seu score NÃO é penalizado
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Quando os dados de performance não estão disponíveis, a dimensão de Performance 
                  recebe uma pontuação neutra (15/30 pontos). Isso garante que seu anúncio não seja 
                  prejudicado por limitações da API.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">O que você pode fazer?</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Você pode verificar as métricas de performance diretamente no painel do Mercado Livre, 
              onde os dados são exibidos em tempo real. Nosso sistema continuará tentando sincronizar 
              os dados automaticamente.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
