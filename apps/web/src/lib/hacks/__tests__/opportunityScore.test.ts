/**
 * Unit tests para Opportunity Score Helper - HOTFIX 09.6
 */

import { describe, it, expect } from 'vitest'
import {
  computeImpactScore,
  computeGapScore,
  computeOpportunityScore,
  getOpportunityLabel,
  getOpportunityBadgeVariant,
} from '../opportunityScore'

describe('computeImpactScore', () => {
  it('retorna 90 para high', () => {
    expect(computeImpactScore('high')).toBe(90)
  })

  it('retorna 65 para medium', () => {
    expect(computeImpactScore('medium')).toBe(65)
  })

  it('retorna 35 para low', () => {
    expect(computeImpactScore('low')).toBe(35)
  })
})

describe('computeGapScore', () => {
  it('retorna score alto para anúncio com muitas visitas, baixa conversão e zero pedidos', () => {
    const score = computeGapScore({
      visits: 300,
      orders: 0,
      conversionRate: 0.005, // 0.5%
    })
    // visitsScore: 40 + crPenaltyScore: 40 + ordersScore: 20 = 100 (clamped)
    expect(score).toBeGreaterThanOrEqual(80)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('retorna score baixo para anúncio com poucas visitas, boa conversão e muitos pedidos', () => {
    const score = computeGapScore({
      visits: 80,
      orders: 20,
      conversionRate: 0.04, // 4%
    })
    // visitsScore: 5 + crPenaltyScore: 5 + ordersScore: 2 = 12
    expect(score).toBeLessThan(20)
  })

  it('lida com valores null/undefined corretamente', () => {
    const score1 = computeGapScore({
      visits: null,
      orders: null,
      conversionRate: null,
    })
    // visitsScore: 5 + crPenaltyScore: 5 + ordersScore: 2 = 12
    expect(score1).toBe(12)

    const score2 = computeGapScore({
      visits: undefined,
      orders: undefined,
      conversionRate: undefined,
    })
    expect(score2).toBe(12)
  })

  it('retorna score médio para cenário intermediário', () => {
    const score = computeGapScore({
      visits: 200,
      orders: 5,
      conversionRate: 0.015, // 1.5%
    })
    // visitsScore: 30 + crPenaltyScore: 25 + ordersScore: 6 = 61
    expect(score).toBeGreaterThan(40)
    expect(score).toBeLessThan(80)
  })
})

describe('computeOpportunityScore', () => {
  it('calcula score alto para hack high impact, alta confidence e gap alto', () => {
    const score = computeOpportunityScore({
      impact: 'high',
      confidence: 80,
      visits: 300,
      orders: 0,
      conversionRate: 0.005,
    })
    // impactScore: 90 * 0.45 = 40.5
    // confidence: 80 * 0.35 = 28
    // gapScore: ~100 * 0.20 = 20
    // Total: ~88.5
    expect(score).toBeGreaterThanOrEqual(75)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('calcula score baixo para hack low impact, baixa confidence e gap baixo', () => {
    const score = computeOpportunityScore({
      impact: 'low',
      confidence: 20,
      visits: 50,
      orders: 15,
      conversionRate: 0.05,
    })
    // impactScore: 35 * 0.45 = 15.75
    // confidence: 20 * 0.35 = 7
    // gapScore: ~12 * 0.20 = 2.4
    // Total: ~25
    expect(score).toBeLessThan(50)
  })

  it('clamp funciona corretamente (não excede 0-100)', () => {
    const score1 = computeOpportunityScore({
      impact: 'high',
      confidence: 100,
      visits: 1000,
      orders: 0,
      conversionRate: 0.001,
    })
    expect(score1).toBeGreaterThanOrEqual(0)
    expect(score1).toBeLessThanOrEqual(100)

    const score2 = computeOpportunityScore({
      impact: 'low',
      confidence: 0,
      visits: 0,
      orders: 100,
      conversionRate: 0.1,
    })
    expect(score2).toBeGreaterThanOrEqual(0)
    expect(score2).toBeLessThanOrEqual(100)
  })
})

describe('getOpportunityLabel', () => {
  it('retorna "🔥 Alta oportunidade" para score >= 75', () => {
    expect(getOpportunityLabel(75)).toBe('🔥 Alta oportunidade')
    expect(getOpportunityLabel(100)).toBe('🔥 Alta oportunidade')
    expect(getOpportunityLabel(80)).toBe('🔥 Alta oportunidade')
  })

  it('retorna "Boa oportunidade" para score 50-74', () => {
    expect(getOpportunityLabel(50)).toBe('Boa oportunidade')
    expect(getOpportunityLabel(74)).toBe('Boa oportunidade')
    expect(getOpportunityLabel(60)).toBe('Boa oportunidade')
  })

  it('retorna "Oportunidade baixa (revisar contexto)" para score < 50', () => {
    expect(getOpportunityLabel(49)).toBe('Oportunidade baixa (revisar contexto)')
    expect(getOpportunityLabel(0)).toBe('Oportunidade baixa (revisar contexto)')
    expect(getOpportunityLabel(30)).toBe('Oportunidade baixa (revisar contexto)')
  })
})

describe('getOpportunityBadgeVariant', () => {
  it('retorna "default" para score >= 75', () => {
    expect(getOpportunityBadgeVariant(75)).toBe('default')
    expect(getOpportunityBadgeVariant(100)).toBe('default')
  })

  it('retorna "secondary" para score 50-74', () => {
    expect(getOpportunityBadgeVariant(50)).toBe('secondary')
    expect(getOpportunityBadgeVariant(74)).toBe('secondary')
  })

  it('retorna "outline" para score < 50', () => {
    expect(getOpportunityBadgeVariant(49)).toBe('outline')
    expect(getOpportunityBadgeVariant(0)).toBe('outline')
  })
})
