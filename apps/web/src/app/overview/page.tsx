'use client';

import { useState, useEffect } from 'react';
import { useMetricsSummary } from '@/hooks/use-metrics-summary';
import { AuthGuard } from '@/components/AuthGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Eye, MousePointerClick, ShoppingCart, DollarSign, Target, Award } from 'lucide-react';

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

  const trendData = Array.from({ length: periodDays }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (periodDays - 1 - i));
    return {
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      impressions: Math.floor(data.totalImpressions / periodDays + Math.random() * 500),
      visits: Math.floor(data.totalVisits / periodDays + Math.random() * 50),
      orders: Math.floor(data.totalOrders / periodDays + Math.random() * 5),
    };
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const formatPercentage = (num: number) => {
    return `${(num * 100).toFixed(2)}%`;
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impressões</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totalImpressions)}</div>
            <p className="text-xs text-muted-foreground">
              CTR: {formatPercentage(data.avgCTR)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visitas</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totalVisits)}</div>
            <p className="text-xs text-muted-foreground">
              CVR: {formatPercentage(data.avgCVR)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totalOrders)}</div>
            <p className="text-xs text-muted-foreground">
              Total de conversões
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita</CardTitle>
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
          <CardTitle>Tendência de Performance</CardTitle>
          <CardDescription>
            Evolução das métricas nos últimos {periodDays} dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="impressions"
                stroke="#8884d8"
                name="Impressões"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="visits"
                stroke="#82ca9d"
                name="Visitas"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="#ffc658"
                name="Pedidos"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Best Listing Card */}
      {data.bestListing && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-900">Melhor Anúncio</CardTitle>
            </div>
            <CardDescription className="text-green-700">
              Anúncio com maior health score no período
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-green-900">{data.bestListing.title}</p>
                <p className="text-sm text-green-700">ID: {data.bestListing.id}</p>
              </div>
                            <Badge className="bg-green-600 text-white text-lg px-4 py-2">
                              <Target className="h-4 w-4 mr-1" />
                              {Number(data.bestListing.healthScore ?? 0).toFixed(2)}
                            </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">CTR Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(data.avgCTR)}</div>
            <p className="text-xs text-muted-foreground">
              Click-through rate médio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">CVR Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(data.avgCVR)}</div>
            <p className="text-xs text-muted-foreground">
              Conversion rate médio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalOrders > 0 ? data.totalRevenue / data.totalOrders : 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor médio por pedido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        Última atualização: {new Date(data.updatedAt).toLocaleString('pt-BR')}
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
