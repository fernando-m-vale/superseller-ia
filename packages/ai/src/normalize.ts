export function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  
  const validValues = values.filter(v => !isNaN(v) && isFinite(v));
  if (validValues.length === 0) return values.map(() => 0.5);
  
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  
  if (max === min) {
    return values.map(() => 0.5);
  }
  
  return values.map(v => {
    if (isNaN(v) || !isFinite(v)) return 0.5;
    return (v - min) / (max - min);
  });
}

export function calculateMetricScore(
  values: number[],
  weight: number
): number {
  const normalized = minMaxNormalize(values);
  const avg = normalized.reduce((sum, val) => sum + val, 0) / normalized.length;
  return avg * weight;
}
