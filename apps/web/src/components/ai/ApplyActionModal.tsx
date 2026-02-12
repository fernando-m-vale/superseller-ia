'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, CheckCircle2, X } from 'lucide-react'
import type { ActionType } from '@/hooks/use-apply-action'

interface ApplyActionModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  actionType: ActionType
  beforeValue: string | React.ReactNode
  afterValue: string | React.ReactNode
  isLoading?: boolean
}

const actionTypeLabels: Record<ActionType, string> = {
  seo_title: 'Título SEO',
  seo_description: 'Descrição SEO',
  media_images: 'Plano de Imagens',
  promo_cover_badge: 'Selo de Desconto',
  promo_banner: 'Banner Promocional',
  seo: 'SEO', // Compatibilidade
  midia: 'Mídia', // Compatibilidade
  cadastro: 'Cadastro', // Compatibilidade
  competitividade: 'Competitividade', // Compatibilidade
}

export function ApplyActionModal({
  open,
  onClose,
  onConfirm,
  actionType,
  beforeValue,
  afterValue,
  isLoading = false,
}: ApplyActionModalProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await onConfirm()
      setIsConfirming(false)
      onClose()
    } catch {
      setIsConfirming(false)
      // Erro já será tratado pelo hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar como aplicado - {actionTypeLabels[actionType]}</DialogTitle>
          <DialogDescription>
            Isso não altera automaticamente o anúncio no Mercado Livre. Apenas registra no SuperSeller IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* ANTES */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                ANTES
              </Badge>
            </div>
            <div className="p-4 bg-muted rounded-lg border-2 border-dashed">
              {typeof beforeValue === 'string' ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{beforeValue}</p>
              ) : (
                beforeValue
              )}
            </div>
          </div>

          {/* Seta */}
          <div className="flex justify-center">
            <ArrowRight className="h-6 w-6 text-primary" />
          </div>

          {/* DEPOIS */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs bg-primary">
                DEPOIS
              </Badge>
            </div>
            <div className="p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
              {typeof afterValue === 'string' ? (
                <p className="text-sm font-medium whitespace-pre-wrap">{afterValue}</p>
              ) : (
                afterValue
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading || isConfirming}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || isConfirming}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading || isConfirming ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar registro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
