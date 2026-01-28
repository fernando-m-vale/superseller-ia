'use client'

import { useState } from 'react'
import { Copy, Check, AlertCircle, TrendingUp, Image as ImageIcon, Tag, Sparkles, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AIAnalysisResultV21 } from '@/types/ai-analysis-v21'
import { useToast } from '@/hooks/use-toast'

interface AIAnalysisV21PanelProps {
  analysisV21: AIAnalysisResultV21
}

export function AIAnalysisV21Panel({ analysisV21 }: AIAnalysisV21PanelProps) {
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

  const getHealthBadge = (health: 'critical' | 'needs_attention' | 'good' | 'excellent') => {
    switch (health) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>
      case 'needs_attention':
        return <Badge variant="default">Atenção</Badge>
      case 'good':
        return <Badge variant="secondary">Bom</Badge>
      case 'excellent':
        return <Badge className="bg-green-600">Excelente</Badge>
      default:
        return null
    }
  }

  // Ordenar ações por prioridade: critical > high > medium > low
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sortedActions = [...(analysisV21.actions || [])].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  // Montar descrição completa a partir de suggested_structure
  const fullDescription = analysisV21.description_analysis?.suggested_structure
    ?.map(s => `${s.section}\n\n${s.content}`)
    .join('\n\n') || ''

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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Saúde geral:</span>
            {getHealthBadge(analysisV21.diagnostic?.overall_health || 'needs_attention')}
          </div>
          
          {analysisV21.diagnostic?.main_bottleneck && (
            <div>
              <p className="text-sm font-medium mb-1">Principal gargalo:</p>
              <p className="text-sm text-muted-foreground">{analysisV21.diagnostic.main_bottleneck}</p>
            </div>
          )}

          {analysisV21.critique && (
            <div>
              <p className="text-sm font-medium mb-1">Análise crítica:</p>
              <p className="text-sm">{analysisV21.critique}</p>
            </div>
          )}

          {analysisV21.diagnostic?.quick_wins && analysisV21.diagnostic.quick_wins.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">Vitórias rápidas:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {analysisV21.diagnostic.quick_wins.map((win, idx) => (
                  <li key={idx}>{win}</li>
                ))}
              </ul>
            </div>
          )}

          {analysisV21.diagnostic?.long_term && analysisV21.diagnostic.long_term.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">Melhorias de longo prazo:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {analysisV21.diagnostic.long_term.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
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
              <p className="text-sm text-muted-foreground">Nenhuma ação disponível.</p>
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
                            <span className="font-medium">Ganho estimado:</span> {action.impact.estimated_gain}
                            {action.impact.confidence && (
                              <span className="ml-1">(confiança: {action.impact.confidence})</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* How to */}
                  {action.how_to && action.how_to.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Como fazer:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {action.how_to.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ML Deeplink */}
                  {action.ml_deeplink && (
                    <div className="mt-3 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(action.ml_deeplink, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir no Mercado Livre
                      </Button>
                    </div>
                  )}
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
          {analysisV21.title_analysis?.suggestions && analysisV21.title_analysis.suggestions.length > 0 ? (
            <>
              <div className="space-y-3">
                {analysisV21.title_analysis.suggestions.map((suggestion, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">{suggestion.text}</p>
                        {suggestion.focus && (
                          <Badge variant="outline" className="text-xs mr-2">
                            {suggestion.focus === 'seo' ? 'SEO' : suggestion.focus === 'conversion' ? 'Conversão' : 'Promoção'}
                          </Badge>
                        )}
                        {suggestion.rationale && (
                          <p className="text-xs text-muted-foreground mt-1">{suggestion.rationale}</p>
                        )}
                      </div>
                      {idx === 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(suggestion.text, 'Título')}
                        >
                          {copiedTexts.has(suggestion.text) ? (
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
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {analysisV21.title_analysis.current && (
                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Título atual:</p>
                  <p className="text-sm">{analysisV21.title_analysis.current}</p>
                </div>
              )}

              {analysisV21.title_analysis.keywords && (
                <div className="pt-3 border-t space-y-2">
                  {analysisV21.title_analysis.keywords.present && analysisV21.title_analysis.keywords.present.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Palavras-chave presentes:</p>
                      <div className="flex flex-wrap gap-1">
                        {analysisV21.title_analysis.keywords.present.map((keyword, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysisV21.title_analysis.keywords.recommended && analysisV21.title_analysis.keywords.recommended.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Palavras-chave recomendadas:</p>
                      <div className="flex flex-wrap gap-1">
                        {analysisV21.title_analysis.keywords.recommended.map((keyword, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Título sugerido não disponível.</p>
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
          {fullDescription ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(fullDescription, 'Descrição completa')}
                >
                  {copiedTexts.has(fullDescription) ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Descrição Completa
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                {fullDescription}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Descrição sugerida não disponível.</p>
          )}

          {analysisV21.description_analysis && (
            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Comprimento atual: {analysisV21.description_analysis.current_length} caracteres</span>
                <span>Score: {analysisV21.description_analysis.score}/100</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preço/Promoção */}
      {analysisV21.price_analysis && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <CardTitle>Análise de Preço</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Preço Base</p>
                <p className="text-lg font-semibold">
                  R$ {analysisV21.price_analysis.price_base.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Preço Final</p>
                <p className="text-lg font-semibold text-primary">
                  R$ {analysisV21.price_analysis.price_final.toFixed(2)}
                </p>
              </div>
            </div>

            {analysisV21.price_analysis.has_promotion && analysisV21.price_analysis.discount_percent !== null && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Desconto</p>
                <p className="text-lg font-semibold text-green-600">
                  {analysisV21.price_analysis.discount_percent}% OFF
                </p>
              </div>
            )}

            {analysisV21.price_analysis.analysis && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-1">Análise:</p>
                <p className="text-sm text-muted-foreground">{analysisV21.price_analysis.analysis}</p>
              </div>
            )}

            {analysisV21.price_analysis.recommendation && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-1">Recomendação:</p>
                <p className="text-sm">{analysisV21.price_analysis.recommendation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mídia */}
      {analysisV21.media_analysis && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <CardTitle>Análise de Mídia</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysisV21.media_analysis.photos && (
              <div>
                <p className="text-sm font-medium mb-1">Fotos</p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">Quantidade: {analysisV21.media_analysis.photos.count}</span>
                  <span className="text-sm text-muted-foreground">Score: {analysisV21.media_analysis.photos.score}/100</span>
                  {analysisV21.media_analysis.photos.is_sufficient ? (
                    <Badge variant="secondary" className="text-xs">Suficiente</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Insuficiente</Badge>
                  )}
                </div>
                {analysisV21.media_analysis.photos.issues && analysisV21.media_analysis.photos.issues.length > 0 && (
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {analysisV21.media_analysis.photos.issues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {analysisV21.media_analysis.video && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-1">Vídeo</p>
                <p className="text-sm text-muted-foreground">{analysisV21.media_analysis.video.status_message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
