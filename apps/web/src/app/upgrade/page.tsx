'use client';
import { useState } from 'react';
import { useBilling } from '@/hooks/use-billing';
import { Check, Zap, Clock } from 'lucide-react';

const PRO_FEATURES = [
  'Análises de IA ilimitadas em todos os anúncios',
  'Copy pronta para aplicar com 1 clique',
  'Diagnóstico completo do funil de vendas',
  'Sync automático diário com Mercado Livre',
  'Histórico de 90 dias de métricas',
  'Todos os marketplaces (ML, Shopee, Amazon, Magalu)',
  'Relatório mensal de performance',
  'Suporte prioritário',
];

const FREE_FEATURES = [
  '3 análises de IA por mês',
  '1 marketplace conectado',
  'Diagnóstico básico do funil',
  'Histórico de 7 dias',
];

export default function UpgradePage() {
  const { isPro, isTrialing, trialDaysLeft, startCheckout, loading } = useBilling();
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [checkingOut, setCheckingOut] = useState(false);

  const handleCheckout = async () => {
    setCheckingOut(true);
    await startCheckout(interval);
    setCheckingOut(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isPro && !isTrialing) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center px-4">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">Você já é Pro!</h1>
        <p className="text-muted-foreground">Aproveite todas as funcionalidades ilimitadas.</p>
      </div>
    );
  }

  const monthlyPrice = 297;
  const annualMonthlyPrice = 247;
  const annualSavings = (monthlyPrice - annualMonthlyPrice) * 12;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        {isTrialing && trialDaysLeft !== null && (
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-4 dark:bg-amber-950/40 dark:text-amber-300">
            <Clock className="w-4 h-4" />
            Trial expira em {trialDaysLeft} dia{trialDaysLeft !== 1 ? 's' : ''}
          </div>
        )}
        <h1 className="text-3xl font-bold mb-3">
          {isTrialing ? 'Continue com o Pro' : 'Desbloqueie o SuperSeller IA Pro'}
        </h1>
        <p className="text-muted-foreground text-lg">
          Análises ilimitadas. Copy pronta. Diagnóstico real. Vendas maiores.
        </p>
      </div>

      {/* Comparação Free vs Pro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Free */}
        <div className="border rounded-xl p-6">
          <h3 className="font-semibold text-lg mb-1">Gratuito</h3>
          <p className="text-2xl font-bold mb-4">R$0</p>
          <ul className="space-y-2">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5">•</span> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className="border-2 border-primary rounded-xl p-6 bg-primary/5 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full font-medium">
            RECOMENDADO
          </div>
          <h3 className="font-semibold text-lg mb-1">Pro</h3>
          <p className="text-2xl font-bold mb-4">
            R${interval === 'year' ? annualMonthlyPrice : monthlyPrice}
            <span className="text-sm font-normal text-muted-foreground">/mês</span>
          </p>
          <ul className="space-y-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Toggle mensal/anual */}
      <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => setInterval('month')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${interval === 'month' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        >
          Mensal — R$297
        </button>
        <button
          onClick={() => setInterval('year')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${interval === 'year' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        >
          Anual — R$247/mês
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full dark:bg-green-900/40 dark:text-green-400">
            Economize R${annualSavings}
          </span>
        </button>
      </div>

      {/* CTA */}
      <button
        onClick={handleCheckout}
        disabled={checkingOut}
        className="w-full bg-primary text-primary-foreground rounded-xl py-4 font-semibold text-lg
          hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {checkingOut
          ? 'Redirecionando...'
          : isTrialing
            ? 'Ativar Pro agora'
            : 'Começar agora'}
      </button>
      <p className="text-center text-xs text-muted-foreground mt-3">
        Cancele quando quiser. Sem fidelidade.
      </p>

      {/* Ícone de segurança */}
      <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
        <Zap className="w-3 h-3" />
        Pagamento seguro via Stripe
      </div>
    </div>
  );
}
