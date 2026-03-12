'use client'

import React, { useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, Flame, Image as ImageIcon, Sparkles, Target, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { NormalizedAIAnalysisV21, NormalizedBenchmarkInsights, GeneratedContent, NormalizedVisualAnalysis } from '@/lib/ai/normalizeAiAnalyze'
import { buildMercadoLivreListingUrl } from '@/lib/mercadolivre-url'
import { useToast } from '@/hooks/use-toast'
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
  // DIA 10: verdictText completo gerado pelo backend (fonte única de verdade)
  verdictText?: string
  funnelDiagnosis?: {
    primaryBottleneck: 'SEARCH' | 'CLICK' | 'CONVERSION'
    explanation: string
    recommendedFocus: string
  }
  executionRoadmap?: Array<{
    stepNumber: number
    actionTitle: string
    reason: string
    expectedImpact: string
  }>
  visualScore?: number | null
  visualAnalysis?: NormalizedVisualAnalysis
  dataFreshness?: string | null
}

export function ListingAIAnalysisPanel(props: ListingAIAnalysisPanelProps) {
  const { toast } = useToast()
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false)
  const [verdictExpanded, setVerdictExpanded] = useState(false)
  const editUrl = props.listingIdExt
    ? buildMercadoLivreListingUrl(props.listingIdExt, null, 'edit')
    : null

  const { data: actionsData, isLoading: actionsLoading, error: actionsError, refetch: refetchActions } =
    useListingActions(props.listingId || null)

  const actions = actionsData?.items || []
  const pendingActions = actions.filter((a) => a.status === 'A_IMPLEMENTAR')
  
  // Lógica inteligente para próxima ação recomendada
  const bottleneckLabel = {
    SEARCH: 'BUSCA',
    CLICK: 'CLIQUE',
    CONVERSION: 'CONVERSÃO',
  } as const

  const bottleneckBadgeClass = {
    SEARCH: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    CLICK: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    CONVERSION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  } as const

  const roundOpportunity = useMemo(() => {
    if (!props.funnelDiagnosis) return null

    const primary = props.funnelDiagnosis.primaryBottleneck
    const objectiveByBottleneck = {
      SEARCH: 'Aumentar entrada qualificada no anúncio',
      CLICK: 'Elevar taxa de clique nas impressões já conquistadas',
      CONVERSION: 'Reduzir hesitação e melhorar decisão de compra',
    } as const

    const leverageByBottleneck = {
      SEARCH: 'Estrutura de título orientada para termos buscáveis',
      CLICK: 'Clareza imediata de oferta no título e imagem principal',
      CONVERSION: 'Maior clareza de uso, especificações e confiança',
    } as const

    const stageSignals = [
      ...(props.executionRoadmap || []).map((step) => step.expectedImpact).filter(Boolean),
      ...pendingActions.map((action) => action.expectedImpact).filter(Boolean),
    ] as string[]

    const hasVisitsSignal = stageSignals.some((signal) => /visit|busca/i.test(signal))
    const hasCtrSignal = stageSignals.some((signal) => /ctr|clique/i.test(signal))
    const hasConversionSignal = stageSignals.some((signal) => /convers/i.test(signal))

    const expectedGains = [
      hasVisitsSignal ? 'Visitas: tendência de ganho de alcance qualificado ao corrigir visibilidade.' : null,
      hasCtrSignal ? 'CTR: tendência de melhora na atração de clique com proposta mais clara.' : null,
      hasConversionSignal ? 'Conversão: tendência de avanço ao reduzir dúvidas na decisão final.' : null,
    ].filter(Boolean) as string[]

    return {
      objective: objectiveByBottleneck[primary],
      leverage: leverageByBottleneck[primary],
      summary:
        primary === 'SEARCH'
          ? 'Esta rodada está orientada para destravar visibilidade e aumentar tráfego qualificado.'
          : primary === 'CLICK'
            ? 'Esta rodada está orientada para transformar exposição em mais cliques qualificados.'
            : 'Esta rodada está orientada para converter melhor o tráfego já existente.',
      expectedGains,
    }
  }, [props.funnelDiagnosis, props.executionRoadmap, pendingActions])

  const formatVisualImpact = (impact: string) => {
    const normalized = impact.trim()
    if (/^\+/.test(normalized) || normalized.includes('%')) {
      return `📈 ${normalized}`
    }
    return normalized
  }

  const pendingCount = actions.filter((a) => a.status === 'A_IMPLEMENTAR').length
  const appliedCount = actions.filter((a) => a.status === 'IMPLEMENTADO').length
  const dismissedCount = actions.filter((a) => a.status === 'DESCARTADO').length

  // DIA 10: Veredito Direto — fonte única de verdade
  // Prioridade: props.verdictText (backend completo) > analysisV21.verdict > critique
  // NÃO combinar múltiplas fontes para evitar duplicação
  const verdictText = useMemo(() => {
    // 1. Preferir verdictText do backend (texto completo, sem cortes)
    if (props.verdictText && props.verdictText.trim().length > 0) {
      return props.verdictText.trim()
    }

    // 2. Fallback: analysisV21.verdict (completo)
    const v21Verdict = props.analysisV21?.verdict?.trim() || ''
    if (v21Verdict.length > 0) {
      return v21Verdict
    }

    // 3. Fallback final: critique (completo)
    if (props.critique && props.critique.trim().length > 0) {
      return props.critique.trim()
    }

    return 'Análise executiva não disponível no momento.'
  }, [
    props.verdictText,
    props.analysisV21?.verdict,
    props.critique,
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
                  <Flame className="h-4 w-4 mr-2" />
                  REGERAR ANÁLISE
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Bloco de aviso quando não há métricas de performance */}
      {props.dataQuality && !props.dataQuality.performanceAvailable && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>Atenção:</strong> Este anúncio ainda não possui métricas de performance suficientes
                  (visitas, pedidos, conversão). A análise está baseada apenas em dados estruturais do anúncio.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* A) VEREDITO DIRETO (primeiro) */}
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
          <div className={`text-base leading-relaxed font-medium text-foreground whitespace-pre-wrap ${!verdictExpanded && verdictText && verdictText.length > 300 ? 'line-clamp-4' : ''}`}>
            {verdictText || 'Veredito não disponível'}
          </div>
          
          {verdictText && verdictText.length > 300 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVerdictExpanded(!verdictExpanded)}
            >
              {verdictExpanded ? 'Recolher' : 'Expandir'}
            </Button>
          )}
        </CardContent>
      </Card>

      {props.visualAnalysis && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <ImageIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Qualidade visual do anúncio</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Análise da imagem principal do anúncio
                  </p>
                  {props.visualAnalysis.meta && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {props.visualAnalysis.meta.cacheHit ? 'Análise visual em cache' : 'Análise visual recém-processada'}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{props.visualAnalysis.visualScore}</div>
                <div className="text-xs text-muted-foreground">score visual</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{props.visualAnalysis.summary}</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clareza</p>
                <p className="mt-1 text-2xl font-semibold">{props.visualAnalysis.clarity.score}</p>
                <p className="mt-1 text-sm text-muted-foreground">{props.visualAnalysis.clarity.assessment}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contraste</p>
                <p className="mt-1 text-2xl font-semibold">{props.visualAnalysis.contrast.score}</p>
                <p className="mt-1 text-sm text-muted-foreground">{props.visualAnalysis.contrast.assessment}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Poluição visual</p>
                <p className="mt-1 text-2xl font-semibold">{props.visualAnalysis.visualPollution.score}</p>
                <p className="mt-1 text-sm text-muted-foreground">{props.visualAnalysis.visualPollution.assessment}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Texto excessivo</p>
                <p className="mt-1 text-2xl font-semibold">{props.visualAnalysis.excessiveText.score}</p>
                <p className="mt-1 text-sm text-muted-foreground">{props.visualAnalysis.excessiveText.assessment}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diferenciação</p>
                <p className="mt-1 text-2xl font-semibold">{props.visualAnalysis.differentiation.score}</p>
                <p className="mt-1 text-sm text-muted-foreground">{props.visualAnalysis.differentiation.assessment}</p>
              </div>
              {props.visualAnalysis.clickability && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clickability</p>
                  <p className="mt-1 text-2xl font-semibold">{props.visualAnalysis.clickability.score}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{props.visualAnalysis.clickability.assessment}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Principais melhorias</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {props.visualAnalysis.mainImprovements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {props.dataFreshness && (
              <p className="text-xs text-muted-foreground">{props.dataFreshness}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* B) DIAGNÓSTICO DE FUNIL */}
      {props.funnelDiagnosis && (
        <Card className="border border-primary/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Diagnóstico do funil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="text-foreground">
              <strong>Gargalo principal do anúncio:</strong>{' '}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${bottleneckBadgeClass[props.funnelDiagnosis.primaryBottleneck]}`}
              >
                {bottleneckLabel[props.funnelDiagnosis.primaryBottleneck]}
              </span>
            </p>
            <p>{props.funnelDiagnosis.explanation}</p>
            <p>
              <strong>Foco desta rodada:</strong> {props.funnelDiagnosis.recommendedFocus}
            </p>
          </CardContent>
        </Card>
      )}

      {/* C) GANHO POTENCIAL DA RODADA */}
      {roundOpportunity && (
        <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ganho potencial da rodada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground">{roundOpportunity.summary}</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>
                  <strong>Objetivo principal:</strong> {roundOpportunity.objective}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>
                  <strong>Alavanca esperada:</strong> {roundOpportunity.leverage}
                </span>
              </p>
            </div>
            {roundOpportunity.expectedGains.length > 0 && (
              <div className="rounded-md border bg-background/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Ganho esperado por estágio
                </p>
                <div className="space-y-1">
                  {roundOpportunity.expectedGains.map((gain) => (
                    <p key={gain} className="text-sm text-muted-foreground">
                      {gain}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {props.executionRoadmap && props.executionRoadmap.length > 0 && (
        <Card className="border border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plano de execução recomendado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {props.executionRoadmap.map((step) => (
              <div key={step.stepNumber} className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                    Passo {step.stepNumber}
                  </span>
                  <span>
                    {step.actionTitle}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2" title={step.reason}>
                  <strong>Por que agora:</strong> {step.reason}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Impacto estimado:</strong>{' '}
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {formatVisualImpact(step.expectedImpact)}
                  </span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* D) PROGRESSO DE EXECUÇÃO */}
      <ExecutionProgress
        pending={pendingCount}
        applied={appliedCount}
        dismissed={dismissedCount}
      />

      {/* E) KANBAN SIMPLES */}
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
              effort: null, // Será preenchido pelos detalhes quando disponível
              suggestedActionUrl: editUrl,
            }))}
            onStatusChange={handleKanbanStatusChange}
            editUrl={editUrl}
            listingId={props.listingId || undefined}
          />
        )}
      </div>

      {/* Modal de Regerar Análise */}
      <RegenerateAnalysisModal
        open={regenerateModalOpen}
        onOpenChange={setRegenerateModalOpen}
        onConfirm={handleRegenerateConfirm}
        isRegenerating={props.isRegenerating}
      />
    </div>
  )
}
