export function formatConversionRatePercent(
  conversionRateDecimal?: number | null,
  decimals = 2
): string | null {
  if (
    typeof conversionRateDecimal !== 'number' ||
    Number.isNaN(conversionRateDecimal) ||
    !Number.isFinite(conversionRateDecimal)
  ) {
    return null;
  }

  const factor = 10 ** decimals;
  const percentage = Math.round(conversionRateDecimal * 100 * factor) / factor;
  return `${percentage.toFixed(decimals)}%`;
}

export function conversionRateToPercentValue(
  conversionRateDecimal?: number | null
): number | null {
  if (
    typeof conversionRateDecimal !== 'number' ||
    Number.isNaN(conversionRateDecimal) ||
    !Number.isFinite(conversionRateDecimal)
  ) {
    return null;
  }

  return conversionRateDecimal * 100;
}

