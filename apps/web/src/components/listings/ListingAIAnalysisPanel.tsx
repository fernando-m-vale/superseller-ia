'use client'

import React, { useState } from 'react'
import { Copy, Check, TrendingUp, Image as ImageIcon, Tag, Sparkles, ExternalLink, Zap, Flame, Brain, TrendingDown, CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import type { NormalizedAIAnalysisV21, NormalizedBenchmarkInsights, GeneratedContent } from '@/lib/ai/normalizeAiAnalyze'
import { useToast } from '@/hooks/use-toast'
import { buildMercadoLivreListingUrl } from '@/lib/mercadolivre-url'
import { BenchmarkPanel } from '@/components/ai/BenchmarkPanel'
import { BenchmarkInsightsPanel } from '@/components/ai/BenchmarkInsightsPanel'
import { ApplyActionModal } from '@/components/ai/ApplyActionModal'
import { useApplyAction, type ActionType } from '@/hooks/use-apply-action'
import { ActionPlanChecklist } from '@/components/ai/ActionPlanChecklist'

// Template padronizado para seções
type SectionTemplateProps = {
  icon: React.ElementType
  title: string | React.ReactNode
  diagnostic: React.ReactNode
  impact: React.ReactNode
  actions: React.ReactNode
}

const SectionTemplate = ({
  icon: Icon,
  title,
  diagnostic,
  impact,
  actions,
}: SectionTemplateProps) => {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg">{typeof title === 'string' ? title : title}</CardTitle>
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
  );
};

interface ListingAIAnalysisPanelProps {
  analysisV21: NormalizedAIAnalysisV21
  listingId?: string
  listingIdExt?: string | null
  listingTitle?: string
  listingPrice?: number
  listingPriceBase?: number | null
  listingPriceFinal?: number | null
  listingHasPromotion?: boolean | null
  listingDiscountPercent?: number | null
  pricingNormalized?: {
    originalPriceForDisplay: number
    finalPriceForDisplay: number
    hasPromotion: boolean
  }
  appliedActions?: Array<{
    actionType: string
    appliedAt: string
  }>
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
  benchmarkInsights?: NormalizedBenchmarkInsights | null
  generatedContent?: GeneratedContent | null
  onRegenerate?: () => Promise<void>
  isRegenerating?: boolean
}

