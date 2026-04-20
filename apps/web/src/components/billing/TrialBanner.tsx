'use client';
import { useBilling } from '@/hooks/use-billing';
import { useUsage } from '@/hooks/use-usage';
import { useRouter } from 'next/navigation';
import { Clock, Zap } from 'lucide-react';

export function TrialBanner() {
  const { isTrialing, isFree, trialDaysLeft, startCheckout } = useBilling();
  const { usage } = useUsage();
  const router = useRouter();

  // Trial ativo — mostrar contador regressivo
  if (isTrialing && trialDaysLeft !== null) {
    const isUrgent = trialDaysLeft <= 3;
    return (
      <div
        className={`flex items-center justify-between px-4 py-2 text-sm rounded-lg mb-4
          ${isUrgent
            ? 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300'
            : 'bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-300'
          }`}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0" />
          {isUrgent
            ? `Trial expira em ${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''} — adicione seu cartão`
            : `Trial Pro ativo — ${trialDaysLeft} dias restantes`}
        </div>
        <button
          onClick={() => startCheckout('month')}
          className="ml-4 font-semibold underline hover:no-underline shrink-0"
        >
          Ativar Pro →
        </button>
      </div>
    );
  }

  // Plano Free — mostrar uso de análises do mês
  if (isFree) {
    const used = usage?.analysesThisMonth ?? 0;
    const limit = usage?.analysesLimit ?? 3;
    const isAtLimit = used >= limit;
    const pct = Math.min(100, Math.round((used / limit) * 100));

    return (
      <div className="rounded-lg border mb-4 bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300">
        <div className="flex items-center justify-between px-4 py-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {used} de {limit} análise{limit !== 1 ? 's' : ''} usada{used !== 1 ? 's' : ''} este mês
            </span>
          </div>
          <button
            onClick={() => router.push('/upgrade')}
            className="ml-4 font-semibold underline hover:no-underline shrink-0"
          >
            {isAtLimit ? 'Limite atingido — Upgrade →' : 'Ver planos →'}
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="h-1.5 w-full rounded-full bg-amber-200 dark:bg-amber-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isAtLimit ? 'bg-red-500' : 'bg-amber-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
