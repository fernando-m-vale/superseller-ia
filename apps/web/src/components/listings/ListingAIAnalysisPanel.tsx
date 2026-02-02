'use client'

import { useState } from 'react'
import { Copy, Check, AlertCircle, TrendingUp, Image as ImageIcon, Tag, Sparkles, ExternalLink, Target, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type { NormalizedAIAnalysisV21 } from '@/lib/ai/normalizeAiAnalyze'
import { useToast } from '@/hooks/use-toast'
import { buildMercadoLivreListingUrl } from '@/lib/mercadolivre-url'

interface ListingAIAnalysisPanelProps {
  analysisV21: NormalizedAIAnalysisV21
  listingIdExt?: string | null
  listingTitle?: string
  listingPrice?: number
  listingPriceFinal?: number | null
  listingHasPromotion?: boolean | null
  onRegenerate?: () => Promise<void>
  isRegenerating?: boolean
}

export function ListingAIAnalysisPanel({
  analysisV21,
  listingIdExt,
  listingTitle,
  listingPrice,
  listingPriceFinal,
  listingHasPromotion,
  onRegenerate,
  isRegenerating = false,
}: ListingAIAnalysisPanelProps) {
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

  const editUrl = listingIdExt 
    ? buildMercadoLivreListingUrl(listingIdExt, null, 'edit')
    : null

  const handleOpenEdit = () => {
    if (editUrl) {
      window.open(editUrl, '_blank', 'noopener,noreferrer')
    } else {
      toast({
        title: 'Erro',
        description: 'ID do anúncio no Mercado Livre indisponível',
        variant: 'destructive',
        duration: 2000,
      })
    }
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header com resumo e ações */}
      <div className="flex items-start justify-between border-b pb-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{listingTitle || 'Anúncio'}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Preço: R$ {Number(listingPrice ?? 0).toFixed(2)}</span>
            {listingHasPromotion && listingPriceFinal && (
              <span className="text-primary font-medium">
                Promo: R$ {Number(listingPriceFinal).toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenEdit}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir no Mercado Livre (editável)
            </Button>
          )}
          {onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                  Regenerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regerar análise
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 🔥 VEREDITO DIRETO */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">🔥 Veredito Direto</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">🧠 Diagnóstico</p>
            <p className="text-sm">{analysisV21.verdict || 'Veredito não disponível'}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">📉 Impacto</p>
            <p className="text-sm text-muted-foreground">
              Esse veredito indica as alavancas principais que afetam CTR e conversão.
            </p>
          </div>
          {analysisV21.finalActionPlan && analysisV21.finalActionPlan.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">✅ Ações Concretas (Top 3)</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {analysisV21.finalActionPlan.slice(0, 3).map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 1️⃣ TÍTULO — DIAGNÓSTICO + AÇÃO */}
      {analysisV21.titleFix && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">1️⃣ Título — Diagnóstico + Ação</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">🧠 Diagnóstico</p>
              <p className="text-sm">{analysisV21.titleFix.problem}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">📉 Impacto</p>
              <p className="text-sm text-muted-foreground">{analysisV21.titleFix.impact}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">✅ Ações Concretas</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Antes:</p>
                  <Textarea
                    readOnly
                    value={analysisV21.titleFix.before}
                    className="text-sm min-h-[60px]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Depois:</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(analysisV21.titleFix!.after, 'Título')}
                    >
                      {copiedTexts.has(analysisV21.titleFix.after) ? (
                        <>
                          <Check className="h-4 w-4 mr-2 text-green-600" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar título
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    readOnly
                    value={analysisV21.titleFix.after}
                    className="text-sm min-h-[60px] bg-primary/5"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2️⃣ IMAGENS — DIAGNÓSTICO + AÇÃO */}
      {analysisV21.imagePlan && analysisV21.imagePlan.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">2️⃣ Imagens — Diagnóstico + Ação</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">🧠 Diagnóstico</p>
              <p className="text-sm">Sequência de imagens pode melhorar conversão</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">📉 Impacto</p>
              <p className="text-sm text-muted-foreground">Imagens fortes elevam CTR e conversão.</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">✅ Ações Concretas</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                {analysisV21.imagePlan.map((item, idx) => (
                  <li key={idx} className="pl-2">
                    <span className="font-medium">Imagem {item.image}:</span> {item.action}
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3️⃣ DESCRIÇÃO — SEO + CONVERSÃO */}
      {analysisV21.descriptionFix && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">3️⃣ Descrição — SEO + Conversão</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">🧠 Diagnóstico</p>
              <p className="text-sm">{analysisV21.descriptionFix.diagnostic}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">📉 Impacto</p>
              <p className="text-sm text-muted-foreground">
                Descrição estruturada melhora SEO e reduz objeções.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">✅ Ações Concretas</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(analysisV21.descriptionFix!.optimizedCopy, 'Descrição')}
                >
                  {copiedTexts.has(analysisV21.descriptionFix.optimizedCopy) ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar descrição
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                readOnly
                value={analysisV21.descriptionFix.optimizedCopy}
                className="text-sm min-h-[200px] font-mono text-xs bg-muted/50"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4️⃣ PREÇO / PROMOÇÃO — DIAGNÓSTICO + AÇÃO */}
      {analysisV21.priceFix && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">4️⃣ Preço / Promoção — Diagnóstico + Ação</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">🧠 Diagnóstico</p>
              <p className="text-sm">{analysisV21.priceFix.diagnostic}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">📉 Impacto</p>
              <p className="text-sm text-muted-foreground">
                Preço e promo afetam conversão e competitividade.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">✅ Ações Concretas</p>
              <p className="text-sm">{analysisV21.priceFix.action}</p>
              {listingHasPromotion && listingPriceFinal && (
                <Badge variant="secondary" className="mt-2">
                  Promo ativa detectada
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5️⃣ HACKS DE ALGORITMO */}
      {analysisV21.algorithmHacks && analysisV21.algorithmHacks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">5️⃣ Hacks de Algoritmo</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">🧠 Diagnóstico</p>
              <p className="text-sm">Ações rápidas de ganho para aumentar sinais algorítmicos</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">📉 Impacto</p>
              <p className="text-sm text-muted-foreground">
                Pode aumentar sinais algorítmicos (CTR, relevância, conversão).
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">✅ Ações Concretas</p>
              <div className="space-y-3">
                {analysisV21.algorithmHacks.map((hack, idx) => (
                  <Card key={idx} className="bg-muted/30">
                    <CardContent className="pt-4">
                      <p className="font-medium text-sm mb-1">{hack.hack}</p>
                      <p className="text-sm text-muted-foreground mb-2">{hack.howToApply}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Sinal impactado:</span> {hack.signalImpacted}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🧨 PLANO FINAL — AÇÕES PRIORITÁRIAS */}
      {analysisV21.finalActionPlan && analysisV21.finalActionPlan.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">🧨 Plano Final — Ações Prioritárias</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">🧠 Diagnóstico</p>
              <p className="text-sm">Plano priorizado</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">📉 Impacto</p>
              <p className="text-sm text-muted-foreground">
                Executar em ordem tende a maximizar impacto.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">✅ Ações Concretas</p>
              <div className="space-y-2">
                {analysisV21.finalActionPlan.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled
                    />
                    <span className="text-sm">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🎯 RESULTADO ESPERADO */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">🎯 Resultado Esperado</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">🧠 Diagnóstico</p>
            <p className="text-sm">Mais relevância → mais CTR → mais conversão.</p>
          </div>
          {analysisV21.finalActionPlan && analysisV21.finalActionPlan.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">✅ Ação Principal</p>
              <p className="text-sm">{analysisV21.finalActionPlan[0]}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
