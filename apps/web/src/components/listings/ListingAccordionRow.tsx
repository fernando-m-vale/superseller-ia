'use client'

import { useEffect, useState } from 'react'
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
        <div className="flex flex-col gap-1">
          <Badge variant="default" className="text-xs bg-yellow-500">
            🟡 Expirada
          </Badge>
          <span className="text-xs text-yellow-700 dark:text-yellow-400">
            Análise com mais de 7 dias. Recomendado regerar.
          </span>
        </div>
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
    analyzedAt: aiAnalyzedAt,
  } = useAIAnalyze(isExpanded ? listing.id : null)
  
  // HOTFIX 09.7: Estado local para latestAnalysisAt (atualizado após POST /analyze)
  const [localLatestAnalysisAt, setLocalLatestAnalysisAt] = useState<string | null | undefined>(listing.latestAnalysisAt)

  // HOTFIX 09.7: Escutar evento de atualização de análise
  useEffect(() => {
    const handleAnalysisUpdated = (event: CustomEvent<{ listingId: string; analyzedAt: string }>) => {
      if (event.detail.listingId === listing.id) {
        setLocalLatestAnalysisAt(event.detail.analyzedAt)
        console.log('[LISTING-ROW] latestAnalysisAt atualizado localmente', {
          listingId: listing.id,
          analyzedAt: event.detail.analyzedAt,
        })
      }
    }
    
    window.addEventListener('ai-analysis-updated', handleAnalysisUpdated as EventListener)
    return () => {
      window.removeEventListener('ai-analysis-updated', handleAnalysisUpdated as EventListener)
    }
  }, [listing.id])
  
  // HOTFIX 09.7: Atualizar localLatestAnalysisAt quando aiAnalyzedAt mudar (após POST /analyze)
  useEffect(() => {
    if (aiAnalyzedAt) {
      setLocalLatestAnalysisAt(aiAnalyzedAt)
    }
  }, [aiAnalyzedAt])

  // HOTFIX 09.3: Buscar análise existente quando expandir (guard melhorado)
  useEffect(() => {
    // Só buscar se:
    // 1. Accordion está expandido
    // 2. Não temos dados ainda (aiAnalysis é null ou não tem analysisV21)
    // 3. Não está carregando
    if (isExpanded && !aiAnalysis && !aiLoading) {
      fetchExisting()
    }
  }, [isExpanded, aiAnalysis, aiLoading, fetchExisting])

  // HOTFIX 09.7: Usar localLatestAnalysisAt se disponível, senão usar listing.latestAnalysisAt
  // Isso garante que a label "Atualizada em" seja atualizada imediatamente após POST /analyze
  const effectiveLatestAnalysisAt = localLatestAnalysisAt ?? listing.latestAnalysisAt
  
  // Usar status do listing (backend) ao invés de estado local
  // Isso garante que o badge seja correto mesmo quando o accordion está fechado
  const analysisStatus = getAnalysisStatus(listing.analysisStatus, effectiveLatestAnalysisAt)

  // Preços com fallback robusto (usando campos disponíveis na interface Listing)
  // originalPrice: preferir priceBase (preço original), depois price (preço atual)
  const originalPrice = Number(
    listing.priceBase ?? 
    listing.price ?? 
    0
  )
  
  // promotionalPrice: preferir priceFinal (preço promocional), depois price (preço atual)
  const promotionalPrice = Number(
    listing.priceFinal ?? 
    listing.price ?? 
    0
  )
  
  const hasPromotion = listing.hasPromotion ?? false
  
  // Verificar se há promoção efetiva (preço promocional menor que original)
  const hasPromotionEffective = Boolean(hasPromotion) && 
    promotionalPrice != null && 
    originalPrice != null && 
    promotionalPrice < originalPrice

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
        <TableCell>
          {/* Coluna "Preço original": mostrar original riscado se houver promoção */}
          {hasPromotionEffective ? (
            <span className="text-muted-foreground line-through text-sm">
              {formatPrice(originalPrice)}
            </span>
          ) : (
            formatPrice(listing.price)
          )}
        </TableCell>
        <TableCell>
          {/* Coluna "Preço promocional": mostrar promo se houver promoção */}
          {hasPromotionEffective ? (
            <div className="flex items-center gap-2">
              <span className="text-primary font-medium">
                {formatPrice(promotionalPrice)}
              </span>
              {listing.discountPercent && (
                <Badge variant="secondary" className="text-xs">
                  -{Math.round(listing.discountPercent)}%
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
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
                      <p className="text-sm text-muted-foreground mb-4">
                        {/* HOTFIX 09.4: Mensagem específica para erro de carregamento */}
                        {aiError.includes('não foi possível carregar') || aiError.includes('Formato de resposta inválido')
                          ? 'Não foi possível carregar a análise salva. Clique em "Gerar análise" para continuar.'
                          : aiError}
                      </p>
                      <Button onClick={handleGenerateAnalysis} variant="outline">
                        Gerar análise
                      </Button>
                    </div>
                  </Card>
                </Card>
              ) : aiAnalysis?.analysisV21 ? (
                <ListingAIAnalysisPanel
                  analysisV21={aiAnalysis.analysisV21}
                  listingId={listing.id}
                  listingIdExt={listing.listingIdExt}
                  listingTitle={listing.title}
                  listingPrice={listing.price}
                  dataQuality={aiAnalysis.dataQuality}
                  metrics30d={aiAnalysis.metrics30d}
                  listingPriceBase={listing.priceBase}
                  listingPriceFinal={promotionalPrice}
                  listingHasPromotion={hasPromotion}
                  listingDiscountPercent={listing.discountPercent}
                  pricingNormalized={aiAnalysis.pricingNormalized}
                  appliedActions={aiAnalysis.appliedActions}
                  benchmark={aiAnalysis.benchmark ?? null}
                  benchmarkInsights={aiAnalysis.benchmarkInsights}
                  generatedContent={aiAnalysis.generatedContent}
                  growthHacks={aiAnalysis.growthHacks}
                  growthHacksMeta={aiAnalysis.growthHacksMeta}
                  onRegenerate={handleRegenerateAnalysis}
                  isRegenerating={aiLoading}
                  score={aiAnalysis.score}
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
