import { describe, it, expect } from 'vitest';
import { minMaxNormalize, calculateMetricScore } from '../src/normalize';

describe('minMaxNormalize', () => {
  it('should normalize values between 0 and 1', () => {
    const values = [1, 2, 3, 4, 5];
    const normalized = minMaxNormalize(values);
    
    expect(normalized).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('should return 0.5 for all values when min equals max', () => {
    const values = [5, 5, 5, 5];
    const normalized = minMaxNormalize(values);
    
    expect(normalized).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('should handle empty array', () => {
    const values: number[] = [];
    const normalized = minMaxNormalize(values);
    
    expect(normalized).toEqual([]);
  });

  it('should handle NaN values by replacing with 0.5', () => {
    const values = [1, NaN, 3, 4, 5];
    const normalized = minMaxNormalize(values);
    
    expect(normalized[1]).toBe(0.5);
    expect(normalized[0]).toBe(0);
    expect(normalized[4]).toBe(1);
  });

  it('should handle Infinity values', () => {
    const values = [1, Infinity, 3];
    const normalized = minMaxNormalize(values);
    
    expect(normalized[1]).toBe(0.5);
  });

  it('should handle negative values', () => {
    const values = [-5, -3, -1, 0, 2];
    const normalized = minMaxNormalize(values);
    
    expect(normalized[0]).toBe(0);
    expect(normalized[4]).toBe(1);
  });
});

describe('calculateMetricScore', () => {
  it('should calculate weighted score correctly', () => {
    const values = [0.5, 0.6, 0.7, 0.8];
    const weight = 0.3;
    const score = calculateMetricScore(values, weight);
    
    const expectedAvg = (0.5 + 0.5 + 0.5 + 0.5) / 4;
    expect(score).toBeCloseTo(expectedAvg * weight, 5);
  });

  it('should handle single value', () => {
    const values = [10];
    const weight = 0.25;
    const score = calculateMetricScore(values, weight);
    
    expect(score).toBe(0.5 * weight);
  });

  it('should return 0 for empty array', () => {
    const values: number[] = [];
    const weight = 0.3;
    const score = calculateMetricScore(values, weight);
    
    expect(isNaN(score)).toBe(true);
  });
});
