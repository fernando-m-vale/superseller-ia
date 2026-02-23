'use client'

import React from 'react'
import { CheckCircle2, XCircle, TrendingUp, Info, ExternalLink, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getOpportunityLabel, getOpportunityBadgeVariant } from '@/lib/hacks/opportunityScore'

export interface HackEvidenceItem {
  key: string
  label: string
  value: string | number
  formatted: string
}

export interface HackRecommendation {
  text: string
  suggestion?: string
  note?: string
}

export interface HackAction {
  label: string
  url: string
  variant?: 'default' | 'outline' | 'secondary'
}

export interface HackCardUX2Props {
  hackId?: string
  title: string
  summary: string
  impact: 'low' | 'medium' | 'high'
  confidence: number
  confidenceLevel: 'low' | 'medium' | 'high'
  evidence: HackEvidenceItem[]
  diagnosis?: string
  recommendation: HackRecommendation
  requires?: string[]
  status: 'suggested' | 'confirmed' | 'dismissed'
  onConfirm: () => void | Promise<void>
  onDismiss: () => void | Promise<void>
  actions?: HackAction[]
  priorityRank?: number
  opportunityScore?: number
  isLoading?: boolean
}

// HOTFIX 09.6: Opportunity Score agora é calculado no HacksPanel usando o helper centralizado

/**
 * Helper para obter cor do impacto
 */
function getImpactColor(impact: 'low' | 'medium' | 'high'): string {
  switch (impact) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-400'
    case 'medium':
      return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/20 dark:text-orange-400'
    case 'low':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400'
  }
}

/**
 * Helper para obter cor da confidence (mais discreta)
 */
function getConfidenceColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'high':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-400'
    case 'medium':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400'
    case 'low':
      return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
  }
}

/**
 * HackCardUX2 - Card de decisão para hacks com hierarquia visual forte
 * 
 * Hierarquia:
 * 1) Impacto (forte)
 * 2) Confiança (discreta + tooltip)
 * 3) Evidências em mini dashboard (grid)
 * 4) Recomendação objetiva (com sugestão se houver)
 * 5) CTA com ação direta
 */
