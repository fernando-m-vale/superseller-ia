'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useRecommendations } from '@/hooks/use-recommendations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertCircle, Check } from 'lucide-react'
import type { Marketplace } from '@/types/recommendations'
import { applyRecommendation } from '@/hooks/use-recommendations'
import { useToast } from '@/hooks/use-toast'

function formatMarketplace(marketplace: Marketplace): string {
  return marketplace === 'shopee' ? 'Shopee' : 'Mercado Livre'
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RecommendationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const [marketplace, setMarketplace] = useState<Marketplace | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const marketplaceParam = searchParams.get('marketplace') as Marketplace | null
    const qParam = searchParams.get('q')
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')

    if (marketplaceParam) setMarketplace(marketplaceParam)
    if (qParam) {
      setSearchQuery(qParam)
      setDebouncedSearch(qParam)
    }
    if (pageParam) setCurrentPage(parseInt(pageParam, 10))
    if (pageSizeParam) setPageSize(parseInt(pageSizeParam, 10))
  }, [searchParams])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      // Resetar página quando busca muda
      setCurrentPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // A API de recommendations só suporta: listingId, status, type, limit
  const filters = {
    status: 'pending' as const, // Filtrar apenas pendentes por padrão
    limit: 1000, // Buscar mais itens para permitir filtros no frontend
  }

  const { data, isLoading, error, refetch } = useRecommendations(filters)
  const isError = !!error

  const handleApplyRecommendation = async (recId: string) => {
    try {
      await applyRecommendation(recId)
      toast({
        variant: 'success',
        title: 'Recomendação aplicada!',
        description: 'A recomendação foi marcada como concluída.',
      })
      refetch()
    } catch (error) {
      console.error('Erro ao aplicar recomendação:', error)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível marcar a recomendação como feita. Tente novamente.',
      })
    }
  }

  const getEffortLabel = (priority: number): string => {
    if (priority >= 90) return 'Alto'
    if (priority >= 70) return 'Médio'
    return 'Baixo'
  }
  
  // Filtrar no frontend por marketplace e busca (se necessário)
  const filteredItems = data?.items?.filter(item => {
    if (marketplace && item.listing?.marketplace !== marketplace) return false
    if (debouncedSearch && !item.title.toLowerCase().includes(debouncedSearch.toLowerCase())) return false
    return true
  }) || []
  
  // Paginação no frontend
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const totalPages = Math.ceil(filteredItems.length / pageSize)

  // Atualizar URL quando filtros mudarem
  useEffect(() => {
    const params = new URLSearchParams()
    if (marketplace) params.set('marketplace', marketplace)
    if (debouncedSearch) params.set('q', debouncedSearch)
    params.set('page', currentPage.toString())
    params.set('pageSize', pageSize.toString())
    
    const newUrl = `/recommendations?${params.toString()}`
    if (window.location.pathname + window.location.search !== newUrl) {
      router.replace(newUrl, { scroll: false })
    }
  }, [marketplace, debouncedSearch, currentPage, pageSize, router])

  const handleApplyFilters = () => {
    setCurrentPage(1)
    // O useEffect já atualiza a URL automaticamente quando currentPage muda
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ações Sugeridas</h2>
        <p className="text-muted-foreground">
          Recomendações inteligentes para otimizar seus anúncios
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Refine sua busca por marketplace, palavra-chave ou tamanho de página
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Marketplace</label>
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value as Marketplace | '')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                <option value="shopee">Shopee</option>
                <option value="mercadolivre">Mercado Livre</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <Input
                placeholder="Ex: iPhone, notebook..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Itens por página</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10))
                  setCurrentPage(1)
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>

            <div className="space-y-2 flex items-end">
              <Button onClick={handleApplyFilters} className="w-full">
                Aplicar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar recomendações</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error instanceof Error ? error.message : 'Erro desconhecido'}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="h-10 bg-muted animate-pulse rounded" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhuma recomendação encontrada para os filtros selecionados.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setMarketplace('')
                  setSearchQuery('')
                  setDebouncedSearch('')
                  setCurrentPage(1)
                }}
              >
                Limpar filtros
              </Button>
            </div>
          ) : data ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Marketplace</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Impacto</TableHead>
                    <TableHead>Esforço</TableHead>
                    <TableHead>Health Score</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((recommendation) => (
                    <TableRow key={recommendation.id}>
                      <TableCell className="font-medium max-w-xs truncate" title={recommendation.listing?.title || 'N/A'}>
                        {recommendation.listing?.title || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {recommendation.listing?.marketplace 
                          ? formatMarketplace(recommendation.listing.marketplace as Marketplace)
                          : '—'}
                      </TableCell>
                      <TableCell>{recommendation.title}</TableCell>
                      <TableCell className="max-w-sm truncate" title={recommendation.description}>
                        {recommendation.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant={recommendation.priority >= 90 ? 'destructive' : recommendation.priority >= 70 ? 'default' : 'secondary'}>
                          {recommendation.priority >= 90 ? 'Alto' : recommendation.priority >= 70 ? 'Médio' : 'Baixo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getEffortLabel(recommendation.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {recommendation.listing?.superSellerScore != null
                          ? `${recommendation.listing.superSellerScore}%`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(recommendation.createdAt)}
                      </TableCell>
                      <TableCell>
                        {recommendation.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApplyRecommendation(recommendation.id)}
                            className="gap-2"
                          >
                            <Check className="h-4 w-4" />
                            Marcar como Feito
                          </Button>
                        )}
                        {recommendation.status === 'applied' && (
                          <Badge variant="secondary">Aplicada</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages} ({data.total} recomendações)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
