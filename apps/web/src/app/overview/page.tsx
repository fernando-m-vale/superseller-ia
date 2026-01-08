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
import { Eye, MousePointerClick, ShoppingCart, DollarSign, Award, Zap, TrendingUp, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

function OverviewContent() {
  const router = useRouter();
  const [periodDays, setPeriodDays] = useState<number>(7);
  const [mounted, setMounted] = useState(false);
  const { data: connectionStatus } = useMercadoLivreStatus();

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

  const { data, isLoading, error } = useMetricsSummary({ days: periodDays });

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

  // Usar dados reais da série temporal de vendas se disponível
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
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Anúncios</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totalListings)}</div>
            <p className="text-xs text-muted-foreground">
              Em todas as plataformas
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anúncios Ativos</CardTitle>
            <Zap className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {formatNumber(data.activeListings)}
            </div>
            <p className="text-xs text-muted-foreground">
              Produtos à venda agora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Total</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totalStock)}</div>
            <p className="text-xs text-muted-foreground">
              Preço médio: {formatCurrency(data.averagePrice)}
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
              Ticket médio: {formatCurrency(data.averageTicket)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita ({periodDays} dias)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
              <Badge variant="secondary" className="text-xs shrink-0">
                <TrendingUp className="h-3 w-3 mr-1" />
                +8%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              GMV total do período
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência de Vendas</CardTitle>
          <CardDescription>
            Evolução de receita, pedidos e visitas (últimos {periodDays} dias)
            {!hasVisits && (
              <span className="ml-2 text-yellow-600 dark:text-yellow-400 text-xs">
                • Visitas indisponíveis via API no período
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasVisits && (
            <Alert className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                Visitas indisponíveis via API no período selecionado. Os dados de pedidos e receita continuam funcionando normalmente.
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
                formatter={(value: number | null, name: string) => {
                  if (name === 'Receita') return [`R$ ${Number(value || 0).toFixed(2)}`, name];
                  if (name === 'Visitas' && value === null) return ['N/A', name];
                  return [value, name];
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
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Marketplace Breakdown */}
      {data.byMarketplace && data.byMarketplace.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <CardTitle>Por Marketplace</CardTitle>
            </div>
            <CardDescription>
              Distribuição de anúncios por plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {data.byMarketplace.map((mp) => (
                <div key={mp.marketplace} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold capitalize">{mp.marketplace}</p>
                    <p className="text-sm text-muted-foreground">
                      {mp.count} anúncios | Score: {Number(mp.avgSuperSellerScore || mp.avgHealthScore || 0).toFixed(0)}%
                    </p>
                  </div>
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    {formatCurrency(mp.avgPrice)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:border-blue-800 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">⚡</span>
              Super Seller Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
              {Number(data.averageSuperSellerScore || data.averageHealthScore || 0).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Anúncios Pausados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.pausedListings)}</div>
            <p className="text-xs text-muted-foreground">
              Anúncios inativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.averageTicket || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor médio por pedido
            </p>
          </CardContent>
        </Card>
      </div>

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