export function HackCardUX2({
  title,
  summary,
  impact,
  confidence,
  confidenceLevel,
  evidence,
  diagnosis,
  recommendation,
  requires,
  status,
  onConfirm,
  onDismiss,
  actions = [],
  priorityRank,
  opportunityScore,
  isLoading = false,
}: HackCardUX2Props) {
  // HOTFIX 09.6: Opportunity Score deve vir calculado do HacksPanel
  // Se não vier, usar fallback simples (não ideal, mas evita erro)
  const displayOpportunityScore = opportunityScore ?? Math.round(confidence * 0.6 + (impact === 'high' ? 90 : impact === 'medium' ? 65 : 35) * 0.4)
  const opportunityLabel = getOpportunityLabel(displayOpportunityScore)
  const opportunityBadgeVariant = getOpportunityBadgeVariant(displayOpportunityScore)
  const isDisabled = status !== 'suggested' || isLoading

  return (
    <Card
      className={`bg-gradient-to-r from-primary/5 to-primary/10 border-l-4 ${
        status === 'confirmed'
          ? 'border-l-green-500 opacity-60'
          : status === 'dismissed'
          ? 'border-l-gray-400 opacity-60'
          : 'border-l-primary'
      }`}
    >
      <CardContent className="pt-4">
        <div className="space-y-4">
          {/* Header: Título + Badges (Impacto + Opportunity Score + Confidence) */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-base text-foreground">{title}</h4>
                {priorityRank && (
                  <Badge variant="outline" className="text-xs">
                    #{priorityRank}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-3">{summary}</p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              {/* Impacto (forte) */}
              <Badge className={getImpactColor(impact)}>
                <TrendingUp className="h-3 w-3 mr-1" />
                Impacto: {impact === 'high' ? 'Alto' : impact === 'medium' ? 'Médio' : 'Baixo'}
              </Badge>
              
              {/* Opportunity Score - HOTFIX 09.6 */}
              <Badge variant={opportunityBadgeVariant} className="text-xs font-semibold">
                {opportunityLabel} ({displayOpportunityScore}/100)
              </Badge>
              
              {/* Confidence (discreta + tooltip) */}
              <div className="flex items-center gap-1">
                <Badge className={getConfidenceColor(confidenceLevel)}>
                  {confidence}% {confidenceLevel === 'high' ? 'Alta' : confidenceLevel === 'medium' ? 'Média' : 'Baixa'}
                </Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
                        aria-label="Informações sobre Confidence"
                      >
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-semibold">Confidence (Confiança)</p>
                        <p className="text-sm">
                          A confiança do sistema na recomendação, baseada nos dados do anúncio (visitas, conversão, preço, mídia etc.).
                        </p>
                        <div className="text-xs space-y-1 pt-2 border-t">
                          <p><strong>Alta (≥70%):</strong> Recomendação muito confiável</p>
                          <p><strong>Média (40-69%):</strong> Recomendação moderadamente confiável</p>
                          <p><strong>Baixa (0-39%):</strong> Recomendação com baixa confiança</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Diagnóstico */}
          {diagnosis && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{diagnosis}</p>
              </div>
            </div>
          )}

          {/* Evidências em grid (mini dashboard) */}
          {evidence.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">Evidências</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {evidence.slice(0, 6).map((item) => (
                  <div
                    key={item.key}
                    className="p-2 bg-background border rounded-md text-xs"
                  >
                    <div className="text-muted-foreground font-medium mb-0.5">
                      {item.label}
                    </div>
                    <div className="text-foreground font-semibold">
                      {item.formatted}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendação (caixa destacada) */}
          <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-lg space-y-2">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Recomendação
            </div>
            <p className="text-sm text-foreground">{recommendation.text}</p>
            {recommendation.suggestion && (
              <div className="mt-2 p-2 bg-background rounded border border-primary/30">
                <p className="text-xs text-muted-foreground mb-1">Sugestão:</p>
                <p className="text-sm text-foreground font-medium">{recommendation.suggestion}</p>
              </div>
            )}
            {recommendation.note && (
              <p className="text-xs text-muted-foreground italic mt-1">{recommendation.note}</p>
            )}
          </div>

          {/* Requires (blocking) */}
          {requires && requires.length > 0 && (
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-400">
              <strong>Requisitos:</strong> {requires.join(', ')}
            </div>
          )}

          <Separator />

          {/* CTAs e Botões de ação */}
          <div
            className="flex gap-2 flex-wrap"
            onClickCapture={(e) => {
              e.stopPropagation()
            }}
            onPointerDownCapture={(e) => {
              e.stopPropagation()
            }}
            onMouseDownCapture={(e) => {
              e.stopPropagation()
            }}
          >
            {status === 'confirmed' ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Implementado</span>
              </div>
            ) : status === 'dismissed' ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <XCircle className="h-4 w-4" />
                <span>Não se aplica</span>
              </div>
            ) : (
              <>
                {/* Ações (CTAs) */}
                {actions.map((action, idx) => (
                  <a
                    key={idx}
                    href={action.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 ${
                      action.variant === 'default'
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : action.variant === 'secondary'
                        ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                    } relative z-20 pointer-events-auto`}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {action.label}
                  </a>
                ))}

                {/* Botão Confirmar */}
                <Button
                  variant="default"
                  size="sm"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onConfirm()
                  }}
                  disabled={isDisabled}
                  className="flex-1 relative z-20 pointer-events-auto min-w-[140px]"
                  type="button"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirmar implementação
                    </>
                  )}
                </Button>

                {/* Botão Não se aplica */}
                <Button
                  variant="outline"
                  size="sm"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDismiss()
                  }}
                  disabled={isDisabled}
                  className="flex-1 relative z-20 pointer-events-auto min-w-[140px]"
                  type="button"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 mr-2 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Não se aplica
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
