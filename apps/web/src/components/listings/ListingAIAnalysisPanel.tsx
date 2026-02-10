'use client'

import { useState } from 'react'
import { Copy, Check, TrendingUp, Image as ImageIcon, Tag, Sparkles, ExternalLink, Target, Zap, Flame, Brain, TrendingDown, CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import type { NormalizedAIAnalysisV21 } from '@/lib/ai/normalizeAiAnalyze'
import { useToast } from '@/hooks/use-toast'
import { buildMercadoLivreListingUrl } from '@/lib/mercadolivre-url'
import { PromotionHighlightPanel, type PromotionPlacementItem } from '@/components/ai/PromotionHighlightPanel'
import { BenchmarkPanel } from '@/components/ai/BenchmarkPanel'

interface ListingAIAnalysisPanelProps {
  analysisV21: NormalizedAIAnalysisV21
  listingIdExt?: string | null
  listingTitle?: string
  listingPrice?: number
  listingPriceBase?: number | null
  listingPriceFinal?: number | null
  listingHasPromotion?: boolean | null
  listingDiscountPercent?: number | null
  benchmark?: {
    benchmarkSummary: {
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
    youWinHere: string[]
    youLoseHere: string[]
    tradeoffs?: string
    recommendations?: string[]
  } | null
  onRegenerate?: () => Promise<void>
  isRegenerating?: boolean
}

export function ListingAIAnalysisPanel({
  analysisV21,
  listingIdExt,
  listingTitle,
  listingPrice,
  listingPriceBase,
  listingPriceFinal,
  listingHasPromotion,
  listingDiscountPercent,
  benchmark,
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

  // Build promotion placement suggestions when promo is active
  const promoPlacements: PromotionPlacementItem[] = (() => {
    if (!listingHasPromotion) return []
    const origPrice = listingPriceBase ?? listingPrice ?? 0
    const finPrice = listingPriceFinal ?? origPrice
    const pct = listingDiscountPercent
      ? `${Math.round(listingDiscountPercent)}%`
      : origPrice > 0
        ? `${Math.round((1 - finPrice / origPrice) * 100)}%`
        : '0%'
    const label = `De R$ ${origPrice.toFixed(2)} por R$ ${finPrice.toFixed(2)}`
    return [
      {
        id: 'promo_cover',
        title: 'Selo de desconto na imagem de capa',
        where: 'Imagem de capa do anuncio',
        how: `Adicionar selo visual simples com '${pct} OFF' ou '${label}'.`,
        constraints: ['Texto curto', 'Alta legibilidade', 'Nao poluir a imagem'],
        exampleText: `${pct} OFF - ${label}`,
      },
      {
        id: 'promo_secondary_image',
        title: 'Banner de promocao na imagem 2 ou 3',
        where: 'Imagem 2 ou 3 do anuncio',
        how: `Criar imagem informativa com o preco promocional (${label}) e destaque visual do desconto.`,
        constraints: ['Nao repetir a capa', 'Fundo limpo', 'Foco no preco e beneficio'],
        exampleText: `Aproveite: ${label} - ${pct} de desconto`,
      },
      {
        id: 'promo_description',
        title: 'Destaque nas primeiras linhas da descricao',
        where: 'Primeiras linhas da descricao do anuncio',
        how: 'Incluir frase sobre a promocao ativa logo no inicio da descricao, antes dos detalhes do produto.',
        constraints: ['Sem emojis', 'Sem markdown', 'Texto simples e direto'],
        exampleText: `Promocao ativa: de R$ ${origPrice.toFixed(2)} por R$ ${finPrice.toFixed(2)} enquanto durar a oferta.`,
      },
      {
        id: 'promo_seo_rule',
        title: 'Regra de SEO - nao usar preco no titulo',
        where: 'Titulo do anuncio',
        how: 'Nao incluir valores monetarios no titulo. O algoritmo do Mercado Livre penaliza titulos com preco. Deixe o destaque de preco para imagens e descricao.',
        constraints: ['Titulo sem cifrao ou valores', 'Manter keywords relevantes', 'Maximo 60 caracteres'],
        exampleText: '',
      },
    ]
  })()

  // Template padronizado para seções
  const SectionTemplate = ({
    icon: Icon,
    title,
    diagnostic,
    impact,
    actions,
  }: {
    icon: React.ElementType
    title: string
    diagnostic: React.ReactNode
    impact: React.ReactNode
    actions: React.ReactNode
  }) => (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Diagnóstico */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Brain className="h-4 w-4 text-primary" />
            <span>🔍 Diagnóstico</span>
          </div>
          <div className="pl-6 text-sm leading-relaxed text-foreground">
            {diagnostic}
          </div>
        </div>

        <Separator />

        {/* Impacto */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingDown className="h-4 w-4 text-orange-500" />
            <span>📉 Impacto</span>
          </div>
          <div className="pl-6 text-sm leading-relaxed text-muted-foreground">
            {impact}
          </div>
        </div>

        <Separator />

        {/* Ações Concretas */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>✅ Ações Concretas</span>
          </div>
          <div className="pl-6">
            {actions}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 p-6 bg-background">
      {/* Header com resumo e ações */}
      <div className="flex items-start justify-between border-b pb-4">
        <div className="space-y-1">
          <h3 className="text-xl font-bold">{listingTitle || 'Anúncio'}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {listingHasPromotion && listingPriceBase && listingPriceFinal ? (
              <>
                <span className="line-through">R$ {Number(listingPriceBase).toFixed(2)}</span>
                <span className="text-primary font-semibold">
                  R$ {Number(listingPriceFinal).toFixed(2)}
                </span>
                {listingDiscountPercent && (
                  <Badge variant="secondary" className="text-xs">
                    -{listingDiscountPercent}%
                  </Badge>
                )}
              </>
            ) : (
              <span>Preço: R$ {Number(listingPrice ?? 0).toFixed(2)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editUrl && (
            <Button
              variant="default"
              size="sm"
              onClick={handleOpenEdit}
              className="bg-primary hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir no Mercado Livre
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

      {/* 🔥 VEREDITO DIRETO — HERO CARD */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/20">
              <Flame className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">🔥 Veredito Direto</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Análise executiva do consultor</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-base leading-relaxed font-medium text-foreground">
            {analysisV21.verdict || 'Veredito não disponível'}
          </div>
          
          {analysisV21.finalActionPlan && analysisV21.finalActionPlan.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-semibold mb-3 text-foreground">Alavancas principais:</p>
              <ul className="space-y-2">
                {analysisV21.finalActionPlan.slice(0, 3).map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 1️⃣ TÍTULO — DIAGNÓSTICO + AÇÃO */}
      {analysisV21.titleFix && (
        <SectionTemplate
          icon={Tag}
          title="1️⃣ Título — Diagnóstico + Ação"
          diagnostic={<p>{analysisV21.titleFix.problem}</p>}
          impact={<p>{analysisV21.titleFix.impact}</p>}
          actions={
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Antes:</p>
                <Textarea
                  readOnly
                  value={analysisV21.titleFix.before}
                  className="text-sm min-h-[60px] bg-muted/50"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Depois (otimizado):</p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleCopy(analysisV21.titleFix!.after, 'Título')}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {copiedTexts.has(analysisV21.titleFix.after) ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-white" />
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
                  className="text-sm min-h-[60px] bg-primary/5 border-2 border-primary/20 font-medium"
                />
              </div>
              {editUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenEdit}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir anúncio para editar título
                </Button>
              )}
            </div>
          }
        />
      )}

      {/* 2️⃣ IMAGENS — DIAGNÓSTICO + AÇÃO */}
      {analysisV21.imagePlan && analysisV21.imagePlan.length > 0 && (
        <SectionTemplate
          icon={ImageIcon}
          title="2️⃣ Imagens — Diagnóstico + Ação"
          diagnostic={<p>Sequência de imagens pode melhorar conversão</p>}
          impact={<p>Imagens fortes elevam CTR e conversão.</p>}
          actions={
            <div className="space-y-3">
              <ol className="space-y-3">
                {analysisV21.imagePlan.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {item.image}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Imagem {item.image}</p>
                      <p className="text-sm text-muted-foreground mt-1">{item.action}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {editUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenEdit}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir anúncio para editar imagens
                </Button>
              )}
            </div>
          }
        />
      )}

      {/* 3️⃣ DESCRIÇÃO — SEO + CONVERSÃO */}
      {analysisV21.descriptionFix && (
        <SectionTemplate
          icon={Sparkles}
          title="3️⃣ Descrição — SEO + Conversão"
          diagnostic={<p>{analysisV21.descriptionFix.diagnostic}</p>}
          impact={<p>Descrição estruturada melhora SEO e reduz objeções.</p>}
          actions={
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Descrição otimizada:</p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleCopy(analysisV21.descriptionFix!.optimizedCopy, 'Descrição')}
                  className="bg-primary hover:bg-primary/90"
                >
                  {copiedTexts.has(analysisV21.descriptionFix.optimizedCopy) ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-white" />
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
                className="text-sm min-h-[250px] font-mono text-xs bg-primary/5 border-2 border-primary/20"
              />
              {editUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenEdit}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir anúncio para editar descrição
                </Button>
              )}
            </div>
          }
        />
      )}

      {/* 4 PRECO / PROMOCAO — BLOCO ACIONAVEL */}
      <PromotionHighlightPanel
        hasPromotion={!!listingHasPromotion}
        originalPrice={listingPriceBase ?? listingPrice}
        finalPrice={listingPriceFinal ?? undefined}
        discountPercent={listingDiscountPercent}
        placements={promoPlacements}
      />

      {/* 5️⃣ COMPARAÇÃO COM CONCORRENTES — BENCHMARK */}
      {benchmark && <BenchmarkPanel benchmark={benchmark} />}

      {/* Diagnostico de preco da IA (complementar) */}
      {analysisV21.priceFix && (
        <SectionTemplate
          icon={Tag}
          title="Preco — Diagnostico + Acao"
          diagnostic={<p>{analysisV21.priceFix.diagnostic}</p>}
          impact={<p>Preco e promo afetam conversao e competitividade.</p>}
          actions={
            <div className="space-y-3">
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-foreground">{analysisV21.priceFix.action}</p>
              </div>
              {editUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenEdit}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir anuncio para editar preco
                </Button>
              )}
            </div>
          }
        />
      )}

      {/* 5️⃣ HACKS DE ALGORITMO — FORMATO EXECUTIVO */}
      {analysisV21.algorithmHacks && analysisV21.algorithmHacks.length > 0 && (
        <SectionTemplate
          icon={Zap}
          title="5️⃣ Hacks de Algoritmo"
          diagnostic={<p>Ações rápidas de ganho para aumentar sinais algorítmicos</p>}
          impact={<p>Pode aumentar sinais algorítmicos (CTR, relevância, conversão).</p>}
          actions={
            <div className="space-y-4">
              {analysisV21.algorithmHacks.map((hack, idx) => (
                <Card key={idx} className="bg-gradient-to-r from-primary/5 to-primary/10 border-l-4 border-l-primary">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-base text-foreground mb-1">{hack.hack}</h4>
                        <p className="text-sm text-muted-foreground">{hack.howToApply}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Impacta: {hack.signalImpacted}
                        </Badge>
                      </div>
                      {editUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenEdit}
                          className="mt-2"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Abrir anúncio para aplicar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          }
        />
      )}

      {/* 🧨 PLANO FINAL — AÇÕES PRIORITÁRIAS (CHECKLIST VISUAL) */}
      {analysisV21.finalActionPlan && analysisV21.finalActionPlan.length > 0 && (
        <SectionTemplate
          icon={Target}
          title="🧨 Plano Final — Ações Prioritárias"
          diagnostic={<p>Plano priorizado para execução</p>}
          impact={<p>Executar em ordem tende a maximizar impacto.</p>}
          actions={
            <div className="space-y-3">
              {analysisV21.finalActionPlan.map((action, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-5 h-5 rounded border-2 border-primary flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary opacity-0" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{action}</p>
                  </div>
                </div>
              ))}
            </div>
          }
        />
      )}

      {/* 🎯 RESULTADO ESPERADO — DESTAQUE VISUAL */}
      <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-500/20">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-green-900 dark:text-green-100">🎯 Resultado Esperado</CardTitle>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">Impacto projetado</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold text-green-900 dark:text-green-100 mb-4">
            Mais relevância → mais CTR → mais conversão.
          </div>
          {analysisV21.finalActionPlan && analysisV21.finalActionPlan.length > 0 && (
            <div className="pt-4 border-t border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Ação principal:</p>
              <p className="text-sm text-green-700 dark:text-green-300">{analysisV21.finalActionPlan[0]}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
