import * as tf from '@tensorflow/tfjs-node';
import {
  ListingDailyMetric,
  RecommendedAction,
  RecommendationScore,
  RecommendationInput,
} from './types';
import { calculateMetricScore } from './normalize';
  ActionType,
} from './types';
import { minMaxNormalize, calculateMetricScore } from './normalize';

const DEFAULT_WEIGHTS = {
  ctr: 0.3,
  conversion: 0.3,
  revenue: 0.25,
  orders: 0.15,
};

export function filterMetricsByWindow(
  metrics: ListingDailyMetric[],
  windowDays: number
): ListingDailyMetric[] {
  if (metrics.length === 0) return [];
  
  const sortedMetrics = [...metrics].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const latestDate = new Date(sortedMetrics[sortedMetrics.length - 1].date);
  const cutoffDate = new Date(latestDate);
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);
  
  return sortedMetrics.filter(m => new Date(m.date) >= cutoffDate);
}

export function groupMetricsByListing(
  metrics: ListingDailyMetric[]
): Map<string, ListingDailyMetric[]> {
  const grouped = new Map<string, ListingDailyMetric[]>();
  
  for (const metric of metrics) {
    if (!grouped.has(metric.listingId)) {
      grouped.set(metric.listingId, []);
    }
    grouped.get(metric.listingId)!.push(metric);
  }
  
  return grouped;
}

export function calculateRecommendationScores(
  listingMetrics: ListingDailyMetric[],
  weights = DEFAULT_WEIGHTS
): RecommendationScore | null {
  if (listingMetrics.length === 0) return null;
  
  const listingId = listingMetrics[0].listingId;
  
  const ctrs = listingMetrics.map(m => m.ctr);
  const conversions = listingMetrics.map(m => m.conversion);
  const revenues = listingMetrics.map(m => m.gmv);
  const orders = listingMetrics.map(m => m.orders);
  
  const validCtrs = ctrs.filter(v => !isNaN(v) && v >= 0);
  const validConversions = conversions.filter(v => !isNaN(v) && v >= 0);
  const validRevenues = revenues.filter(v => !isNaN(v) && v >= 0);
  const validOrders = orders.filter(v => !isNaN(v) && v >= 0);
  
  if (validCtrs.length === 0 || validConversions.length === 0 || 
      validRevenues.length === 0 || validOrders.length === 0) {
    return null;
  }
  
  const ctrScore = calculateMetricScore(validCtrs, weights.ctr);
  const conversionScore = calculateMetricScore(validConversions, weights.conversion);
  const revenueScore = calculateMetricScore(validRevenues, weights.revenue);
  const ordersScore = calculateMetricScore(validOrders, weights.orders);
  
  const overallScore = ctrScore + conversionScore + revenueScore + ordersScore;
  
  return {
    listingId,
    overallScore: Math.round(overallScore * 10000) / 100,
    ctrScore: Math.round(ctrScore * 10000) / 100,
    conversionScore: Math.round(conversionScore * 10000) / 100,
    revenueScore: Math.round(revenueScore * 10000) / 100,
    ordersScore: Math.round(ordersScore * 10000) / 100,
  };
}

