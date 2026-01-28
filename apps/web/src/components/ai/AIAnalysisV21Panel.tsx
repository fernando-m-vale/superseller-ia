'use client'

import { useState } from 'react'
import { Copy, Check, AlertCircle, TrendingUp, Image as ImageIcon, Tag, Sparkles } from 'lucide-react'
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

  // Proteger contra null/undefined
  const verdict = analysisV21?.verdict
  const actions = analysisV21?.actions ?? []
  const title = analysisV21?.title
  const description = analysisV21?.description
  const images = analysisV21?.images
  const promo = analysisV21?.promo

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

  const getPriorityBadge = (priority: number | undefined) => {
    if (!priority) return null
    if (priority === 1) {
      return <Badge variant="destructive" className="ml-2">Alta Prioridade</Badge>
    } else if (priority === 2) {
      return <Badge variant="default" className="ml-2">Média Prioridade</Badge>
    } else {
      return <Badge variant="secondary" className="ml-2">Baixa Prioridade</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Verdict */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <CardTitle>Diagnóstico</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-semibold mb-2">{verdict?.headline ?? 'Sem veredito'}</h3>
          {verdict?.summary && (
            <p className="text-sm text-muted-foreground">{verdict.summary}</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Ações Recomendadas</CardTitle>
          </div>
          <CardDescription>
            Ações ordenadas por prioridade (1 = mais importante)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ação disponível.</p>
            ) : (
              actions
                .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
                .map((action, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="font-semibold text-sm">Ação {action.priority ?? 'N/A'}</span>
                        {getPriorityBadge(action.priority)}
                      </div>
                      <p className="text-sm">{action.instruction ?? 'Sem instrução'}</p>
                      {action.expectedImpact && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Impacto esperado: {action.expectedImpact}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Before/After */}
                  {(action.before || action.after) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t">
                      {action.before && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Antes:</p>
                          <p className="text-sm bg-muted p-2 rounded">{action.before}</p>
                        </div>
                      )}
                      {action.after && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-muted-foreground">Depois:</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => handleCopy(action.after!, 'Texto sugerido')}
                            >
                              {copiedTexts.has(action.after!) ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm bg-primary/10 p-2 rounded">{action.after}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Title Suggestion */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <CardTitle>Título Sugerido</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {title?.suggested ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm flex-1">{title.suggested}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(title.suggested, 'Título')}
                >
                  {copiedTexts.has(title.suggested) ? (
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
              {title.rationale && (
                <p className="text-xs text-muted-foreground">{title.rationale}</p>
              )}
              {title.keywords && title.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {title.keywords.map((keyword, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Título sugerido não disponível.</p>
          )}
        </CardContent>
      </Card>

      {/* Description Suggestion */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Descrição Sugerida</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {description?.fullText ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(description.fullText!, 'Descrição completa')}
                >
                  {copiedTexts.has(description.fullText!) ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Texto Completo
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                {description.fullText}
              </p>
            </div>
          ) : description?.bullets && description.bullets.length > 0 ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(description.bullets.join('\n'), 'Descrição')}
                >
                  {copiedTexts.has(description.bullets.join('\n')) ? (
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
              <ul className="list-disc list-inside space-y-1 text-sm">
                {description.bullets.map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Descrição sugerida não disponível.</p>
          )}
        </CardContent>
      </Card>

      {/* Images Plan */}
      {images?.plan && images.plan.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <CardTitle>Plano de Imagens</CardTitle>
            </div>
            <CardDescription>
              Sugestões de imagens por slot (ordem de exibição)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {images.plan
                .sort((a, b) => (a.slot ?? 999) - (b.slot ?? 999))
                .map((image, idx) => (
                  <div key={idx} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Slot {image.slot}</Badge>
                      {image.goal && (
                        <Badge variant="secondary" className="text-xs">
                          {image.goal}
                        </Badge>
                      )}
                      {image.purpose && (
                        <Badge variant="outline" className="text-xs">
                          {image.purpose}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium mb-1">{image.description}</p>
                    {image.whatToShow && (
                      <p className="text-xs text-muted-foreground">{image.whatToShow}</p>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Promo */}
      {promo && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <CardTitle>Análise de Promoção</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {promo.priceBase !== undefined && promo.priceFinal !== undefined && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preço Base</p>
                  <p className="text-lg font-semibold">
                    R$ {promo.priceBase.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preço Final</p>
                  <p className="text-lg font-semibold text-primary">
                    R$ {promo.priceFinal.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
            {promo.discount !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Desconto</p>
                <p className="text-lg font-semibold text-green-600">
                  {promo.discount}% OFF
                </p>
              </div>
            )}
            {promo.recommendation && (
              <div className="pt-2 border-t">
                <p className="text-sm">{promo.recommendation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
