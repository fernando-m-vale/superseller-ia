'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface RegenerateAnalysisModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  isRegenerating?: boolean
}

export function RegenerateAnalysisModal({
  open,
  onOpenChange,
  onConfirm,
  isRegenerating = false,
}: RegenerateAnalysisModalProps) {
  const handleConfirm = async () => {
    await onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regerar Análise</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja regerar a análise deste anúncio?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                A recomendação é aguardar 7 dias entre análises para permitir que as mudanças tenham efeito e possam ser medidas adequadamente.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRegenerating}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isRegenerating}>
            {isRegenerating ? 'Regenerando...' : 'Regerar mesmo assim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
