'use client'

import { useState } from 'react'
import { Copy, Check, Tag, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

export interface PromotionPlacementItem {
  id: string
  title: string
  where: string
  how: string
  constraints: string[]
  exampleText: string
}

interface PromotionHighlightPanelProps {
  hasPromotion: boolean
  originalPrice?: number
  finalPrice?: number
  discountPercent?: number | null
  placements?: PromotionPlacementItem[]
}

export function PromotionHighlightPanel({
  hasPromotion,
  originalPrice,
  finalPrice,
  discountPercent,
  placements = [],
}: PromotionHighlightPanelProps) {
  const { toast } = useToast()
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIds(prev => new Set(prev).add(id))
      toast({
        title: 'Copiado!',
        description: 'Texto copiado para a area de transferencia',
        duration: 2000,
      })
      setTimeout(() => {
        setCopiedIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 2000)
    } catch {
      toast({
        title: 'Erro',
        description: 'Nao foi possivel copiar o texto',
        variant: 'destructive',
        duration: 2000,
      })
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (!hasPromotion) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Preco / Promocao</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sem promocao ativa detectada no momento.
          </p>
        </CardContent>
      </Card>
    )
  }

  const pct = discountPercent
    ? `${Math.round(discountPercent)}%`
    : originalPrice && finalPrice
      ? `${Math.round((1 - finalPrice / originalPrice) * 100)}%`
      : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          <CardTitle>Preco / Promocao</CardTitle>
          <Badge variant="default" className="ml-auto">Promo ativa detectada</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          {originalPrice != null && (
            <div>
              <p className="text-muted-foreground">Preco original</p>
              <p className="font-semibold line-through">R$ {originalPrice.toFixed(2)}</p>
            </div>
          )}
          {finalPrice != null && (
            <div>
              <p className="text-muted-foreground">Preco promocional</p>
              <p className="font-semibold text-green-600">R$ {finalPrice.toFixed(2)}</p>
            </div>
          )}
          {pct && (
            <div>
              <p className="text-muted-foreground">Desconto</p>
              <p className="font-semibold">{pct}</p>
            </div>
          )}
        </div>

        {placements.length > 0 && (
          <div className="pt-4 border-t space-y-3">
            <p className="text-sm font-semibold">Onde e como destacar a promocao</p>

            {placements.map((item, idx) => {
              const isExpanded = expandedIds.has(item.id)
              return (
                <div key={item.id} className="border rounded-lg p-3 space-y-2">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => toggleExpand(item.id)}
                  >
                    <span className="text-sm font-medium">
                      {idx + 1}. {item.title}
                    </span>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </button>

                  {isExpanded && (
                    <div className="space-y-2 pt-2">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Onde:</p>
                        <p className="text-sm">{item.where}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Como:</p>
                        <p className="text-sm">{item.how}</p>
                      </div>
                      {item.constraints.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Restricoes:</p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {item.constraints.map((c, ci) => (
                              <li key={ci}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {item.exampleText && (
                        <div className="flex items-center gap-2 pt-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
                            {item.exampleText}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(item.exampleText, item.id)}
                          >
                            {copiedIds.has(item.id) ? (
                              <>
                                <Check className="h-3 w-3 mr-1 text-green-600" />
                                Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" />
                                Copiar texto
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
