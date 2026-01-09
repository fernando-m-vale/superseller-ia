'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Target, ArrowRight } from 'lucide-react'

interface ActionPlanItem {
  dimension: 'cadastro' | 'midia' | 'performance' | 'seo' | 'competitividade'
  lostPoints: number
  whyThisMatters: string
  expectedScoreAfterFix: number
  priority: 'high' | 'medium' | 'low'
}

interface ActionPlanProps {
  actionPlan?: ActionPlanItem[]
  onActionClick?: (action: ActionPlanItem) => void
}

const DIMENSION_NAMES: Record<string, string> = {
  cadastro: 'Cadastro',
  midia: 'Mídia',
  performance: 'Performance',
  seo: 'SEO',
  competitividade: 'Competitividade',
}

const PRIORITY_COLORS: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-red-100 text-red-700 border-red-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  low: 'bg-blue-100 text-blue-700 border-blue-300',
}

export function ActionPlan({ actionPlan, onActionClick }: ActionPlanProps) {
  if (!actionPlan || actionPlan.length === 0) {
    return null
  }

  const handleActionClick = (action: ActionPlanItem) => {
    // Logar ação clicada (automação será implementada depois)
    console.log('[ACTION-PLAN] Ação clicada:', {
      dimension: action.dimension,
      lostPoints: action.lostPoints,
      priority: action.priority,
    })

    if (onActionClick) {
      onActionClick(action)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Plano de Ação</CardTitle>
        </div>
        <CardDescription>Melhorias priorizadas para aumentar seu score</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {actionPlan.map((action, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm">
                      {DIMENSION_NAMES[action.dimension]}
                    </h4>
                    <Badge
                      variant="outline"
                      className={`text-xs ${PRIORITY_COLORS[action.priority]}`}
                    >
                      {action.priority === 'high'
                        ? 'Alta Prioridade'
                        : action.priority === 'medium'
                        ? 'Média Prioridade'
                        : 'Baixa Prioridade'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Perdeu {action.lostPoints} ponto{action.lostPoints > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {action.whyThisMatters}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Score esperado após correção:</span>
                    <span className="font-semibold text-primary">
                      {action.expectedScoreAfterFix}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleActionClick(action)}
                className="w-full sm:w-auto"
              >
                Melhorar agora
                <ArrowRight className="h-3 w-3 ml-2" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

