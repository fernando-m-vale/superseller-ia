'use client';

import { AIRecommendation } from '@/types/ai';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ImpactChartProps {
  recommendations: AIRecommendation[];
}

export function ImpactChart({ recommendations }: ImpactChartProps) {
  const impactData = recommendations.reduce((acc, rec) => {
    const existing = acc.find(item => item.type === rec.type);
    if (existing) {
      existing.count += 1;
      existing.avgScore = (existing.avgScore * (existing.count - 1) + rec.score) / existing.count;
      existing.avgPriority = (existing.avgPriority * (existing.count - 1) + rec.priority) / existing.count;
    } else {
      acc.push({
        type: rec.type,
        count: 1,
        avgScore: rec.score,
        avgPriority: rec.priority,
      });
    }
    return acc;
  }, [] as Array<{ type: string; count: number; avgScore: number; avgPriority: number }>);

  const chartData = impactData.map(item => ({
    name: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    'Recommendations': item.count,
    'Avg Score': parseFloat(item.avgScore.toFixed(2)),
    'Avg Priority': parseFloat((item.avgPriority * 100).toFixed(2)),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Impact Potential by Action Type</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Recommendations" fill="#3b82f6" />
          <Bar dataKey="Avg Score" fill="#10b981" />
          <Bar dataKey="Avg Priority" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
