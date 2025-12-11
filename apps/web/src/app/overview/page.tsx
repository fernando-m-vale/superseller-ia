'use client';

import { useState, useEffect } from 'react';
import { useMetricsSummary } from '@/hooks/use-metrics-summary';
import { AuthGuard } from '@/components/AuthGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Eye, MousePointerClick, ShoppingCart, DollarSign, Award, Zap } from 'lucide-react';

function OverviewContent() {
  const [periodDays, setPeriodDays] = useState<number>(7);
  const [mounted, setMounted] = useState(false);

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
      }))
    : Array.from({ length: Math.min(periodDays, 7) }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (Math.min(periodDays, 7) - 1 - i));
        return {
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          revenue: 0,
          orders: 0,
        };
      });

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
    <div className="container mx-auto p-6 space-y-6">
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
            <div className="text-2xl font-bold">{formatNumber(data.totalOrders)}</div>
            <p className="text-xs text-muted-foreground">
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
            <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
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
            Evolução de receita e pedidos (últimos {periodDays} dias)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" orientation="left" stroke="#82ca9d" />
              <YAxis yAxisId="right" orientation="right" stroke="#ffc658" />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'Receita') return [`R$ ${value.toFixed(2)}`, name];
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
      <OverviewContent />
    </AuthGuard>
  );
}
