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
import { useListingRecommendations, applyRecommendation } from '@/hooks/use-recommendations'
import { useAIAnalyze } from '@/hooks/use-ai-analyze'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AIAnalysisResponse } from '@/hooks/use-ai-analyze'

// Componente da aba de Análise IA
function AIAnalysisTab({
  analysis,
  isLoading,
  error,
  onAnalyze,
  currentTitle,
  copiedText,
  onCopy,
}: {
  analysis: AIAnalysisResponse | null
  isLoading: boolean
  error: string | null
  onAnalyze: () => Promise<void>
  currentTitle: string
  copiedText: string | null
  onCopy: (text: string) => void
}) {
  const loadingMessages = [
    'Analisando concorrentes...',
    'Verificando fotos e qualidade...',
    'Otimizando copy e SEO...',
    'Gerando insights personalizados...',
  ]
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)

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
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Erro ao gerar análise</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={onAnalyze} variant="outline">
          Tentar novamente
        </Button>
      </div>
    )
  }

  // Estado com análise
  if (!analysis) return null

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-blue-100'
    if (score >= 40) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  return (
    <div className="space-y-6">
      {/* Score IA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Score IA</CardTitle>
            <Badge className={`${getScoreBgColor(analysis.score)} ${getScoreColor(analysis.score)} text-lg font-bold px-4 py-1`}>
              {analysis.score}/100
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-muted rounded-full h-3 mb-4">
            <div
              className={`h-3 rounded-full transition-all ${
                analysis.score >= 80
                  ? 'bg-green-600'
                  : analysis.score >= 60
                  ? 'bg-blue-600'
                  : analysis.score >= 40
                  ? 'bg-yellow-600'
                  : 'bg-red-600'
              }`}
              style={{ width: `${analysis.score}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Análise gerada em {new Date(analysis.analyzedAt).toLocaleString('pt-BR')} usando {analysis.model}
          </p>
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
                <p className="text-sm flex-1">{hack}</p>
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
  
  // Buscar todas as recomendações pendentes do tenant
  const { data: recommendationsData, refetch: refetchRecommendations } = useRecommendations({ status: 'pending', limit: 100 })
  
  // Criar um mapa de listingId -> recomendações para lookup rápido
  const recommendationsByListing = new Map<string, Recommendation[]>()
  recommendationsData?.items.forEach(rec => {
    const existing = recommendationsByListing.get(rec.listingId) || []
    existing.push(rec)
    recommendationsByListing.set(rec.listingId, existing)
  })

  // Buscar recomendações do listing selecionado
  const { recommendations: selectedRecommendations, refetch: refetchSelectedRecommendations } = useListingRecommendations(selectedListingId)
  
  // Hook para análise de IA
  const { data: aiAnalysis, isLoading: aiLoading, error: aiError, analyze: triggerAIAnalysis } = useAIAnalyze(selectedListingId)
  const [activeTab, setActiveTab] = useState<'recommendations' | 'ai'>('recommendations')
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const handleOpenRecommendations = (listingId: string) => {
    setSelectedListingId(listingId)
    setSheetOpen(true)
  }

  const handleApplyRecommendation = async (recId: string) => {
    try {
      await applyRecommendation(recId)
      
      // Toast de sucesso
      toast({
        variant: 'success',
        title: 'Recomendação aplicada!',
        description: 'A recomendação foi marcada como concluída.',
      })
      
      // Atualizar listas localmente
      refetchRecommendations()
      refetchSelectedRecommendations()
    } catch (error) {
      console.error('Erro ao aplicar recomendação:', error)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível marcar a recomendação como feita. Tente novamente.',
      })
    }
  }

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
          {error instanceof Error ? error.message : 'Ocorreu um erro inesperado'}
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

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'recommendations' | 'ai')} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="recommendations">
                <Lightbulb className="h-4 w-4 mr-2" />
                Recomendações ({selectedRecommendations.length})
              </TabsTrigger>
              <TabsTrigger value="ai">
                <Sparkles className="h-4 w-4 mr-2" />
                Inteligência Artificial
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recommendations" className="mt-4">
              <div className="space-y-4">
            {selectedRecommendations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma recomendação disponível para este anúncio.</p>
              </div>
            ) : (
              selectedRecommendations
                .sort((a, b) => b.priority - a.priority)
                .map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant={
                              rec.priority >= 90
                                ? 'destructive'
                                : rec.priority >= 70
                                  ? 'default'
                                  : 'secondary'
                            }
                          >
                            {rec.type}
                          </Badge>
                          {rec.priority >= 90 && (
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              Crítico
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{rec.title}</h4>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                        {rec.impactEstimate && (
                          <p className="text-xs text-muted-foreground mt-2">
                            💡 {rec.impactEstimate}
                          </p>
                        )}
                        {rec.scoreImpact && (
                          <p className="text-xs text-muted-foreground">
                            📈 Potencial de ganho: +{rec.scoreImpact} pontos no Super Seller Score
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleApplyRecommendation(rec.id)}
                    >
                      Marcar como Feito
                    </Button>
                  </div>
                ))
            )}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              <AIAnalysisTab
                analysis={aiAnalysis}
                isLoading={aiLoading}
                error={aiError}
                onAnalyze={triggerAIAnalysis}
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
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  )
}
