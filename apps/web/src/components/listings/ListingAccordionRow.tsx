'use client'

import { useEffect } from 'react'
import { ChevronDown, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAIAnalyze } from '@/hooks/use-ai-analyze'
import { ListingAIAnalysisPanel } from './ListingAIAnalysisPanel'
import type { Listing } from '@/hooks/use-listings'

interface ListingAccordionRowProps {
  listing: Listing
  isExpanded: boolean
  onToggle: () => void
}

function getAnalysisStatus(
  analysisStatus?: 'NOT_ANALYZED' | 'ANALYZED' | 'EXPIRED',
  latestAnalysisAt?: string | null
): {
  status: 'analyzed' | 'expired' | 'not_analyzed'
  badge: JSX.Element
  dateText?: string
} {
  // Usar status do backend (fonte única de verdade)
  if (!analysisStatus || analysisStatus === 'NOT_ANALYZED') {
    return {
      status: 'not_analyzed',
      badge: (
        <Badge variant="destructive" className="text-xs">
          🔴 Não analisado
        </Badge>
      ),
    }
  }

  if (analysisStatus === 'EXPIRED') {
    const analyzedDate = latestAnalysisAt ? new Date(latestAnalysisAt) : null
    return {
      status: 'expired',
      badge: (
        <Badge variant="default" className="text-xs bg-yellow-500">
          🟡 Expirada
        </Badge>
      ),
      dateText: analyzedDate
        ? `Analisada em: ${analyzedDate.toLocaleDateString('pt-BR')} ${analyzedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : undefined,
    }
  }

  // analysisStatus === 'ANALYZED'
  const analyzedDate = latestAnalysisAt ? new Date(latestAnalysisAt) : null
  return {
    status: 'analyzed',
    badge: (
      <Badge variant="default" className="text-xs bg-green-500">
        🟢 Analisado
      </Badge>
    ),
    dateText: analyzedDate
      ? `Analisada em: ${analyzedDate.toLocaleDateString('pt-BR')} ${analyzedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : undefined,
  }
}

function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return 'N/A'
  return `R$ ${Number(price).toFixed(2)}`
}

export function ListingAccordionRow({ listing, isExpanded, onToggle }: ListingAccordionRowProps) {
  const {
    data: aiAnalysis,
    isLoading: aiLoading,
    error: aiError,
    triggerAIAnalysis,
    fetchExisting,
  } = useAIAnalyze(isExpanded ? listing.id : null)

  // Buscar análise existente quando expandir
  useEffect(() => {
    if (isExpanded && !aiAnalysis?.analysisV21 && !aiLoading) {
      fetchExisting()
    }
  }, [isExpanded, aiAnalysis, aiLoading, fetchExisting])

  // Usar status do listing (backend) ao invés de estado local
  // Isso garante que o badge seja correto mesmo quando o accordion está fechado
  const analysisStatus = getAnalysisStatus(listing.analysisStatus, listing.latestAnalysisAt)

  // Preço promocional (TODO: integrar quando backend fornecer)
  // Por enquanto, usar mesmo valor do preço normal
  const promotionalPrice = listing.price // TODO: usar listing.priceFinal quando disponível
  const hasPromotion = false // TODO: usar listing.hasPromotion quando disponível

  const handleGenerateAnalysis = async () => {
    await triggerAIAnalysis(false)
  }

  const handleRegenerateAnalysis = async () => {
    await triggerAIAnalysis(true)
  }

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell className="font-medium">{listing.title}</TableCell>
        <TableCell>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            listing.marketplace === 'shopee' 
              ? 'bg-orange-100 text-orange-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {listing.marketplace === 'shopee' ? 'Shopee' : 'Mercado Livre'}
          </span>
        </TableCell>
        <TableCell>{formatPrice(listing.price)}</TableCell>
        <TableCell>
          {hasPromotion && promotionalPrice ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground line-through text-sm">
                {formatPrice(listing.price)}
              </span>
              <span className="text-primary font-medium">
                {formatPrice(promotionalPrice)}
              </span>
            </div>
          ) : (
            formatPrice(listing.price)
          )}
        </TableCell>
        <TableCell>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            listing.status === 'active' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {listing.status}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            {analysisStatus.badge}
            {analysisStatus.dateText && (
              <span className="text-xs text-muted-foreground">
                {analysisStatus.dateText}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <ChevronDown 
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} className="p-0">
            <div className="border-t bg-muted/30">
              {aiLoading && !aiAnalysis?.analysisV21 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground">Carregando análise...</p>
                </div>
              ) : aiError ? (
                <Card className="m-4">
                  <Card className="p-6">
                    <div className="flex flex-col items-center text-center">
                      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Erro ao carregar análise</h3>
                      <p className="text-sm text-muted-foreground mb-4">{aiError}</p>
                      <Button onClick={handleGenerateAnalysis} variant="outline">
                        Tentar novamente
                      </Button>
                    </div>
                  </Card>
                </Card>
              ) : aiAnalysis?.analysisV21 ? (
                <ListingAIAnalysisPanel
                  analysisV21={aiAnalysis.analysisV21}
                  listingIdExt={listing.listingIdExt}
                  listingTitle={listing.title}
                  listingPrice={listing.price}
                  listingPriceFinal={promotionalPrice}
                  listingHasPromotion={hasPromotion}
                  onRegenerate={handleRegenerateAnalysis}
                  isRegenerating={aiLoading}
                />
              ) : (
                <Card className="m-4">
                  <Card className="p-6">
                    <div className="flex flex-col items-center text-center">
                      <Sparkles className="h-12 w-12 text-primary mb-4 opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">Análise não disponível</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Clique em "Gerar análise" para receber recomendações personalizadas.
                      </p>
                      <Button onClick={handleGenerateAnalysis} disabled={aiLoading}>
                        {aiLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Gerar análise
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                </Card>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
