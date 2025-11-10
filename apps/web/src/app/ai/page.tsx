'use client';

import { useEffect, useState } from 'react';
import { AIRecommendation, ActionStatus, AIRecommendationsResponse } from '@/types/ai';
import { RecommendationsTable } from './components/RecommendationsTable';
import { ImpactChart } from './components/ImpactChart';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function AIRecommendationsPage() {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedRecommendations = localStorage.getItem('ai-recommendations');
    if (savedRecommendations) {
      try {
        setRecommendations(JSON.parse(savedRecommendations));
      } catch (e) {
        console.error('Failed to parse saved recommendations:', e);
      }
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/ai/recommendations?days=7`, {
        headers: {
          'x-tenant-id': 'demo-tenant',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
      }

      const data: AIRecommendationsResponse = await response.json();

      const enrichedRecommendations: AIRecommendation[] = data.items.map((item, index) => ({
        ...item,
        id: `${item.listingId}-${item.type}-${index}`,
        status: 'pending' as ActionStatus,
        createdAt: data.generatedAt,
      }));

      const savedRecommendations = localStorage.getItem('ai-recommendations');
      if (savedRecommendations) {
        try {
          const saved: AIRecommendation[] = JSON.parse(savedRecommendations);
          const savedMap = new Map(saved.map(r => [r.id, r]));

          enrichedRecommendations.forEach(rec => {
            const savedRec = savedMap.get(rec.id);
            if (savedRec) {
              rec.status = savedRec.status;
            }
          });
        } catch (e) {
          console.error('Failed to merge saved recommendations:', e);
        }
      }

      setRecommendations(enrichedRecommendations);
      localStorage.setItem('ai-recommendations', JSON.stringify(enrichedRecommendations));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const updatedRecommendations = recommendations.map(rec =>
      rec.id === id ? { ...rec, status: 'approved' as ActionStatus } : rec
    );
    setRecommendations(updatedRecommendations);
    localStorage.setItem('ai-recommendations', JSON.stringify(updatedRecommendations));

    try {
      await fetch(`${API_URL}/ai/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo-tenant',
        },
        body: JSON.stringify({
          recommendationId: id,
          action: 'approve',
        }),
      });
    } catch (err) {
      console.error('Failed to sync approval to backend:', err);
    }
  };

  const handleReject = async (id: string) => {
    const updatedRecommendations = recommendations.map(rec =>
      rec.id === id ? { ...rec, status: 'rejected' as ActionStatus } : rec
    );
    setRecommendations(updatedRecommendations);
    localStorage.setItem('ai-recommendations', JSON.stringify(updatedRecommendations));

    try {
      await fetch(`${API_URL}/ai/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo-tenant',
        },
        body: JSON.stringify({
          recommendationId: id,
          action: 'reject',
        }),
      });
    } catch (err) {
      console.error('Failed to sync rejection to backend:', err);
    }
  };

  const handleExecute = async (id: string) => {
    const updatedRecommendations = recommendations.map(rec =>
      rec.id === id ? { ...rec, status: 'executed' as ActionStatus } : rec
    );
    setRecommendations(updatedRecommendations);
    localStorage.setItem('ai-recommendations', JSON.stringify(updatedRecommendations));

    try {
      await fetch(`${API_URL}/ai/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo-tenant',
        },
        body: JSON.stringify({
          recommendationId: id,
          action: 'execute',
        }),
      });
    } catch (err) {
      console.error('Failed to sync execution to backend:', err);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">AI Recommendations</h1>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading recommendations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">AI Recommendations</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchRecommendations}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">AI Recommendations</h1>

      <div className="mb-8">
        <ImpactChart recommendations={recommendations} />
      </div>

      <RecommendationsTable
        recommendations={recommendations}
        onApprove={handleApprove}
        onReject={handleReject}
        onExecute={handleExecute}
      />
    </div>
  );
}
