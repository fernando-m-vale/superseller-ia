'use client'

import { useState } from 'react'
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
  SheetTrigger,
} from '@/components/ui/sheet'
import { Loader2, Search, AlertCircle, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useListingRecommendations, applyRecommendation } from '@/hooks/use-recommendations'

export function ListingsTable() {
  const [filters, setFilters] = useState<ListingsFilters>({
    page: 1,
    pageSize: 20,
  })
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data, isLoading, error, refetch } = useListings(filters)
  
  // Buscar todas as recomendações pendentes do tenant
  const { data: recommendationsData } = useRecommendations({ status: 'pending', limit: 100 })
  
  // Criar um mapa de listingId -> recomendações para lookup rápido
  const recommendationsByListing = new Map<string, Recommendation[]>()
  recommendationsData?.items.forEach(rec => {
    const existing = recommendationsByListing.get(rec.listingId) || []
    existing.push(rec)
    recommendationsByListing.set(rec.listingId, existing)
  })

  // Buscar recomendações do listing selecionado
  const { recommendations: selectedRecommendations } = useListingRecommendations(selectedListingId)

  const handleOpenRecommendations = (listingId: string) => {
    setSelectedListingId(listingId)
    setSheetOpen(true)
  }

  const handleApplyRecommendation = async (recId: string) => {
    try {
      await applyRecommendation(recId)
      // Recarregar recomendações
      refetch()
    } catch (error) {
      console.error('Erro ao aplicar recomendação:', error)
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

      {/* Sheet de Recomendações */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {data?.items.find(l => l.id === selectedListingId)?.title || 'Recomendações'}
            </SheetTitle>
            <SheetDescription>
              {selectedRecommendations.length} dica{selectedRecommendations.length !== 1 ? 's' : ''} de melhoria para este anúncio
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
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
        </SheetContent>
      </Sheet>
    </div>
  )
}
