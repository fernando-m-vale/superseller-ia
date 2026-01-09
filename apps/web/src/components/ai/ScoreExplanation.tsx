'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Lightbulb } from 'lucide-react'

interface ScoreExplanationProps {
  scoreExplanation?: string[]
  scoreBreakdown?: {
    cadastro: number
    midia: number
    performance: number
    seo: number
    competitividade: number
  }
}

const MAX_SCORE_BY_DIMENSION: Record<string, number> = {
  cadastro: 20,
  midia: 20,
  performance: 30,
  seo: 20,
  competitividade: 10,
}

export function ScoreExplanation({ scoreExplanation, scoreBreakdown }: ScoreExplanationProps) {
  if (!scoreExplanation || scoreExplanation.length === 0) {
    return null
  }

  // Ordenar explicações: dimensões com maior perda primeiro
  const sortedExplanations = [...scoreExplanation].sort((a, b) => {
    if (!scoreBreakdown) return 0

    // Extrair dimensão da explicação
    const getDimensionFromExplanation = (expl: string): string | null => {
      if (expl.toLowerCase().includes('cadastro')) return 'cadastro'
      if (expl.toLowerCase().includes('mídia') || expl.toLowerCase().includes('midia')) return 'midia'
      if (expl.toLowerCase().includes('performance')) return 'performance'
      if (expl.toLowerCase().includes('seo')) return 'seo'
      if (expl.toLowerCase().includes('competitividade')) return 'competitividade'
      return null
    }

    const dimA = getDimensionFromExplanation(a)
    const dimB = getDimensionFromExplanation(b)

    if (!dimA || !dimB) return 0

    const maxA = MAX_SCORE_BY_DIMENSION[dimA] || 100
    const maxB = MAX_SCORE_BY_DIMENSION[dimB] || 100
    const scoreA = scoreBreakdown[dimA as keyof typeof scoreBreakdown] || 0
    const scoreB = scoreBreakdown[dimB as keyof typeof scoreBreakdown] || 0
    const lostA = maxA - scoreA
    const lostB = maxB - scoreB

    // Ordenar por perda de pontos (maior primeiro)
    return lostB - lostA
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Explicação do Score</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {sortedExplanations.map((explanation, index) => (
            <li key={index} className="flex items-start gap-3 text-sm leading-relaxed">
              <span className="text-primary font-semibold mt-0.5">{index + 1}.</span>
              <span className="text-foreground flex-1">{explanation}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

