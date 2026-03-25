'use client';
import { useBilling } from '@/hooks/use-billing';
import { useRouter } from 'next/navigation';
import { Clock, Zap } from 'lucide-react';

export function TrialBanner() {
  const { isTrialing, isFree, trialDaysLeft, startCheckout } = useBilling();
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

  // Plano Free — mostrar banner de upgrade
  if (isFree) {
    return (
      <div className="flex items-center justify-between px-4 py-2 text-sm rounded-lg mb-4
        bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 shrink-0" />
          Plano gratuito — 3 análises/mês. Análises ilimitadas no Pro.
        </div>
        <button
          onClick={() => router.push('/upgrade')}
          className="ml-4 font-semibold underline hover:no-underline shrink-0"
        >
          Ver planos →
        </button>
      </div>
    );
  }

  return null;
}