export function generateRecommendations(
  score: RecommendationScore,
  listingMetrics: ListingDailyMetric[]
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const avgCtr = listingMetrics.reduce((sum, m) => sum + m.ctr, 0) / listingMetrics.length;
  const avgConversion = listingMetrics.reduce((sum, m) => sum + m.conversion, 0) / listingMetrics.length;
  const avgOrders = listingMetrics.reduce((sum, m) => sum + m.orders, 0) / listingMetrics.length;
  const totalRevenue = listingMetrics.reduce((sum, m) => sum + m.gmv, 0);
  
  if (avgCtr < 0.03 || score.ctrScore < 20) {
    actions.push({
      listingId: score.listingId,
      type: 'title',
      priority: 0.9,
      score: score.ctrScore,
      impact: 'high',
      effort: 'low',
      rationale: `Low CTR (${(avgCtr * 100).toFixed(2)}%) indicates title optimization needed. Improve keywords and clarity.`,
      payload: { currentCtr: avgCtr, targetCtr: avgCtr * 1.5 },
    });
  }
  
  if (avgCtr < 0.03 || score.ctrScore < 20) {
    actions.push({
      listingId: score.listingId,
      type: 'image',
      priority: 0.85,
      score: score.ctrScore,
      impact: 'high',
      effort: 'medium',
      rationale: `Low CTR suggests image quality issues. Professional images can increase CTR by 30-50%.`,
      payload: { currentCtr: avgCtr },
    });
  }
  
  if (avgConversion < 0.02 || score.conversionScore < 20) {
    actions.push({
      listingId: score.listingId,
      type: 'price',
      priority: 0.8,
      score: score.conversionScore,
      impact: 'high',
      effort: 'low',
      rationale: `Low conversion rate (${(avgConversion * 100).toFixed(2)}%) may indicate pricing issues. Review competitive pricing.`,
      payload: { currentConversion: avgConversion },
    });
  }
  
  if (avgConversion < 0.025 || score.conversionScore < 25) {
    actions.push({
      listingId: score.listingId,
      type: 'attributes',
      priority: 0.75,
      score: score.conversionScore,
      impact: 'medium',
      effort: 'low',
      rationale: `Incomplete attributes reduce buyer confidence. Complete all required fields.`,
      payload: { currentConversion: avgConversion },
    });
  }
  
  if (avgOrders < 2 || score.ordersScore < 15) {
    actions.push({
      listingId: score.listingId,
      type: 'stock',
      priority: 0.7,
      score: score.ordersScore,
      impact: 'medium',
      effort: 'low',
      rationale: `Low order volume (${avgOrders.toFixed(1)}/day) suggests visibility issues. Check stock levels and availability.`,
      payload: { avgOrders, totalRevenue },
    });
  }
  
  return actions.sort((a, b) => b.priority - a.priority);
}

export async function trainMockModel(
  metrics: ListingDailyMetric[]
): Promise<tf.LayersModel> {
  const features: number[][] = [];
  const labels: number[] = [];
  
  for (const metric of metrics) {
    features.push([
      metric.ctr,
      metric.conversion,
      metric.gmv,
      metric.orders,
    ]);
    
    const score = (metric.ctr * 0.3) + (metric.conversion * 0.3) + 
                  (metric.gmv / 1000 * 0.25) + (metric.orders * 0.15);
    labels.push(score);
  }
  
  const xs = tf.tensor2d(features);
  const ys = tf.tensor1d(labels);
  
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [4], units: 8, activation: 'relu' }),
      tf.layers.dense({ units: 1 }),
    ],
  });
  
  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'meanSquaredError',
  });
  
  await model.fit(xs, ys, {
    epochs: 50,
    verbose: 0,
  });
  
  xs.dispose();
  ys.dispose();
  
  return model;
}

export function recommendActions(
  input: RecommendationInput
): RecommendedAction[] {
  const { metrics, windowDays = 7, minDays = 3 } = input;
  
  if (metrics.length === 0) return [];
  
  const filteredMetrics = filterMetricsByWindow(metrics, windowDays);
  
  if (filteredMetrics.length < minDays) {
    return [];
  }
  
  const groupedMetrics = groupMetricsByListing(filteredMetrics);
  const allActions: RecommendedAction[] = [];
  
  for (const [, listingMetrics] of groupedMetrics) {
  for (const [listingId, listingMetrics] of groupedMetrics) {
    if (listingMetrics.length < minDays) continue;
    
    const score = calculateRecommendationScores(listingMetrics);
    if (!score) continue;
    
    const recommendations = generateRecommendations(score, listingMetrics);
    allActions.push(...recommendations);
  }
  
  return allActions.sort((a, b) => b.priority - a.priority);
}
