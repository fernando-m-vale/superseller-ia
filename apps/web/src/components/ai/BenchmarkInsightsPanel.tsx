'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TrendingUp, TrendingDown, AlertCircle, Target, Info } from 'lucide-react'

interface BenchmarkWin {
  message: string
  evidence?: string
}

interface BenchmarkLoss {
  message: string
  evidence?: string
}

interface CriticalGap {
  id: string
  dimension: 'price' | 'title' | 'images' | 'video' | 'description'
  title: string
  whyItMatters: string
  impact: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  confidence: 'high' | 'medium' | 'low'
  metrics?: Record<string, number | string>
}

interface BenchmarkInsights {
  confidence: 'high' | 'medium' | 'low' | 'unavailable'
  wins: BenchmarkWin[]
  losses: BenchmarkLoss[]
  criticalGaps: CriticalGap[]
}

interface BenchmarkInsightsPanelProps {
  benchmarkInsights: BenchmarkInsights
}

export function BenchmarkInsightsPanel({ benchmarkInsights }: BenchmarkInsightsPanelProps) {
  const { confidence, wins, losses, criticalGaps } = benchmarkInsights

  // Se confidence é unavailable, mostrar mensagem simples
  if (confidence === 'unavailable') {
    return (
      <Card className="border-l-4 border-l-yellow-500">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            </div>
            <CardTitle className="text-lg">Comparação com Concorrentes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Comparação indisponível por enquanto. Dados insuficientes para gerar comparação com concorrentes.
          </div>
        </CardContent>
      </Card>
    )
  }

  // Renderizar comparação completa
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Comparação com Concorrentes</CardTitle>
          </div>
          <Badge 
            variant={
              confidence === 'high' ? 'default' :
              confidence === 'medium' ? 'secondary' :
              'outline'
            }
            className="text-xs"
          >
            {confidence === 'high' ? 'Alta confiança' :
             confidence === 'medium' ? 'Média confiança' :
             'Baixa confiança'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Banner quando fallback heurístico (HOTFIX P0) */}
        {confidence === 'low' && criticalGaps.length > 0 && criticalGaps.some(g => g.metrics?.source === 'internal_heuristics' || g.metrics?.fieldsUsed) && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs text-muted-foreground">
              Benchmark do Mercado Livre indisponível. Priorização baseada em sinais do seu anúncio.
            </AlertDescription>
          </Alert>
        )}

        {/* 2 colunas: Você ganha vs Você perde */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Você ganha aqui */}
          {wins.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span>Você ganha aqui</span>
              </div>
              <ul className="space-y-2 pl-6">
                {wins.map((win, idx) => (
                  <li key={idx} className="text-sm text-foreground list-disc">
                    {win.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Você perde aqui */}
          {losses.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-600">
                <TrendingDown className="h-4 w-4" />
                <span>Você perde aqui</span>
              </div>
              <ul className="space-y-2 pl-6">
                {losses.map((loss, idx) => (
                  <li key={idx} className="text-sm text-foreground list-disc">
                    {loss.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Prioridades (Top 3) */}
        {criticalGaps.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Prioridades (Top 3)</p>
            </div>
            <div className="space-y-3">
              {criticalGaps.map((gap) => (
                <div key={gap.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-foreground">{gap.title}</p>
                    <div className="flex gap-1">
                      <Badge 
                        variant={gap.impact === 'high' ? 'default' : gap.impact === 'medium' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        Impacto: {gap.impact === 'high' ? 'Alto' : gap.impact === 'medium' ? 'Médio' : 'Baixo'}
                      </Badge>
                      <Badge 
                        variant={gap.effort === 'low' ? 'default' : gap.effort === 'medium' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        Esforço: {gap.effort === 'low' ? 'Baixo' : gap.effort === 'medium' ? 'Médio' : 'Alto'}
                      </Badge>
                      <Badge 
                        variant={gap.confidence === 'high' ? 'default' : gap.confidence === 'medium' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {gap.confidence === 'high' ? 'Alta confiança' : gap.confidence === 'medium' ? 'Média confiança' : 'Baixa confiança'}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{gap.whyItMatters}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
