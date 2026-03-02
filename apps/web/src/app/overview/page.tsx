'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMetricsSummary } from '@/hooks/use-metrics-summary';
import { useMercadoLivreStatus } from '@/hooks/use-mercadolivre-status';
import { AuthGuard } from '@/components/AuthGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Eye, ShoppingCart, Award, Zap, TrendingUp, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useListings } from '@/hooks/use-listings';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

function OverviewContent() {
  const router = useRouter();
  const [periodDays, setPeriodDays] = useState<number>(7);
  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketplaceFilter, setMarketplaceFilter] = useState<'all' | 'mercadolivre' | 'shopee'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [listingQuery, setListingQuery] = useState<string>('');
  const { data: connectionStatus } = useMercadoLivreStatus();
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('overview-period-days');
    if (saved) {
      setPeriodDays(parseInt(saved, 10));
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('overview-period-days', periodDays.toString());
    }
  }, [periodDays, mounted]);

  const { data, isLoading, error, refetch } = useMetricsSummary({ days: periodDays });

  // Filtros (aplicados onde for possível com dados já disponíveis)
  const listingsTotal = useListings({
    page: 1,
    pageSize: 1,
    marketplace: marketplaceFilter === 'all' ? undefined : marketplaceFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    q: listingQuery ? listingQuery : undefined,
  });

  const listingsActiveOrPaused = useListings({
    page: 1,
    pageSize: 1,
    marketplace: marketplaceFilter === 'all' ? undefined : marketplaceFilter,
    status: statusFilter === 'paused' ? 'paused' : 'active',
    q: listingQuery ? listingQuery : undefined,
  });

  // Sugestões para dropdown/search de anúncio
  const listingSuggestions = useListings({
    page: 1,
    pageSize: 10,
    marketplace: marketplaceFilter === 'all' ? undefined : marketplaceFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    q: listingQuery ? listingQuery : undefined,
  });

  const handleMarketplaceFilterChange = (value: string) => {
    if (value === 'all' || value === 'mercadolivre' || value === 'shopee') {
      setMarketplaceFilter(value);
    }
  };

  const handleStatusFilterChange = (value: string) => {
    if (value === 'all' || value === 'active' || value === 'paused') {
      setStatusFilter(value);
    }
  };

  const handleReconnect = async () => {
    try {
      const apiUrl = getApiBaseUrl();
      const token = getAccessToken();
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${apiUrl}/auth/mercadolivre/connect`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao iniciar conexão');
      }

      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      // Log erro sem detalhes sensíveis
      console.error('Erro ao reconectar');
    }
  };

  const handleRefreshData = async () => {
    try {
      setIsRefreshing(true);
      const apiUrl = getApiBaseUrl();
      const token = getAccessToken();
      
      if (!token) {
        router.push('/login');
        return;
      }

      // Chamar endpoint de refresh (orders + metrics) com o período selecionado
      const response = await fetch(`${apiUrl}/sync/mercadolivre/refresh?days=${periodDays}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Se for erro de conexão expirada (409 ou 401 com CONNECTION_EXPIRED)
        if (response.status === 409 || (response.status === 401 && errorData.code === 'CONNECTION_EXPIRED')) {
          toast({
            title: 'Conexão com Mercado Livre expirou',
            description: errorData.message || 'Reconecte sua conta do Mercado Livre para continuar.',
            variant: 'destructive',
            action: (
              <Button
                size="sm"
                onClick={handleReconnect}
                className="mt-2"
              >
                Reconectar Mercado Livre
              </Button>
            ),
          });
          return;
        }
        
        throw new Error(errorData.message || 'Falha ao atualizar dados');
      }

      const result = await response.json();
      console.log('Refresh concluído:', result);

      // Refetch dos dados após atualização (sem recarregar a página)
      await refetch();
      
      toast({
        title: 'Dados atualizados!',
        description: 'As informações do dashboard foram sincronizadas com o Mercado Livre.',
      });
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
      toast({
        title: 'Erro ao atualizar',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao sincronizar os dados.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const isDisconnected = !connectionStatus?.connected || 
    connectionStatus?.status === 'DISCONNECTED' || 
    connectionStatus?.status === 'EXPIRED' || 
    connectionStatus?.status === 'REVOKED';

  // Verificar se há erro de conexão expirada nos dados de métricas
  // Type guard para verificar se o erro tem propriedades de resposta HTTP
  interface ApiError {
    response?: {
      data?: {
        code?: string;
      };
    };
    message?: string;
  }

  const isApiError = (err: unknown): err is ApiError => {
    return typeof err === 'object' && err !== null;
  };

  const hasAuthError = (() => {
    if (!error || !isApiError(error)) {
      return false;
    }
    const apiError = error as ApiError;
    return (
      apiError.response?.data?.code === 'AUTH_REVOKED' ||
      (typeof apiError.message === 'string' && apiError.message.includes('Conexão expirada'))
    );
  })();

  if (!mounted) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Erro ao carregar métricas</CardTitle>
            <CardDescription className="text-red-700">
              Não foi possível carregar os dados do dashboard. Tente novamente mais tarde.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sem dados disponíveis</CardTitle>
            <CardDescription>
              Não há métricas disponíveis para o período selecionado.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Determinar se há um listing específico selecionado
  const selectedListingId = listingQuery && listingQuery.trim() !== '' 
    ? listingSuggestions.data?.items?.find(l => 
        l.title?.toLowerCase().includes(listingQuery.toLowerCase()) ||
        l.listingIdExt?.toLowerCase().includes(listingQuery.toLowerCase())
      )?.id
    : null
  
  const isListingFiltered = selectedListingId !== null && selectedListingId !== undefined

  // Usar dados reais da série temporal de vendas se disponível
  // Se há filtro de listing específico, tentar usar dados filtrados (por enquanto manter global)
  const trendData = (data.salesSeries && data.salesSeries.length > 0)
    ? data.salesSeries.map((item) => ({
        date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        revenue: item.revenue,
        orders: item.orders,
        visits: item.visits ?? null, // null quando não disponível
      }))
    : Array.from({ length: Math.min(periodDays, 7) }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (Math.min(periodDays, 7) - 1 - i));
        return {
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          revenue: 0,
          orders: 0,
          visits: null,
        };
      });

  // Determinar label do gráfico e se há dados de série por listing
  const chartLabel = isListingFiltered 
    ? `Tendência de Vendas • ${listingSuggestions.data?.items?.[0]?.title || 'Anúncio selecionado'}`
    : 'Tendência de Vendas • Global (sem filtro)'
  
  const hasListingTimeSeriesData = false // Por enquanto, série por listing não disponível

  // Verificar se há visitas disponíveis
  const hasVisits = data.visitsCoverage && data.visitsCoverage.filledDays > 0;
  const visitsCoverage = data.visitsCoverage || { filledDays: 0, totalDays: periodDays };

  const formatNumber = (num: number | null | undefined) => {
    const safeNum = Number(num) || 0;
    if (!Number.isFinite(safeNum)) return '0';
    return new Intl.NumberFormat('pt-BR').format(safeNum);
  };

  const formatCurrency = (num: number | null | undefined) => {
    const safeNum = Number(num) || 0;
    if (!Number.isFinite(safeNum)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNum);
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Conexão Expirada */}
      {(isDisconnected || hasAuthError) && (
        <Alert variant="destructive" className="border-red-500 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-900 font-semibold">
            Conexão com Mercado Livre Expirada
          </AlertTitle>
          <AlertDescription className="text-red-800 mt-2">
            <p className="mb-3">
              Sua conexão com o Mercado Livre expirou ou foi revogada. Para continuar recebendo dados atualizados, reconecte sua conta.
            </p>
            <Button
              onClick={handleReconnect}
              variant="default"
              size="sm"
              className="bg-red-600 hover:bg-red-700"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Reconectar Mercado Livre
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground">
            Métricas de performance dos últimos {periodDays} dias
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setPeriodDays(7)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              periodDays === 7
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            7 dias
          </button>
          <button
            onClick={() => setPeriodDays(30)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              periodDays === 30
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            30 dias
          </button>
          <Button
            onClick={handleRefreshData}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="ml-2"
          >
            {isRefreshing ? (
              <>
                <Zap className="h-4 w-4 mr-2 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Atualizar dados
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filtros (visuais) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Aplicados onde houver dados granulares no frontend</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Loja / Marketplace</p>
              <Select
                value={marketplaceFilter}
                onChange={(e) => handleMarketplaceFilterChange(e.target.value)}
              >
                <option value="all">Todas</option>
                <option value="mercadolivre">Mercado Livre</option>
                <option value="shopee">Shopee</option>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <Select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="paused">Pausados</option>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Anúncio</p>
              <Input
                placeholder="Buscar por título / ID..."
                value={listingQuery}
                onChange={(e) => setListingQuery(e.target.value)}
                list="overview-listing-suggestions"
              />
              <datalist id="overview-listing-suggestions">
                {(listingSuggestions.data?.items || []).map((l) => (
                  <option key={l.id} value={`${l.title} (${l.listingIdExt || l.id})`} />
                ))}
              </datalist>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Anúncios</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(listingsTotal.data?.total ?? data.totalListings)}
            </div>
            <p className="text-xs text-muted-foreground">
              {listingsTotal.data ? 'Filtrado' : 'Global (sem filtro)'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {statusFilter === 'paused' ? 'Anúncios Pausados' : 'Anúncios Ativos'}
            </CardTitle>
            <Zap className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {formatNumber(listingsActiveOrPaused.data?.total ?? (statusFilter === 'paused' ? 0 : data.activeListings))}
            </div>
            <p className="text-xs text-muted-foreground">
              {listingsActiveOrPaused.data ? 'Filtrado' : 'Global (sem filtro)'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos ({periodDays} dias)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-2xl font-bold">{formatNumber(data.totalOrders)}</div>
              <Badge variant="secondary" className="text-xs shrink-0">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita: {formatCurrency(data.totalRevenue)} • <span className="font-medium">Global (sem filtro)</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Impacto Potencial */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:border-blue-800 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <span className="text-xl">⚡</span>
            Impacto Potencial
          </CardTitle>
          <CardDescription>
            Score médio dos seus anúncios baseado em otimizações de SEO, mídia e competitividade • <span className="font-medium">Global (sem filtro)</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-blue-700 dark:text-blue-400 mb-3">
            {Number(data.averageSuperSellerScore || data.averageHealthScore || 0).toFixed(0)}%
          </div>
          <p className="text-sm text-muted-foreground">
            {(() => {
              const score = Number(data.averageSuperSellerScore || data.averageHealthScore || 0);
              if (score >= 80) return '🟢 Excelente - Seus anúncios estão otimizados';
              if (score >= 60) return '🔵 Bom - Há espaço para melhorias';
              if (score >= 40) return '🟡 Regular - Atenção aos seus anúncios';
              return '🔴 Crítico - Melhore seus anúncios urgentemente';
            })()}
          </p>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>
            {chartLabel}
          </CardTitle>
          <CardDescription>
            Evolução de receita, pedidos e visitas (últimos {periodDays} dias)
            {isListingFiltered && !hasListingTimeSeriesData && (
              <span className="ml-2 text-yellow-600 dark:text-yellow-400 text-xs">
                • Série por anúncio ainda não disponível
              </span>
            )}
            {!hasVisits && (
              <span className="ml-2 text-yellow-600 dark:text-yellow-400 text-xs">
                • Visitas indisponíveis via API no período ({visitsCoverage.filledDays}/{visitsCoverage.totalDays} dias com dados)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isListingFiltered && !hasListingTimeSeriesData && (
            <Alert className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                Série por anúncio ainda não disponível. Exibindo dados globais.
              </AlertDescription>
            </Alert>
          )}
          {!hasVisits && (
            <Alert className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                Visitas indisponíveis via API no período selecionado ({visitsCoverage.filledDays}/{visitsCoverage.totalDays} dias com dados). Os dados de pedidos e receita continuam funcionando normalmente.
              </AlertDescription>
            </Alert>
          )}
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" orientation="left" stroke="#82ca9d" />
              <YAxis yAxisId="right" orientation="right" stroke="#ffc658" />
              <Tooltip 
                formatter={(value: unknown, name: string) => {
                  if (name === 'Receita') {
                    const numValue = typeof value === 'number' ? value : Number(value) || 0;
                    return [`R$ ${numValue.toFixed(2)}`, name] as [string, string];
                  }
                  if (name === 'Visitas') {
                    if (value === null || value === undefined) return ['N/A', name] as [string, string];
                    return [String(value), name] as [string, string];
                  }
                  return [String(value), name] as [string, string];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#82ca9d"
                name="Receita"
                strokeWidth={2}
                yAxisId="left"
              />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="#ffc658"
                name="Pedidos"
                strokeWidth={2}
                yAxisId="right"
              />
              {hasVisits && (
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke="#8884d8"
                  name="Visitas"
                  strokeWidth={2}
                  yAxisId="right"
                  connectNulls={false}
                />
              )}
              {/* Espaço reservado para marcador futuro */}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Produtos */}
      {data.topListings && data.topListings.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <CardTitle>Top 3 Produtos (Receita)</CardTitle>
            </div>
            <CardDescription>
              Produtos com maior receita no período
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topListings.map((product, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{product.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.orders} pedido{product.orders !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(product.revenue)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(product.orders > 0 ? product.revenue / product.orders : 0)} médio
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        Última atualização: {data.updatedAt ? new Date(data.updatedAt).toLocaleString('pt-BR') : 'Agora'}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <OverviewContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