export function ListingAIAnalysisPanel({
  analysisV21,
  listingId,
  listingIdExt,
  listingTitle,
  listingPrice,
  listingDiscountPercent,
  pricingNormalized,
  appliedActions = [],
  benchmark,
  benchmarkInsights,
  onRegenerate,
  isRegenerating = false,
}: ListingAIAnalysisPanelProps) {
  const { toast } = useToast()
  const [copiedTexts, setCopiedTexts] = useState<Set<string>>(new Set())
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [applyModalActionType, setApplyModalActionType] = useState<ActionType>('seo_title')
  const [applyModalBefore, setApplyModalBefore] = useState<string | React.ReactNode>('')
  const [applyModalAfter, setApplyModalAfter] = useState<string | React.ReactNode>('')
  
  const { applyAction, isLoading: isApplyingAction } = useApplyAction(listingId || null)

  // DIA 06.1: Verificar se ação já foi aplicada (com compatibilidade)
  const isActionApplied = (actionType: string) => {
    // Verificar ação específica
    if (appliedActions.some(action => action.actionType === actionType)) {
      return true;
    }
    
    // Compatibilidade: se procurar "seo", verificar "seo_title" ou "seo_description"
    if (actionType === 'seo') {
      return appliedActions.some(action => 
        action.actionType === 'seo_title' || action.actionType === 'seo_description'
      );
    }
    
    // Compatibilidade: se procurar "midia", verificar "media_images"
    if (actionType === 'midia') {
      return appliedActions.some(action => action.actionType === 'media_images');
    }
    
    return false;
  }

  const handleOpenApplyModal = (
    actionType: ActionType,
    before: string | React.ReactNode,
    after: string | React.ReactNode
  ) => {
    setApplyModalActionType(actionType)
    setApplyModalBefore(before)
    setApplyModalAfter(after)
    setApplyModalOpen(true)
  }

  const handleConfirmApply = async () => {
    if (!listingId) {
      toast({
        title: 'Erro',
        description: 'ID do anúncio não disponível',
        variant: 'destructive',
      })
      return
    }

    try {
      // DIA 06.2: Construir payloads corretos baseados no actionType
      let beforePayload: Record<string, unknown> = {}
      let afterPayload: Record<string, unknown> = {}

      if (applyModalActionType === 'seo_title') {
        beforePayload = { title: typeof applyModalBefore === 'string' ? applyModalBefore : String(applyModalBefore) }
        afterPayload = { title: typeof applyModalAfter === 'string' ? applyModalAfter : String(applyModalAfter) }
      } else if (applyModalActionType === 'seo_description') {
        beforePayload = { description: typeof applyModalBefore === 'string' ? applyModalBefore : String(applyModalBefore) }
        afterPayload = { description: typeof applyModalAfter === 'string' ? applyModalAfter : String(applyModalAfter) }
      } else if (applyModalActionType === 'media_images') {
        beforePayload = { plan: typeof applyModalBefore === 'string' ? applyModalBefore : null }
        afterPayload = { plan: typeof applyModalAfter === 'string' ? applyModalAfter : String(applyModalAfter) }
      } else {
        // Fallback para outros tipos
        beforePayload = typeof applyModalBefore === 'string' 
          ? { value: applyModalBefore }
          : { type: 'react_node' }
        afterPayload = typeof applyModalAfter === 'string'
          ? { value: applyModalAfter }
          : { type: 'react_node' }
      }

      await applyAction({
        actionType: applyModalActionType,
        beforePayload,
        afterPayload,
      })

      toast({
        title: 'Sucesso!',
        description: 'Ação registrada com sucesso',
        duration: 2000,
      })

      // Recarregar análise para atualizar appliedActions
      if (onRegenerate) {
        await onRegenerate()
      }
    } catch (error) {
      // DIA 06.2: Toast já mostra mensagem detalhada do hook
      toast({
        title: 'Erro ao registrar ação',
        description: error instanceof Error ? error.message : 'Erro desconhecido ao registrar ação',
        variant: 'destructive',
        duration: 5000, // Mais tempo para ler mensagem detalhada
      })
      throw error
    }
  }

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

  // DIA 06.1: promoPlacements removido (não mais usado após remoção do PromotionHighlightPanel)

  return (
    <div className="space-y-6 p-6 bg-background">
      {/* Header com resumo e ações */}
      <div className="flex items-start justify-between border-b pb-4">
        <div className="space-y-1">
          <h3 className="text-xl font-bold">{listingTitle || 'Anúncio'}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {/* DIA 06.2: Usar pricingNormalized como fonte única de verdade */}
            {pricingNormalized?.hasPromotion ? (
              <>
                <span className="line-through">R$ {pricingNormalized.originalPriceForDisplay.toFixed(2)}</span>
                <span className="text-primary font-semibold">
                  R$ {pricingNormalized.finalPriceForDisplay.toFixed(2)}
                </span>
                {listingDiscountPercent && (
                  <Badge variant="secondary" className="text-xs">
                    -{listingDiscountPercent}%
                  </Badge>
                )}
              </>
            ) : (
              <span>Preço: R$ {(pricingNormalized?.finalPriceForDisplay ?? listingPrice ?? 0).toFixed(2)}</span>
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
        <div id="section-title">
          <SectionTemplate
            icon={Tag}
            title={
              <div className="flex items-center justify-between w-full">
                <span>1️⃣ Título — Diagnóstico + Ação</span>
                {isActionApplied('seo_title') && (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Implementado
                  </Badge>
                )}
              </div>
            }
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
                    <div className="flex items-center gap-2">
                      {!isActionApplied('seo_title') && analysisV21.titleFix && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenApplyModal(
                            'seo_title',
                            analysisV21.titleFix!.before,
                            analysisV21.titleFix!.after
                          )}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Registrar como aplicado
                        </Button>
                      )}
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
        </div>
      )}

      {/* 2️⃣ IMAGENS — DIAGNÓSTICO + AÇÃO */}
      {analysisV21.imagePlan && analysisV21.imagePlan.length > 0 && (
        <div id="section-images">
          <SectionTemplate
            icon={ImageIcon}
            title={
              <div className="flex items-center justify-between w-full">
                <span>2️⃣ Imagens — Diagnóstico + Ação</span>
                {isActionApplied('media_images') && (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Implementado
                  </Badge>
                )}
              </div>
            }
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
              <div className="flex items-center gap-2">
                {!isActionApplied('media_images') && analysisV21.imagePlan && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenApplyModal(
                      'media_images',
                      'Plano de imagens atual',
                      analysisV21.imagePlan!.map(item => `Imagem ${item.image}: ${item.action}`).join('\n')
                    )}
                    className="flex-1"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Registrar como aplicado
                  </Button>
                )}
                {editUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenEdit}
                    className={isActionApplied('media_images') ? 'w-full' : 'flex-1'}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir anúncio para editar imagens
                  </Button>
                )}
              </div>
            </div>
          }
        />
        </div>
      )}

      {/* 3️⃣ DESCRIÇÃO — SEO + CONVERSÃO */}
      {analysisV21.descriptionFix && (
        <SectionTemplate
          icon={Sparkles}
          title={
            <div className="flex items-center justify-between w-full">
              <span>3️⃣ Descrição — SEO + Conversão</span>
              {isActionApplied('seo_title') && (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Implementado
                </Badge>
              )}
            </div>
          }
          diagnostic={<p>{analysisV21.descriptionFix.diagnostic}</p>}
          impact={<p>Descrição estruturada melhora SEO e reduz objeções.</p>}
          actions={
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Descrição otimizada:</p>
                <div className="flex items-center gap-2">
                  {!isActionApplied('seo_description') && analysisV21.descriptionFix && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenApplyModal(
                        'seo_description',
                        listingTitle || 'Descrição atual não disponível',
                        analysisV21.descriptionFix!.optimizedCopy
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Aplicar Sugestão
                    </Button>
                  )}
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

      {/* DIA 06.1: Removido bloco Preço/Promoção (duplicação) - promo já está incorporado nas seções */}
      
      {/* 5️⃣ COMPARAÇÃO COM CONCORRENTES — BENCHMARK INSIGHTS (Dia 05) */}
      {benchmarkInsights && <BenchmarkInsightsPanel benchmarkInsights={benchmarkInsights} />}

      {/* DIA 06.1: Conteúdo Gerado removido como bloco separado - será incorporado nas seções */}

      {/* COMPARAÇÃO COM CONCORRENTES — BENCHMARK (legado, mantido para compatibilidade) */}
      {benchmark && !benchmarkInsights && <BenchmarkPanel benchmark={benchmark} />}

      {/* Modal de Aplicar Sugestão */}
      <ApplyActionModal
        open={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        onConfirm={handleConfirmApply}
        actionType={applyModalActionType}
        beforeValue={applyModalBefore}
        afterValue={applyModalAfter}
        isLoading={isApplyingAction}
      />

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

      {/* 📋 PLANO DE EXECUÇÃO — CHECKLIST COM STATUS (DIA 06.1) */}
      {analysisV21.finalActionPlan && analysisV21.finalActionPlan.length > 0 && (
        <ActionPlanChecklist
          items={analysisV21.finalActionPlan.slice(0, 8).map((action, idx) => {
            // Mapear ações para actionTypes baseado no conteúdo
            let actionType: ActionType | null = null
            let sectionId: string | undefined
            
            const actionLower = action.toLowerCase()
            
            if (actionLower.includes('título') || actionLower.includes('titulo') || actionLower.includes('title')) {
              actionType = 'seo_title'
              sectionId = 'section-title'
            } else if (actionLower.includes('descrição') || actionLower.includes('descricao') || actionLower.includes('description')) {
              actionType = 'seo_description'
              sectionId = 'section-description'
            } else if (actionLower.includes('imagem') || actionLower.includes('imagens') || actionLower.includes('image')) {
              actionType = 'media_images'
              sectionId = 'section-images'
            } else if (actionLower.includes('selo') || actionLower.includes('capa')) {
              actionType = 'promo_cover_badge'
            } else if (actionLower.includes('banner')) {
              actionType = 'promo_banner'
            }
            
            return {
              id: `action-${idx}`,
              title: action,
              actionType,
              sectionId,
              mlDeeplink: editUrl || undefined,
            }
          })}
          appliedActions={appliedActions}
          onApplyAction={(actionType, before, after) => {
            handleOpenApplyModal(actionType, before, after)
          }}
          onScrollToSection={(sectionId) => {
            // Scroll para a seção correspondente
            const element = document.getElementById(sectionId)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' })
              // Highlight visual temporário
              element.classList.add('ring-2', 'ring-primary', 'ring-offset-2')
              setTimeout(() => {
                element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2')
              }, 2000)
            }
          }}
          editUrl={editUrl}
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
