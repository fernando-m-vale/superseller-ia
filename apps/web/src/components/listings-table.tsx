'use client'

import { useState, useEffect } from 'react'
import { useListings, type ListingsFilters } from '@/hooks/use-listings'
import { useRecommendations, type Recommendation } from '@/hooks/use-recommendations'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Loader2, Search, AlertCircle, AlertTriangle, CheckCircle2, Lightbulb, Sparkles, Copy, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
// Removido: applyRecommendation não é mais necessário (aba Recomendações removida)
import { useAIAnalyze } from '@/hooks/use-ai-analyze'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AIAnalysisResponse } from '@/hooks/use-ai-analyze'
import { ScoreBreakdown } from '@/components/ai/ScoreBreakdown'
import { ScoreExplanation } from '@/components/ai/ScoreExplanation'
import { ActionPlan } from '@/components/ai/ActionPlan'
import { PerformanceUnavailableModal } from '@/components/ai/PerformanceUnavailableModal'

// Componente da aba de Análise IA
function AIAnalysisTab({
  analysis,
  isLoading,
  error,
  onAnalyze,
  onForceRefresh,
  currentTitle,
  copiedText,
  onCopy,
  hasVideo,
  marketplace,
  listingIdExt,
  listingId,
}: {
  analysis: AIAnalysisResponse | null
  isLoading: boolean
  error: string | null
  onAnalyze: () => Promise<void>
  onForceRefresh: () => Promise<void>
  currentTitle: string
  copiedText: string | null
  onCopy: (text: string) => void
  hasVideo?: boolean | null
  marketplace?: 'shopee' | 'mercadolivre'
  listingIdExt?: string
  listingId?: string
}) {
  const loadingMessages = [
    'Analisando concorrentes...',
    'Verificando fotos e qualidade...',
    'Otimizando copy e SEO...',
    'Gerando insights personalizados...',
  ]
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false)

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [isLoading])

  // Estado inicial - sem análise
  if (!analysis && !isLoading && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Sparkles className="h-16 w-16 text-primary mb-4 opacity-50" />
        <h3 className="text-xl font-semibold mb-2">Análise Completa com IA</h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          Descubra hacks de crescimento e melhore seu SEO com nossa inteligência artificial.
        </p>
        <Button
          onClick={onAnalyze}
          size="lg"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Gerar Análise Completa
        </Button>
      </div>
    )
  }

  // Estado de carregamento
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground animate-pulse">
            {loadingMessages[currentMessageIndex]}
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  // Estado de erro
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Erro ao gerar análise</h3>
        <p className="text-muted-foreground mb-2 max-w-md">
          {String(error || 'Erro desconhecido')}
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Se o problema persistir, entre em contato com o suporte.
        </p>
        <Button 
          onClick={async () => {
            try {
              await onAnalyze()
            } catch {
              // Erro já foi tratado no hook, apenas logar para debugging
              // Log erro sem detalhes sensíveis
              console.error('[AI-ANALYZE] Erro ao tentar novamente')
            }
          }} 
          variant="outline"
          className="min-w-[140px]"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  // Estado com análise
  if (!analysis) return null


  return (
    <div className="space-y-6">
      {/* Cache Status Banner */}
      {analysis.cacheHit && (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>Análise atual (cache)</span>
            {analysis.analyzedAt && (
              <span className="text-blue-500 dark:text-blue-400 text-xs">
                - Gerada em {new Date(analysis.analyzedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await onForceRefresh()
              } catch {
                console.error('[AI-ANALYZE] Erro ao atualizar análise')
              }
            }}
            disabled={isLoading}
            className="text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/20"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Atualizar análise
          </Button>
        </div>
      )}

      {/* IA Score V2 - Onda 2: Score Breakdown */}
      <ScoreBreakdown
        score={analysis.score}
        scoreBreakdown={analysis.scoreBreakdown}
        dataQuality={analysis.dataQuality}
      />

      {/* Performance Indisponível - Aviso Neutro */}
      {analysis.dataQuality?.performanceAvailable === false && (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-sm">
              <AlertCircle className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-foreground font-medium">
                  Dados de performance indisponíveis via API do Mercado Livre.
                </p>
                <p className="text-muted-foreground text-xs">
                  A dimensão de Performance não pôde ser avaliada por indisponibilidade de dados via API.
                </p>
                <button
                  type="button"
                  onClick={() => setPerformanceModalOpen(true)}
                  className="text-xs text-primary hover:underline mt-2 inline-block cursor-pointer"
                >
                  Entenda por quê
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* IA Score V2 - Onda 2: Score Explanation */}
      <ScoreExplanation
        scoreExplanation={analysis.scoreExplanation}
        scoreBreakdown={analysis.scoreBreakdown}
      />

      {/* IA Score V2 - Onda 2: Action Plan */}
      <ActionPlan 
        actionPlan={analysis.actionPlan}
        listingId={listingId}
        listingTitle={currentTitle}
        seoSuggestions={analysis.seoSuggestions}
        marketplace={marketplace}
        listingIdExt={listingIdExt}
      />

      {/* Informação da Análise (Modelo e Data) */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground text-center">
            Análise gerada em {new Date(analysis.analyzedAt).toLocaleString('pt-BR')} usando {analysis.model}
          </p>
        </CardContent>
      </Card>

      {/* Informações de Mídia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações de Mídia</CardTitle>
          <CardDescription>Status de clips (vídeo) do anúncio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Clips (vídeo):</span>
            {hasVideo === null ? (
              <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                Não detectável via API
              </Badge>
            ) : (
              <Badge variant={hasVideo ? 'default' : 'secondary'} className={hasVideo ? 'bg-green-600' : ''}>
                {hasVideo ? 'Sim' : 'Não'}
              </Badge>
            )}
          </div>
          {hasVideo === null && (
            <p className="text-xs text-muted-foreground mt-2">
              💡 Valide no painel do Mercado Livre; a API não detecta clips automaticamente.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Diagnóstico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Diagnóstico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{analysis.critique}</p>
        </CardContent>
      </Card>

      {/* Hacks de Crescimento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hacks de Crescimento</CardTitle>
          <CardDescription>Principais oportunidades de melhoria</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {analysis.growthHacks.map((hack, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  index === 0 ? 'bg-green-100 text-green-600' :
                  index === 1 ? 'bg-blue-100 text-blue-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  <span className="text-xs font-bold">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">{String(hack.title || 'Hack de crescimento')}</p>
                  <p className="text-sm text-muted-foreground">{String(hack.description || '')}</p>
                  {hack.estimatedImpact && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Impacto estimado: {String(hack.estimatedImpact)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Sugestão de SEO */}
      {analysis.seoSuggestions.title && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sugestão de SEO</CardTitle>
            <CardDescription>Otimização de título para melhor performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Título Atual</p>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm line-clamp-2">{currentTitle}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Sugestão IA</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => analysis.seoSuggestions.title && onCopy(analysis.seoSuggestions.title)}
                  className="h-7"
                >
                  {copiedText === analysis.seoSuggestions.title ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
              <div className="p-3 bg-primary/5 border-2 border-primary/20 rounded-md">
                <p className="text-sm font-medium">{analysis.seoSuggestions.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {analysis.seoSuggestions.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sugestão de Descrição</CardTitle>
            <CardDescription>Otimização de descrição para melhor conversão</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-end mb-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => analysis.seoSuggestions.description && onCopy(analysis.seoSuggestions.description)}
                className="h-7"
              >
                {copiedText === analysis.seoSuggestions.description ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
            <div className="p-3 bg-primary/5 border-2 border-primary/20 rounded-md">
              <p className="text-sm whitespace-pre-wrap">{analysis.seoSuggestions.description}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal: Entenda por quê (Performance Indisponível) */}
      <PerformanceUnavailableModal
        open={performanceModalOpen}
        onOpenChange={setPerformanceModalOpen}
      />
    </div>
  )
}

export function ListingsTable() {
  const [filters, setFilters] = useState<ListingsFilters>({
    page: 1,
    pageSize: 20,
  })
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data, isLoading, error, refetch } = useListings(filters)
  const { toast } = useToast()
  
  // Buscar todas as recomendações pendentes do tenant (apenas para contagem na tabela)
  const { data: recommendationsData } = useRecommendations({ status: 'pending', limit: 100 })
  
  // Criar um mapa de listingId -> recomendações para lookup rápido
  const recommendationsByListing = new Map<string, Recommendation[]>()
  recommendationsData?.items.forEach(rec => {
    const existing = recommendationsByListing.get(rec.listingId) || []
    existing.push(rec)
    recommendationsByListing.set(rec.listingId, existing)
  })

  // Removido: recomendações não são mais exibidas no modal (apenas IA)
  
  // Hook para análise de IA
  const { data: aiAnalysis, isLoading: aiLoading, error: aiError, analyze: triggerAIAnalysis } = useAIAnalyze(selectedListingId)
  
  // Removido uso de selectedRecommendations - não mais necessário
  // Removida aba de Recomendações - mantendo apenas IA
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const handleOpenRecommendations = (listingId: string) => {
    setSelectedListingId(listingId)
    setSheetOpen(true)
  }

  // Removido: handleApplyRecommendation não é mais necessário (aba Recomendações removida)

  const handleSearch = (q: string) => {
    setFilters(prev => ({ ...prev, q: q || undefined, page: 1 }))
  }

  const handleMarketplaceChange = (marketplace: string) => {
    setFilters(prev => ({ 
      ...prev, 
      marketplace: marketplace === 'all' ? undefined : marketplace as 'shopee' | 'mercadolivre',
      page: 1 
    }))
  }

  const handleStatusChange = (status: string) => {
    setFilters(prev => ({ 
      ...prev, 
      status: status === 'all' ? undefined : status as 'active' | 'paused',
      page: 1 
    }))
  }

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Erro ao carregar anúncios</h3>
        <p className="text-muted-foreground mb-4">
          {String(error instanceof Error ? error.message : error || 'Ocorreu um erro inesperado')}
        </p>
        <Button onClick={() => refetch()} variant="outline">
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar anúncios..."
            className="pl-10"
            defaultValue={filters.q || ''}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        
        <Select
          value={filters.marketplace || 'all'}
          onChange={(e) => handleMarketplaceChange(e.target.value)}
        >
          <option value="all">Todos os marketplaces</option>
          <option value="shopee">Shopee</option>
          <option value="mercadolivre">Mercado Livre</option>
        </Select>

        <Select
          value={filters.status || 'all'}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="paused">Pausados</option>
        </Select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando anúncios...</span>
        </div>
      )}

      {/* Tabela */}
      {data && !isLoading && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Super Seller Score</TableHead>
                  <TableHead className="w-12">Dicas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum anúncio encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((listing) => (
                    <TableRow key={listing.id}>
                      <TableCell className="font-medium">{listing.title}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          listing.marketplace === 'shopee' 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {listing.marketplace === 'shopee' ? 'Shopee' : 'Mercado Livre'}
                        </span>
                      </TableCell>
                      <TableCell>R$ {Number(listing.price ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{listing.stock}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          listing.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {listing.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // Preferir Super Seller Score, fallback para Health Score
                          const score = listing.superSellerScore ?? listing.healthScore;
                          const breakdown = listing.scoreBreakdown;
                          
                          if (score !== undefined && score !== null && score > 0) {
                            // Gerar tooltip com breakdown
                            const tooltipLines = [
                              `Score Total: ${score}%`,
                            ];
                            if (breakdown) {
                              tooltipLines.push('─────────────');
                              tooltipLines.push(`📝 Cadastro: ${breakdown.cadastro}/30`);
                              tooltipLines.push(`📈 Tráfego: ${breakdown.trafego}/30`);
                              tooltipLines.push(`✅ Disponibilidade: ${breakdown.disponibilidade}/40`);
                            }
                            
                            return (
                          <div 
                            className="flex items-center gap-2 cursor-help"
                                title={tooltipLines.join('\n')}
                          >
                                {score >= 80 ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : score >= 60 ? (
                                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                                ) : score >= 40 ? (
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            ) : (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className={`font-medium ${
                                  score >= 80 
                                ? 'text-green-600' 
                                    : score >= 60 
                                      ? 'text-blue-500' 
                                      : score >= 40
                                  ? 'text-yellow-600' 
                                        : 'text-red-500'
                            }`}>
                                  {score}%
                                </span>
                              </div>
                            );
                          }
                          
                          return <span className="text-muted-foreground">N/A</span>;
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const recs = recommendationsByListing.get(listing.id) || []
                          if (recs.length === 0) {
                            return <span className="text-muted-foreground">-</span>
                          }
                          
                          // Ordenar por prioridade (maior primeiro)
                          const sortedRecs = [...recs].sort((a, b) => b.priority - a.priority)
                          const hasCritical = sortedRecs.some(r => r.priority >= 90)
                          
                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-1"
                              onClick={() => handleOpenRecommendations(listing.id)}
                            >
                              <div className={`flex items-center gap-1 ${
                                hasCritical ? 'animate-pulse' : ''
                              }`}>
                                <Lightbulb className={`h-5 w-5 ${
                                  hasCritical 
                                    ? 'text-red-500 fill-red-100' 
                                    : 'text-yellow-500 fill-yellow-100'
                                }`} />
                                <span className={`text-xs font-medium ${
                                  hasCritical ? 'text-red-600' : 'text-yellow-600'
                                }`}>
                                  {recs.length}
                                </span>
                              </div>
                            </Button>
                          )
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {data.items.length} de {data.total} anúncios
            </p>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(1, filters.page! - 1))}
                disabled={filters.page === 1}
              >
                Anterior
              </Button>
              
              <span className="text-sm text-muted-foreground">
                Página {filters.page} de {Math.ceil(data.total / (filters.pageSize || 20))}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(filters.page! + 1)}
                disabled={filters.page! >= Math.ceil(data.total / (filters.pageSize || 20))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Sheet de Recomendações e Análise IA */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {data?.items.find(l => l.id === selectedListingId)?.title || 'Detalhes do Anúncio'}
            </SheetTitle>
            <SheetDescription>
              Análise completa e recomendações para melhorar seu anúncio
            </SheetDescription>
          </SheetHeader>

          <Tabs value="ai" className="mt-6">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="ai">
                <Sparkles className="h-4 w-4 mr-2" />
                Inteligência Artificial
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-4">
              <AIAnalysisTab
                analysis={aiAnalysis}
                isLoading={aiLoading}
                error={aiError}
                onAnalyze={async () => {
                  try {
                    await triggerAIAnalysis()
                  } catch {
                    // Erro já foi tratado no hook, apenas logar para debugging
                    // Log erro sem detalhes sensíveis
                    console.error('[AI-ANALYZE] Erro ao disparar análise')
                    // Não mostrar toast de erro aqui, o componente AIAnalysisTab já exibe o erro
                  }
                }}
                onForceRefresh={async () => {
                  try {
                    await triggerAIAnalysis(true) // forceRefresh=true
                    toast({
                      title: 'Análise atualizada!',
                      description: 'Nova análise gerada com sucesso',
                    })
                  } catch {
                    console.error('[AI-ANALYZE] Erro ao forçar atualização')
                  }
                }}
                currentTitle={data?.items.find(l => l.id === selectedListingId)?.title || ''}
                copiedText={copiedText}
                onCopy={(text) => {
                  navigator.clipboard.writeText(text)
                  setCopiedText(text)
                  setTimeout(() => setCopiedText(null), 2000)
                  toast({
                    title: 'Copiado!',
                    description: 'Texto copiado para a área de transferência',
                  })
                }}
                hasVideo={data?.items.find(l => l.id === selectedListingId)?.hasVideo}
                listingId={selectedListingId || undefined}
                marketplace={data?.items.find(l => l.id === selectedListingId)?.marketplace}
                listingIdExt={data?.items.find(l => l.id === selectedListingId)?.listingIdExt}
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  )
}
