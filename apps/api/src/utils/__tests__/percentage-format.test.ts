import { describe, expect, it } from 'vitest';
import { formatConversionRatePercent } from '../percentage-format';

describe('percentage-format', () => {
  it('formata conversionRate decimal para percentual com arredondamento consistente', () => {
    expect(formatConversionRatePercent(0.0185)).toBe('1.85%');
  });
});

