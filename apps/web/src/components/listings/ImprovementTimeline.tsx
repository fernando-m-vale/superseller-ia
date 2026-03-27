'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ImpactStatus = 'collecting' | 'early' | 'ready';

type ActionImpact = {
  id: string;
  actionKey: string;
  title: string;
  listingTitle?: string;
  listingId: string;
  appliedAt: string | null;
  daysSinceApplied: number | null;
  impactStatus: ImpactStatus;
};

const STATUS_ICON: Record<ImpactStatus, typeof Clock> = {
  collecting: Clock,
  early: TrendingUp,
  ready: CheckCircle,
};

const STATUS_COLOR: Record<ImpactStatus, string> = {
  collecting: 'text-blue-500',
  early: 'text-amber-500',
  ready: 'text-green-500',
};

const STATUS_LABEL: Record<ImpactStatus, string> = {
  collecting: 'Coletando',
  early: 'Dados iniciais',
  ready: 'Pronto',
};

interface ImprovementTimelineProps {
  listingIds: string[];
}

export function ImprovementTimeline({ listingIds }: ImprovementTimelineProps) {
  const [timeline, setTimeline] = useState<ActionImpact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!listingIds.length) { setLoading(false); return; }
    const token = getAccessToken();
    if (!token) { setLoading(false); return; }

    // Fetch action impact for up to 10 listings in parallel
    const idsToFetch = listingIds.slice(0, 10);
    Promise.allSettled(
      idsToFetch.map((id) =>
        fetch(`${getApiBaseUrl()}/listings/${id}/action-impact`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((data) => ({ listingId: id, actions: data.actions ?? [] }))
      )
    )
      .then((results) => {
        const all: ActionImpact[] = [];
        for (const result of results) {
          if (result.status === 'fulfilled') {
            for (const action of result.value.actions) {
              all.push({ ...action, listingId: result.value.listingId });
            }
          }
        }
        // Sort by appliedAt desc
        all.sort((a, b) => {
          if (!a.appliedAt) return 1;
          if (!b.appliedAt) return -1;
          return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
        });
        setTimeline(all.slice(0, 20));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [listingIds]);

  if (loading) return null;
  if (timeline.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Histórico de melhorias</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {timeline.map((item) => {
            const Icon = STATUS_ICON[item.impactStatus];
            return (
              <div key={item.id} className="flex items-start gap-3">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${STATUS_COLOR[item.impactStatus]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-xs font-medium ${STATUS_COLOR[item.impactStatus]}`}>
                      {STATUS_LABEL[item.impactStatus]}
                    </span>
                    {item.daysSinceApplied !== null && (
                      <span className="text-xs text-muted-foreground">
                        {item.daysSinceApplied} dia{item.daysSinceApplied !== 1 ? 's' : ''} atrás
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
