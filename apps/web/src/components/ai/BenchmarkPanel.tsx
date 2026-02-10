'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'

interface BenchmarkSummary {
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

interface BenchmarkData {
  benchmarkSummary: BenchmarkSummary
  youWinHere: string[]
  youLoseHere: string[]
  tradeoffs?: string
  recommendations?: string[]
}

interface BenchmarkPanelProps {
  benchmark: BenchmarkData | null
}

export function BenchmarkPanel({ benchmark }: BenchmarkPanelProps) {
  if (!benchmark) {
    return null
  }

  const { benchmarkSummary, youWinHere, youLoseHere, tradeoffs, recommendations } = benchmark

  // Se confidence é unavailable, mostrar mensagem simples
  if (benchmarkSummary.confidence === 'unavailable') {
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
            {benchmarkSummary.notes || 'Comparação indisponível por enquanto. Dados insuficientes para gerar comparação com concorrentes.'}
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
              benchmarkSummary.confidence === 'high' ? 'default' :
              benchmarkSummary.confidence === 'medium' ? 'secondary' :
              'outline'
            }
            className="text-xs"
          >
            {benchmarkSummary.confidence === 'high' ? 'Alta confiança' :
             benchmarkSummary.confidence === 'medium' ? 'Média confiança' :
             'Baixa confiança'}
          </Badge>
        </div>
        {benchmarkSummary.sampleSize > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            Baseado em {benchmarkSummary.sampleSize} anúncios da mesma categoria
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 2 colunas: Você ganha vs Você perde */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Você ganha aqui */}
          {youWinHere.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span>Você ganha aqui</span>
              </div>
              <ul className="space-y-2 pl-6">
                {youWinHere.map((item, idx) => (
                  <li key={idx} className="text-sm text-foreground list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Você perde aqui */}
          {youLoseHere.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-600">
                <TrendingDown className="h-4 w-4" />
                <span>Você perde aqui</span>
              </div>
              <ul className="space-y-2 pl-6">
                {youLoseHere.map((item, idx) => (
                  <li key={idx} className="text-sm text-foreground list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Tradeoffs */}
        {tradeoffs && (
          <div className="pt-4 border-t">
            <p className="text-sm font-semibold mb-2 text-foreground">Você perde aqui / ganha ali</p>
            <p className="text-sm text-muted-foreground">{tradeoffs}</p>
          </div>
        )}

        {/* Recomendações */}
        {recommendations && recommendations.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-semibold mb-3 text-foreground">Ações recomendadas</p>
            <ul className="space-y-2">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
