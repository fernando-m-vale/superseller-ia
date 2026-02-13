'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// Label não existe, usar label HTML nativo
import { Loader2, Plus, AlertCircle } from 'lucide-react'
import { useImportListing } from '@/hooks/use-import-listing'
import { useToast } from '@/hooks/use-toast'

interface ImportListingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ImportListingModal({ open, onOpenChange, onSuccess }: ImportListingModalProps) {
  const [externalId, setExternalId] = useState('')
  const { importListing, isLoading, error } = useImportListing()
  const { toast } = useToast()

  const handleImport = async () => {
    if (!externalId.trim()) {
      toast({
        title: 'ID obrigatório',
        description: 'Por favor, informe a URL ou ID MLB do anúncio',
        variant: 'destructive',
      })
      return
    }

    try {
      const result = await importListing(externalId.trim())
      
      toast({
        title: result.alreadyExists ? 'Anúncio já existe' : 'Anúncio importado',
        description: result.alreadyExists
          ? `O anúncio "${result.title}" já está na sua lista.`
          : `Anúncio "${result.title}" importado com sucesso!`,
      })

      // Limpar campo e fechar modal
      setExternalId('')
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      // Erro já é tratado pelo hook e exibido no toast
      const errorMessage = err instanceof Error ? err.message : 'Erro ao importar anúncio'
      toast({
        title: 'Erro ao importar',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setExternalId('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar anúncio</DialogTitle>
          <DialogDescription>
            Cole a URL ou ID MLB do anúncio do Mercado Livre para importá-lo.
            <br />
            <span className="text-xs text-muted-foreground mt-1 block">
              Exemplo: MLB1234567890 ou https://produto.mercadolivre.com.br/MLB-1234567890
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="externalId" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              URL ou ID MLB
            </label>
            <Input
              id="externalId"
              placeholder="MLB1234567890 ou URL completa"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading && externalId.trim()) {
                  handleImport()
                }
              }}
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Erro</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={isLoading || !externalId.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
