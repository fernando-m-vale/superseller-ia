export type ListingDailyMetric = {
  date: string;
  impressions: number;
  visits: number;
  orders: number;
  revenue: number;
};

export type HealthScoreOptions = {
  weights?: { ctr?: number; cvr?: number; revenue?: number; orders?: number };
  windowDays?: number;
  minDays?: number;
};

const DEFAULT_WEIGHTS = { ctr: 0.30, cvr: 0.30, revenue: 0.25, orders: 0.15 };
const DEFAULT_MIN_DAYS = 3;

function isValidMetric(metric: ListingDailyMetric): boolean {
  const timestamp = new Date(metric.date).getTime();
  return (
    !isNaN(timestamp) &&
    typeof metric.impressions === 'number' && metric.impressions >= 0 &&
    typeof metric.visits === 'number' && metric.visits >= 0 &&
    typeof metric.orders === 'number' && metric.orders >= 0 &&
    typeof metric.revenue === 'number' && metric.revenue >= 0
  );
}

function normalizeArray(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  if (max === min) {
    return values.map(() => 0.5);
  }
  
  return values.map(v => (v - min) / (max - min));
}

export function healthScore(
  metrics: ListingDailyMetric[],
  opts?: HealthScoreOptions
): number | null {
  if (!metrics || metrics.length === 0) {
    return null;
  }

  const validMetrics = metrics.filter(isValidMetric);
  
  if (validMetrics.length === 0) {
    return null;
  }

  const sortedMetrics = [...validMetrics].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const windowDays = opts?.windowDays;
  const windowedMetrics = windowDays
    ? sortedMetrics.slice(-windowDays)
    : sortedMetrics;

  const minDays = opts?.minDays ?? DEFAULT_MIN_DAYS;
  if (windowedMetrics.length < minDays) {
    return null;
  }

  const weights = {
    ctr: opts?.weights?.ctr ?? DEFAULT_WEIGHTS.ctr,
    cvr: opts?.weights?.cvr ?? DEFAULT_WEIGHTS.cvr,
    revenue: opts?.weights?.revenue ?? DEFAULT_WEIGHTS.revenue,
    orders: opts?.weights?.orders ?? DEFAULT_WEIGHTS.orders,
  };

  const weightSum = weights.ctr + weights.cvr + weights.revenue + weights.orders;
  const normalizedWeights = {
    ctr: weights.ctr / weightSum,
    cvr: weights.cvr / weightSum,
    revenue: weights.revenue / weightSum,
    orders: weights.orders / weightSum,
  };

  const ctrValues = windowedMetrics.map(m => 
    m.impressions > 0 ? m.visits / m.impressions : 0
  );
  const cvrValues = windowedMetrics.map(m => 
    m.visits > 0 ? m.orders / m.visits : 0
  );
  const revenueValues = windowedMetrics.map(m => m.revenue);
  const ordersValues = windowedMetrics.map(m => m.orders);

  const normalizedCtr = normalizeArray(ctrValues);
  const normalizedCvr = normalizeArray(cvrValues);
  const normalizedRevenue = normalizeArray(revenueValues);
  const normalizedOrders = normalizeArray(ordersValues);

  const dailyScores = windowedMetrics.map((_, i) => {
    return (
      normalizedWeights.ctr * normalizedCtr[i] +
      normalizedWeights.cvr * normalizedCvr[i] +
      normalizedWeights.revenue * normalizedRevenue[i] +
      normalizedWeights.orders * normalizedOrders[i]
    );
  });

  const avgScore = dailyScores.reduce((sum, s) => sum + s, 0) / dailyScores.length;
  
  return Math.round(avgScore * 10000) / 100;
}
