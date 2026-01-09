'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info, TrendingDown } from 'lucide-react'

interface ScoreBreakdownProps {
  score: number
  scoreBreakdown?: {
    cadastro: number
    midia: number
    performance: number
    seo: number
    competitividade: number
  }
  dataQuality?: {
    performanceAvailable?: boolean
    visitsCoverage?: {
      filledDays: number
      totalDays: number
    }
  }
}

const MAX_SCORE_BY_DIMENSION: Record<string, number> = {
  cadastro: 20,
  midia: 20,
  performance: 30,
  seo: 20,
  competitividade: 10,
}

const DIMENSION_INFO: Record<string, { name: string; icon: string; description: string; whyMatters: string }> = {
  cadastro: {
    name: 'Cadastro',
    icon: '📝',
    description: 'Avalia título, descrição, categoria e status do anúncio.',
    whyMatters: 'Um cadastro completo melhora relevância e confiança do comprador.',
  },
  midia: {
    name: 'Mídia',
    icon: '🖼️',
    description: 'Avalia quantidade de fotos e presença de vídeo/clips.',
    whyMatters: 'Anúncios com mídia mais completa tendem a gerar maior engajamento e conversão.',
  },
  performance: {
    name: 'Performance',
    icon: '📈',
    description: 'Avalia visitas, pedidos e taxa de conversão.',
    whyMatters: 'Métricas de performance ajudam a identificar oportunidades de melhoria.',
  },
  seo: {
    name: 'SEO',
    icon: '🔍',
    description: 'Avalia CTR (click-through rate) e otimização do conteúdo.',
    whyMatters: 'Um título otimizado aumenta a visibilidade e o CTR nas buscas.',
  },
  competitividade: {
    name: 'Competitividade',
    icon: '🏆',
    description: 'Avalia preço e condições competitivas na categoria.',
    whyMatters: 'Preço e condições competitivas influenciam a decisão de compra.',
  },
}

export function ScoreBreakdown({ score, scoreBreakdown, dataQuality }: ScoreBreakdownProps) {
  if (!scoreBreakdown) {
    return null
  }

  const getScoreColor = (scoreValue: number, maxScore: number) => {
    const percentage = (scoreValue / maxScore) * 100
    if (percentage >= 70) return 'text-green-600'
    if (percentage >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (scoreValue: number, maxScore: number) => {
    const percentage = (scoreValue / maxScore) * 100
    if (percentage >= 70) return 'bg-green-600'
    if (percentage >= 50) return 'bg-yellow-600'
    return 'bg-red-600'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">IA Score</CardTitle>
          <Badge
            className={`${
              score >= 80
                ? 'bg-green-100 text-green-600'
                : score >= 60
                ? 'bg-blue-100 text-blue-600'
                : score >= 40
                ? 'bg-yellow-100 text-yellow-600'
                : 'bg-red-100 text-red-600'
            } text-lg font-bold px-4 py-1`}
          >
            {score}/100
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barra principal */}
        <div className="w-full bg-muted rounded-full h-3 mb-4">
          <div
            className={`h-3 rounded-full transition-all ${
              score >= 80
                ? 'bg-green-600'
                : score >= 60
                ? 'bg-blue-600'
                : score >= 40
                ? 'bg-yellow-600'
                : 'bg-red-600'
            }`}
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>

        {/* Breakdown por dimensão */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Breakdown por Dimensão</h4>
          {Object.entries(scoreBreakdown).map(([dimension, scoreValue]) => {
            const maxScore = MAX_SCORE_BY_DIMENSION[dimension] || 100
            const clampedScore = Math.min(scoreValue, maxScore)
            const percentage = maxScore > 0 ? (clampedScore / maxScore) * 100 : 0
            const lostPoints = maxScore - clampedScore
            const info = DIMENSION_INFO[dimension]
            const isPerformance = dimension === 'performance'
            const performanceUnavailable = isPerformance && dataQuality?.performanceAvailable === false

            return (
              <div key={dimension} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 cursor-help">
                            <span className="font-medium capitalize">
                              {info?.icon} {info?.name}
                            </span>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-2">
                            <p className="font-semibold">{info?.description}</p>
                            <p className="text-xs text-muted-foreground">{info?.whyMatters}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {performanceUnavailable && (
                      <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
                        Dados indisponíveis via API
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={getScoreColor(clampedScore, maxScore)}>
                      {clampedScore}/{maxScore}
                    </span>
                    {lostPoints > 0 && !performanceUnavailable && (
                      <span className="text-xs text-red-600 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        -{lostPoints}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getScoreBgColor(clampedScore, maxScore)}`}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
                {lostPoints > 0 && !performanceUnavailable && (
                  <p className="text-xs text-red-600 mt-1">
                    Você perdeu {lostPoints} ponto{lostPoints > 1 ? 's' : ''} aqui
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

