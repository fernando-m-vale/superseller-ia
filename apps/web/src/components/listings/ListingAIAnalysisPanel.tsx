'use client'

import React, { useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, Flame, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { NormalizedAIAnalysisV21, NormalizedBenchmarkInsights, GeneratedContent } from '@/lib/ai/normalizeAiAnalyze'
import { buildMercadoLivreListingUrl } from '@/lib/mercadolivre-url'
import { useToast } from '@/hooks/use-toast'
import { OpportunityBlock } from './OpportunityBlock'
import { ExecutionProgress } from './ExecutionProgress'
import { ActionKanban } from './ActionKanban'
import { RegenerateAnalysisModal } from './RegenerateAnalysisModal'
import { useListingActions, updateListingActionStatus, type ListingActionStatus } from '@/hooks/use-listing-actions'

interface ListingAIAnalysisPanelProps {
  analysisV21: NormalizedAIAnalysisV21
  listingId?: string
  listingIdExt?: string | null
  listingTitle?: string
  listingPrice?: number
  listingPriceBase?: number | null
  listingPriceFinal?: number | null
  listingHasPromotion?: boolean | null
  listingDiscountPercent?: number | null
  pricingNormalized?: {
    originalPriceForDisplay: number
    finalPriceForDisplay: number
    hasPromotion: boolean
  }
  appliedActions?: Array<{
    actionType: string
    appliedAt: string
  }>
  dataQuality?: {
    performanceAvailable?: boolean
    completenessScore?: number
  }
  metrics30d?: {
    visits: number
    orders: number
    conversionRate: number | null
  }
  benchmark?: {
    benchmarkSummary: {
      categoryId: string | null
      sampleSize: number
      computedAt: string
      confidence: 'high' | 'medium' | 'low' | 'unavailable'
      notes?: string
      stats?: {
        medianPicturesCount: number
        percentageWithVideo: number
        medianPrice: number
        medianTitleLength: number
        sampleSize: number
      }
      baselineConversion?: {
        conversionRate: number | null
        sampleSize: number
        totalVisits: number
        confidence: 'high' | 'medium' | 'low' | 'unavailable'
      }
    }
    youWinHere: string[]
    youLoseHere: string[]
    tradeoffs?: string
    recommendations?: string[]
  } | null
  benchmarkInsights?: NormalizedBenchmarkInsights | null
  generatedContent?: GeneratedContent | null
  growthHacks?: Array<{
    id: string
    title: string
    summary: string
    why: string[]
    impact: 'low' | 'medium' | 'high'
    confidence: number
    confidenceLevel: 'low' | 'medium' | 'high'
    evidence: string[]
    suggestedActionUrl?: string | null
    categoryId?: string | null
  }>
  growthHacksMeta?: {
    rulesEvaluated: number
    rulesTriggered: number
    skippedBecauseOfHistory: number
    skippedBecauseOfRequirements: number
  }
  onRegenerate?: () => Promise<void>
  isRegenerating?: boolean
  score?: number
  critique?: string
}

export function ListingAIAnalysisPanel(props: ListingAIAnalysisPanelProps) {
  const { toast } = useToast()
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false)
  const editUrl = props.listingIdExt
    ? buildMercadoLivreListingUrl(props.listingIdExt, null, 'edit')
    : null

  const { data: actionsData, isLoading: actionsLoading, error: actionsError, refetch: refetchActions } =
    useListingActions(props.listingId || null)

  const actions = actionsData?.items || []
  const pendingActions = actions.filter((a) => a.status === 'A_IMPLEMENTAR')
  const nextAction = pendingActions[0]?.title || null
  const priority = pendingActions[0]?.priority || (pendingActions.length > 0 ? 'Alta' : null)

  const pendingCount = actions.filter((a) => a.status === 'A_IMPLEMENTAR').length
  const appliedCount = actions.filter((a) => a.status === 'IMPLEMENTADO').length
  const dismissedCount = actions.filter((a) => a.status === 'DESCARTADO').length

  const verdictText = useMemo(() => {
    if (props.analysisV21?.verdict && props.analysisV21.verdict.trim().length > 0) {
      return props.analysisV21.verdict.trim()
    }

    const parts: string[] = []

    if (props.critique && props.critique.trim().length > 0) {
      parts.push(props.critique.trim())
    }

    const visits = props.metrics30d?.visits
    const orders = props.metrics30d?.orders
    const cvr = props.metrics30d?.conversionRate

    const promoText = props.pricingNormalized?.hasPromotion
      ? `Promoção ativa: de R$ ${props.pricingNormalized.originalPriceForDisplay.toFixed(2)} por R$ ${props.pricingNormalized.finalPriceForDisplay.toFixed(2)}${
          props.listingDiscountPercent ? ` (-${props.listingDiscountPercent}%)` : ''
        }.`
      : null

    const metricsText =
      visits !== undefined && orders !== undefined
        ? `Métricas (30d): ${visits} visitas, ${orders} pedidos${
            cvr !== null && cvr !== undefined ? `, conversão ${(cvr * 100).toFixed(2)}%` : ''
          }.${promoText ? ` ${promoText}` : ''}`
        : promoText
          ? promoText
          : null

    if (metricsText) {
      parts.push(metricsText)
    }

    const top3 = actions.slice(0, 3).map((a) => `- ${a.title}`)
    if (top3.length > 0) {
      parts.push(`Principais ações:\n${top3.join('\n')}`)
    }

    return parts.length > 0 ? parts.join('\n\n') : 'Análise executiva não disponível no momento.'
  }, [
    props.analysisV21?.verdict,
    props.critique,
    props.metrics30d?.visits,
    props.metrics30d?.orders,
    props.metrics30d?.conversionRate,
    props.pricingNormalized?.hasPromotion,
    props.pricingNormalized?.originalPriceForDisplay,
    props.pricingNormalized?.finalPriceForDisplay,
    props.listingDiscountPercent,
    actions,
  ])

  const handleOpenEdit = () => {
    if (!editUrl) {
      toast({
        title: 'Erro',
        description: 'ID do anúncio no Mercado Livre indisponível',
        variant: 'destructive',
        duration: 2000,
      })
      return
    }
    window.open(editUrl, '_blank', 'noopener,noreferrer')
  }

  const handleRegenerateClick = () => setRegenerateModalOpen(true)

  const handleRegenerateConfirm = async () => {
    if (props.onRegenerate) {
      await props.onRegenerate()
    }
  }

  const handleKanbanStatusChange = async (actionId: string, newStatus: ListingActionStatus) => {
    if (!props.listingId) return
    await updateListingActionStatus({
      listingId: props.listingId,
      actionId,
      status: newStatus,
    })
    await refetchActions()
    toast({
      title: 'Status atualizado',
      description: 'O status da ação foi atualizado com sucesso.',
      duration: 1500,
    })
  }

  return (
    <div className="space-y-6 p-6 bg-background">
      {/* Header com resumo e ações */}
      <div className="flex items-start justify-between border-b pb-4">
        <div className="space-y-1">
          <h3 className="text-xl font-bold">{props.listingTitle || 'Anúncio'}</h3>
        </div>
        <div className="flex items-center gap-2">
          {editUrl && (
            <Button
              variant="default"
              size="sm"
              onClick={handleOpenEdit}
              className="bg-primary hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir no Mercado Livre
            </Button>
          )}
          {props.onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateClick}
              disabled={props.isRegenerating}
            >
              {props.isRegenerating ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                  Regenerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regerar análise
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Bloco de aviso quando não há métricas de performance */}
      {props.dataQuality?.performanceAvailable === false && (
        <Card className="border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">
                  ⚠️ Dados de performance ainda indisponíveis
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Este anúncio ainda não possui histórico suficiente de visitas e vendas.
                  A análise abaixo foca em otimizações de cadastro, SEO e mídia que podem ajudar a melhorar a performance.
                </p>
                {(props.metrics30d?.visits === 0 || props.metrics30d?.orders === 0) && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                    Visitas: {props.metrics30d?.visits || 0} | Pedidos: {props.metrics30d?.orders || 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* A) BLOCO OPORTUNIDADE */}
      <OpportunityBlock
        score={props.score || 0}
        priority={priority}
        nextAction={nextAction}
        hasActions={actions.length > 0}
      />

      {/* B) VEREDITO DIRETO */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/20">
              <Flame className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Veredito Direto</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Análise executiva do consultor</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-base leading-relaxed font-medium text-foreground whitespace-pre-wrap">
            {verdictText}
          </div>
        </CardContent>
      </Card>

      {/* C) PROGRESSO DE EXECUÇÃO */}
      <ExecutionProgress
        pending={pendingCount}
        applied={appliedCount}
        dismissed={dismissedCount}
      />

      {/* D) KANBAN SIMPLES */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Ações Recomendadas</h3>
        {actionsLoading ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Carregando ações...</p>
          </Card>
        ) : actionsError ? (
          <Card className="p-6">
            <p className="text-sm text-destructive">Erro ao carregar ações.</p>
          </Card>
        ) : actions.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Sem ações ainda — gere uma análise.</p>
          </Card>
        ) : (
          <ActionKanban
            actions={actions.map((a) => ({
              id: a.id,
              actionKey: a.actionKey,
              title: a.title,
              description: a.description,
              status: a.status,
              priority: a.priority,
              expectedImpact: a.expectedImpact,
              suggestedActionUrl: editUrl,
            }))}
            onStatusChange={handleKanbanStatusChange}
            editUrl={editUrl}
          />
        )}
      </div>

      {/* Modal de Regerar Análise */}
      <RegenerateAnalysisModal
        open={regenerateModalOpen}
        onClose={() => setRegenerateModalOpen(false)}
        onConfirm={handleRegenerateConfirm}
        isRegenerating={props.isRegenerating}
      />
    </div>
  )
}
