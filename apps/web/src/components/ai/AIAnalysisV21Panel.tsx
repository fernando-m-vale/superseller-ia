'use client'

import { useState } from 'react'
import { Copy, Check, AlertCircle, TrendingUp, Image as ImageIcon, Tag, Sparkles, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { NormalizedAIAnalysisV21 } from '@/lib/ai/normalizeAiAnalyze'
import { useToast } from '@/hooks/use-toast'
import { buildMercadoLivreListingUrl } from '@/lib/mercadolivre-url'

interface AIAnalysisV21PanelProps {
  analysisV21: NormalizedAIAnalysisV21
  listingIdExt?: string | null // ID externo do marketplace (ex: MLB3923303743) para construir deeplink
  actionPlan?: Array<{
    id: string
    type: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    title: string
    description: string
    impact?: {
      metric: string
      estimatedGain: string
      confidence?: string
    }
    howTo?: string[]
    mlDeeplink?: string
  }>
  seoSuggestions?: {
    suggestedTitle?: string
    suggestedDescriptionPoints?: string[]
  }
}

export function AIAnalysisV21Panel({ 
  analysisV21, 
  listingIdExt,
  actionPlan = [],
  seoSuggestions,
}: AIAnalysisV21PanelProps) {
  const { toast } = useToast()
  const [copiedTexts, setCopiedTexts] = useState<Set<string>>(new Set())

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedTexts(prev => new Set(prev).add(text))
      toast({
        title: 'Copiado!',
        description: `${label} copiado para a área de transferência`,
        duration: 2000,
      })
      // Resetar após 2 segundos
      setTimeout(() => {
        setCopiedTexts(prev => {
          const newSet = new Set(prev)
          newSet.delete(text)
          return newSet
        })
      }, 2000)
    } catch (error) {
      console.error('Erro ao copiar:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o texto',
        variant: 'destructive',
        duration: 2000,
      })
    }
  }

  const getPriorityBadge = (priority: 'critical' | 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive" className="ml-2">Crítico</Badge>
      case 'high':
        return <Badge variant="default" className="ml-2">Alta</Badge>
      case 'medium':
        return <Badge variant="secondary" className="ml-2">Média</Badge>
      case 'low':
        return <Badge variant="outline" className="ml-2">Baixa</Badge>
      default:
        return null
    }
  }


  // Ordenar ações por prioridade: critical > high > medium > low
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sortedActions = (actionPlan && actionPlan.length > 0)
    ? [...actionPlan].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    : []

  // Título sugerido: usar titleFix.after ou fallback para seoSuggestions
  const suggestedTitle = analysisV21.titleFix?.after || seoSuggestions?.suggestedTitle || ''
  
  // Descrição sugerida: usar descriptionFix.optimizedCopy
  const suggestedDescription = analysisV21.descriptionFix?.optimizedCopy || ''

  return (
    <div className="space-y-6">
      {/* Diagnóstico */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <CardTitle>Diagnóstico</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Verdict (análise crítica) */}
          {analysisV21.verdict ? (
            <div>
              <p className="text-sm font-medium mb-1">Análise crítica:</p>
              <p className="text-sm">{analysisV21.verdict}</p>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Análise crítica não disponível.
            </div>
          )}

          {/* Title Fix diagnostic */}
          {analysisV21.titleFix?.problem && (
            <div>
              <p className="text-sm font-medium mb-1">Problema no título:</p>
              <p className="text-sm text-muted-foreground">{analysisV21.titleFix.problem}</p>
              {analysisV21.titleFix.impact && (
                <p className="text-xs text-muted-foreground mt-1">
                  Impacto: {analysisV21.titleFix.impact}
                </p>
              )}
            </div>
          )}

          {/* Description Fix diagnostic */}
          {analysisV21.descriptionFix?.diagnostic && (
            <div>
              <p className="text-sm font-medium mb-1">Problema na descrição:</p>
              <p className="text-sm text-muted-foreground">{analysisV21.descriptionFix.diagnostic}</p>
            </div>
          )}

          {/* Price Fix diagnostic */}
          {analysisV21.priceFix?.diagnostic && (
            <div>
              <p className="text-sm font-medium mb-1">Análise de preço:</p>
              <p className="text-sm text-muted-foreground">{analysisV21.priceFix.diagnostic}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações Recomendadas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Ações Recomendadas</CardTitle>
          </div>
          <CardDescription>
            Ações ordenadas por prioridade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedActions.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Nenhuma ação recomendada foi gerada para este anúncio.</p>
                <p className="text-xs">Isso pode ocorrer quando o anúncio já está bem otimizado ou quando há limitações nos dados disponíveis.</p>
              </div>
            ) : (
              sortedActions.map((action, index) => (
                <div key={action.id || index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="font-semibold text-sm">{action.title}</span>
                        {getPriorityBadge(action.priority)}
                      </div>
                      <p className="text-sm">{action.description}</p>
                      
                      {action.impact && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Métrica:</span> {action.impact.metric}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Ganho estimado:</span> {action.impact.estimatedGain}
                            {action.impact.confidence && (
                              <span className="ml-1">(confiança: {action.impact.confidence})</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* How to */}
                  {action.howTo && action.howTo.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Como fazer:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {action.howTo.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ML Deeplink */}
                  {(action.mlDeeplink || listingIdExt) && (() => {
                    // Priorizar mlDeeplink do backend, fallback para construção local
                    const deeplinkUrl = action.mlDeeplink 
                      || (listingIdExt ? buildMercadoLivreListingUrl(listingIdExt, null, 'view') : null)
                    
                    if (!deeplinkUrl) return null
                    
                    return (
                      <div className="mt-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(deeplinkUrl, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Abrir no Mercado Livre
                        </Button>
                      </div>
                    )
                  })()}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Título Sugerido */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <CardTitle>Título Sugerido</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestedTitle ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{suggestedTitle}</p>
                  {analysisV21.titleFix?.problem && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Problema: {analysisV21.titleFix.problem}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(suggestedTitle, 'Título')}
                >
                  {copiedTexts.has(suggestedTitle) ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>

              {analysisV21.titleFix?.before && (
                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Título atual:</p>
                  <p className="text-sm">{analysisV21.titleFix.before}</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Nenhuma sugestão de título foi gerada para este anúncio.</p>
              <p className="text-xs">Isso pode ocorrer quando o título atual já está otimizado ou quando há limitações nos dados disponíveis.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Descrição Sugerida */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Descrição Sugerida</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestedDescription ? (
            <>
              <div className="max-h-96 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">{suggestedDescription}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(suggestedDescription, 'Descrição')}
                className="w-full"
              >
                {copiedTexts.has(suggestedDescription) ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar descrição completa
                  </>
                )}
              </Button>
              {analysisV21.descriptionFix?.diagnostic && (
                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Diagnóstico:</p>
                  <p className="text-xs text-muted-foreground">{analysisV21.descriptionFix.diagnostic}</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Descrição sugerida não disponível na análise atual.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preço/Promoção */}
      {analysisV21.priceFix && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <CardTitle>Análise de Preço</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysisV21.priceFix.diagnostic && (
              <div>
                <p className="text-sm font-medium mb-1">Diagnóstico:</p>
                <p className="text-sm text-muted-foreground">{analysisV21.priceFix.diagnostic}</p>
              </div>
            )}

            {analysisV21.priceFix.action && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-1">Ação recomendada:</p>
                <p className="text-sm">{analysisV21.priceFix.action}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plano de Imagens */}
      {analysisV21.imagePlan && analysisV21.imagePlan.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <CardTitle>Plano de Imagens</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysisV21.imagePlan.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3">
                  <p className="text-sm font-medium mb-1">Imagem {item.image}:</p>
                  <p className="text-sm text-muted-foreground">{item.action}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hacks Algorítmicos */}
      {analysisV21.algorithmHacks && analysisV21.algorithmHacks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>Hacks Algorítmicos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysisV21.algorithmHacks.map((hack, idx) => (
                <div key={idx} className="border rounded-lg p-3">
                  <p className="text-sm font-medium mb-1">{hack.hack}</p>
                  <p className="text-sm text-muted-foreground mb-2">{hack.howToApply}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Sinal impactado:</span> {hack.signalImpacted}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
