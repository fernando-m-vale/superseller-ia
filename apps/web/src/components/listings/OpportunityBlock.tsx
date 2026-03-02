'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp } from 'lucide-react'

interface OpportunityBlockProps {
  score: number
  priority?: string | null
  nextAction?: string | null
}

export function OpportunityBlock({ score, priority, nextAction }: OpportunityBlockProps) {
  const getScoreColor = (scoreValue: number) => {
    if (scoreValue >= 80) return 'text-green-600 dark:text-green-400'
    if (scoreValue >= 60) return 'text-blue-600 dark:text-blue-400'
    if (scoreValue >= 40) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getScoreBgColor = (scoreValue: number) => {
    if (scoreValue >= 80) return 'bg-green-100 dark:bg-green-900/20'
    if (scoreValue >= 60) return 'bg-blue-100 dark:bg-blue-900/20'
    if (scoreValue >= 40) return 'bg-yellow-100 dark:bg-yellow-900/20'
    return 'bg-red-100 dark:bg-red-900/20'
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="text-lg">Oportunidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Score</span>
          <Badge className={`${getScoreBgColor(score)} ${getScoreColor(score)} text-lg font-bold px-4 py-1`}>
            {score}/100
          </Badge>
        </div>

        {/* Prioridade */}
        {priority && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Prioridade</span>
            <Badge variant="outline" className="text-sm">
              {priority}
            </Badge>
          </div>
        )}

        {/* Próxima ação recomendada */}
        {nextAction && (
          <div className="pt-2 border-t">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Próxima ação recomendada</p>
                <p className="text-sm text-foreground">{nextAction}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
