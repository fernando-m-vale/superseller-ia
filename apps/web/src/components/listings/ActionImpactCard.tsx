'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Clock, TrendingUp, BarChart2 } from 'lucide-react';

type ImpactStatus = 'collecting' | 'early' | 'ready';

type ActionImpact = {
  id: string;
  actionKey: string;
  title: string;
  appliedAt: string | null;
  daysSinceApplied: number | null;
  impactStatus: ImpactStatus;
};

const STATUS_CONFIG: Record<ImpactStatus, {
  label: string;
  color: string;
  bg: string;
  icon: typeof Clock;
  description: string;
}> = {
  collecting: {
    label: 'Coletando dados',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: Clock,
    description: 'Aguardando dados suficientes (< 3 dias)',
  },
  early: {
    label: 'Dados iniciais',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    icon: BarChart2,
    description: 'Primeiros sinais disponíveis (3–7 dias)',
  },
  ready: {
    label: 'Pronto para avaliar',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    icon: TrendingUp,
    description: 'Dados suficientes para avaliar impacto (≥ 7 dias)',
  },
};

interface ActionImpactCardProps {
  listingId: string;
}

export function ActionImpactCard({ listingId }: ActionImpactCardProps) {
  const [actions, setActions] = useState<ActionImpact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setLoading(false); return; }

    fetch(`${getApiBaseUrl()}/listings/${listingId}/action-impact`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setActions(data.actions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [listingId]);

  if (loading) return null;
  if (actions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Ações aplicadas
      </p>
      {actions.map((action) => {
        const cfg = STATUS_CONFIG[action.impactStatus];
        const Icon = cfg.icon;
        return (
          <div
            key={action.id}
            className={`flex items-start gap-3 rounded-lg border p-3 ${cfg.bg}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{action.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                {action.daysSinceApplied !== null && (
                  <span className="text-xs text-muted-foreground">
                    · {action.daysSinceApplied} dia{action.daysSinceApplied !== 1 ? 's' : ''} atrás
                  </span>
                )}
                {action.appliedAt && (
                  <span className="text-xs text-muted-foreground">
                    · {new Date(action.appliedAt).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
