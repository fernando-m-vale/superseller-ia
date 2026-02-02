'use client'

import { useState } from 'react'
import { useListings, type ListingsFilters } from '@/hooks/use-listings'
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
import { Loader2, Search, AlertCircle } from 'lucide-react'
import { ListingAccordionRow } from '@/components/listings/ListingAccordionRow'

export function ListingsTable() {
  const [filters, setFilters] = useState<ListingsFilters>({
    page: 1,
    pageSize: 20,
  })
  // Estado para controlar qual linha está expandida (accordion single)
  const [expandedListingId, setExpandedListingId] = useState<string | null>(null)

  const handleRowToggle = (listingId: string) => {
    setExpandedListingId(prev => prev === listingId ? null : listingId)
  }

  const { data, isLoading, error, refetch } = useListings(filters)
  

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
                  <TableHead>Preço Promocional</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Análise SuperSeller IA</TableHead>
                  <TableHead></TableHead>
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
                    <ListingAccordionRow
                      key={listing.id}
                      listing={listing}
                      isExpanded={expandedListingId === listing.id}
                      onToggle={() => handleRowToggle(listing.id)}
                    />
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

    </div>
  )
}
