'use client'

import React, { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { getApiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'
import { HackCardUX2, type HackEvidenceItem, type HackRecommendation, type HackAction } from '@/components/hacks/HackCardUX2'
import { computeOpportunityScore } from '@/lib/hacks/opportunityScore'

export interface HackSuggestion {
  id: string
  title: string
  summary: string
  why: string[]
  impact: 'low' | 'medium' | 'high'
  confidence: number
  confidenceLevel: 'low' | 'medium' | 'high'
  evidence: string[]
  suggestedActionUrl?: string | null
  actionGroup?: 'immediate' | 'support' | 'best_practice'
  rootCauseCode?: 'visual_low_ctr' | 'seo_low_discovery' | 'price_low_conversion' | 'trust_low_conversion' | 'logistics_low_conversion' | 'ads_traffic_low_return' | 'content_low_conversion' | 'mixed_signal' | 'insufficient_data'
  // HOTFIX 09.8: categoryId para botão "Ver categoria"
  categoryId?: string | null
  // HOTFIX 09.10: Permalink oficial da categoria (ao invés de inventar URL)
  categoryPermalink?: string | null
}

export interface HacksPanelProps {
  hacks: HackSuggestion[]
  listingId: string
  onFeedback?: (hackId: string, status: 'confirmed' | 'dismissed') => Promise<void>
  // HOTFIX 09.6: Métricas para cálculo de Opportunity Score
  metrics30d?: {
    visits?: number | null
    orders?: number | null
    conversionRate?: number | null
  }
}

export function HacksPanel({ hacks, listingId, onFeedback, metrics30d }: HacksPanelProps) {
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, 'confirmed' | 'dismissed' | null>>({})
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  // HOTFIX 09.7: Carregar histórico de feedback ao montar componente
  useEffect(() => {
    const loadFeedbackHistory = async () => {
      if (!listingId) return
      
      try {
        const apiBaseUrl = getApiBaseUrl()
        const token = getAccessToken()
        
        if (!token) return
        
        const response = await fetch(`${apiBaseUrl}/api/v1/listings/${listingId}/hacks/feedback`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (response.ok) {
          const result = await response.json()
          const history = result.data || []
          
          // Mapear histórico para feedbackStatus
          const statusMap: Record<string, 'confirmed' | 'dismissed' | null> = {}
          history.forEach((item: { hackId: string; status: 'confirmed' | 'dismissed' }) => {
            statusMap[item.hackId] = item.status
          })
          
          setFeedbackStatus(statusMap)
          
          console.log('[HACKS-PANEL] Histórico de feedback carregado', {
            listingId,
            count: history.length,
            hackIds: Object.keys(statusMap),
          })
        }
      } catch (error) {
        console.warn('[HACKS-PANEL] Erro ao carregar histórico de feedback (não crítico):', error)
      }
    }
    
    loadFeedbackHistory()
  }, [listingId])

  if (!hacks || hacks.length === 0) {
    return null
  }

  // HOTFIX 09.6: Calcular Opportunity Score e ordenar hacks
  const hacksWithScore = hacks.map((hack) => {
    const opportunityScore = computeOpportunityScore({
      impact: hack.impact,
      confidence: hack.confidence,
      visits: metrics30d?.visits ?? null,
      orders: metrics30d?.orders ?? null,
      conversionRate: metrics30d?.conversionRate ?? null,
    })
    return {
      ...hack,
      opportunityScore,
    }
  })

  // Ordenação: opportunityScore desc, depois impact desc, depois confidence desc, depois hackId asc
  const sortedHacks = [...hacksWithScore].sort((a, b) => {
    // 1. Opportunity Score (desc)
    if (a.opportunityScore !== b.opportunityScore) {
      return b.opportunityScore - a.opportunityScore
    }
    // 2. Impact (high > medium > low)
    const impactOrder = { high: 3, medium: 2, low: 1 }
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[b.impact] - impactOrder[a.impact]
    }
    // 3. Confidence (desc)
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence
    }
    // 4. Hack ID (asc, para estabilidade)
    return a.id.localeCompare(b.id)
  })

  // HOTFIX 09.8: Separar em "Oportunidades" (não aplicadas) e "Já aplicados"
  const opportunityHacks = sortedHacks.filter((h) => {
    const status = feedbackStatus[h.id] === 'confirmed' ? 'confirmed'
      : feedbackStatus[h.id] === 'dismissed' ? 'dismissed'
      : 'suggested'
    return status === 'suggested'
  })
  
  const confirmedHacks = sortedHacks.filter((h) => feedbackStatus[h.id] === 'confirmed')
  const immediateHacks = opportunityHacks.filter((hack) => hack.actionGroup === 'immediate').slice(0, 3)
  const immediateIds = new Set(immediateHacks.map((hack) => hack.id))
  const supportHacks = opportunityHacks.filter((hack) => !immediateIds.has(hack.id) && hack.actionGroup === 'support')
  const bestPracticeHacks = opportunityHacks.filter((hack) => !immediateIds.has(hack.id) && hack.actionGroup !== 'support')

  /**
   * Transforma evidence string[] em HackEvidenceItem[]
   * Extrai key, label e value de strings como "Categoria atual: Moda > Meias"
   * Melhora formatação de valores numéricos e percentuais
   */
  const parseEvidence = (evidenceStrings: string[]): HackEvidenceItem[] => {
    return evidenceStrings.map((evidence, idx) => {
      // Tentar extrair label: value
      const colonIndex = evidence.indexOf(':')
      if (colonIndex > 0) {
        const label = evidence.substring(0, colonIndex).trim()
        const value = evidence.substring(colonIndex + 1).trim()
        let formatted = value
        
        // Melhorar formatação de valores numéricos
        // Ex: "Visitas (30d): 150" -> "150"
        // Ex: "Conversão atual: 2.50%" -> "2.50%"
        // Ex: "Preço atual: R$ 99.90" -> "R$ 99.90"
        if (value.match(/^\d+$/)) {
          // Número inteiro simples
          formatted = parseInt(value, 10).toLocaleString('pt-BR')
        } else if (value.match(/^\d+\.\d+%$/)) {
          // Percentual
          formatted = value
        } else if (value.match(/R\$\s*\d+/)) {
          // Preço
          formatted = value
        }
        
        return {
          key: `evidence-${idx}`,
          label,
          value,
          formatted,
        }
      }
      // Fallback: usar string completa como value
      return {
        key: `evidence-${idx}`,
        label: 'Evidência',
        value: evidence,
        formatted: evidence,
      }
    })
  }

  /**
   * Extrai diagnóstico e recomendação do hack
   */
  const extractDiagnosisAndRecommendation = (hack: HackSuggestion): {
    diagnosis?: string
    recommendation: HackRecommendation
  } => {
    // Para hacks de categoria, melhorar a recomendação
    if (hack.id === 'ml_category_adjustment') {
      const categoryEvidence = hack.evidence.find(e => e.includes('Categoria atual:'))
      const categoryValue = categoryEvidence?.split(':')[1]?.trim() || ''
      
      // Verificar se há sinais fortes (conversão baixa vs baseline)
      const conversionEvidence = hack.evidence.find(e => e.includes('Conversão atual:'))
      const baselineEvidence = hack.evidence.find(e => e.includes('Baseline'))
      const hasStrongSignals = conversionEvidence && baselineEvidence
      
      // Extrair valores de conversão se disponíveis
      let conversionText = ''
      if (conversionEvidence && baselineEvidence) {
        const convValue = conversionEvidence.split(':')[1]?.trim() || ''
        const baselineValue = baselineEvidence.split(':')[1]?.trim() || ''
        conversionText = `Conversão atual: ${convValue} vs Baseline: ${baselineValue}`
      }
      
      // Determinar recomendação baseada em sinais
      const recommendationText = hasStrongSignals
        ? 'A conversão do anúncio está significativamente abaixo do baseline da categoria. Recomendamos revisar se a categoria está na subcategoria mais específica possível.'
        : 'Recomendamos verificar se a categoria está na subcategoria mais específica possível para melhorar a relevância nas buscas.'
      
      // Se categoryValue contém "não resolvida" ou apenas ID, sugerir verificação
      const needsVerification = categoryValue.includes('não resolvida') || categoryValue.match(/^MLB\d+$/)
      
      return {
        diagnosis: hack.summary,
        recommendation: {
          text: recommendationText,
          suggestion: categoryValue 
            ? (needsVerification 
                ? `Categoria atual: ${categoryValue} (clique para revisar no Mercado Livre)`
                : `Categoria atual: ${categoryValue}`)
            : undefined,
          note: conversionText || 'Uma categoria mais específica pode aumentar a relevância e conversão do anúncio.',
        },
      }
    }
    
    // Para outros hacks, usar summary como recomendação
    return {
      recommendation: {
        text: hack.summary,
        suggestion: hack.why && hack.why.length > 0 ? hack.why[0] : undefined,
        note: hack.why && hack.why.length > 1 ? hack.why.slice(1).join(' ') : undefined,
      },
    }
  }

  const handleFeedback = async (hackId: string, status: 'confirmed' | 'dismissed') => {
    if (isSubmitting[hackId]) return

    setIsSubmitting(prev => ({ ...prev, [hackId]: true }))

    try {
      if (onFeedback) {
        await onFeedback(hackId, status)
      } else {
        // Fallback: chamar API diretamente
        const apiBaseUrl = getApiBaseUrl()
        const token = getAccessToken()
        
        if (!token) {
          throw new Error('Token de autenticação não encontrado')
        }
        
        const response = await fetch(`${apiBaseUrl}/api/v1/listings/${listingId}/hacks/${hackId}/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || 'Erro ao registrar feedback')
        }
        
        // HOTFIX 09.7: Verificar resposta do backend
        const responseData = await response.json().catch(() => ({}))
        console.log('[HACKS-PANEL] Feedback registrado no backend', {
          listingId,
          hackId,
          status,
          response: responseData,
        })
      }

      // HOTFIX 09.7: Atualizar estado local imediatamente após sucesso
      setFeedbackStatus(prev => ({ ...prev, [hackId]: status }))
      
      // HOTFIX 09.7: Log de confirmação
      console.log('[HACKS-PANEL] Estado local atualizado', {
        listingId,
        hackId,
        status,
        timestamp: new Date().toISOString(),
      })
      
      toast({
        title: status === 'confirmed' ? 'Hack confirmado' : 'Hack descartado',
        description: status === 'confirmed' 
          ? 'Este hack não será mais sugerido para este anúncio.'
          : 'Este hack não será sugerido novamente por 30 dias.',
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao registrar feedback',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(prev => ({ ...prev, [hackId]: false }))
    }
  }

  /**
   * Transforma hack em props do HackCardUX2
   */
  const transformHackToCardProps = (hack: HackSuggestion & { opportunityScore?: number }, priorityRank: number) => {
    const status: 'suggested' | 'confirmed' | 'dismissed' = 
      feedbackStatus[hack.id] === 'confirmed' ? 'confirmed'
      : feedbackStatus[hack.id] === 'dismissed' ? 'dismissed'
      : 'suggested'
    
    const evidenceItems = parseEvidence(hack.evidence || [])
    const { diagnosis, recommendation } = extractDiagnosisAndRecommendation(hack)
    
    // Ações (CTAs)
    const actions: HackAction[] = []
    if (hack.suggestedActionUrl) {
      actions.push({
        label: 'Abrir no Mercado Livre',
        url: hack.suggestedActionUrl,
        variant: 'outline',
      })
    }
    // HOTFIX 09.10: Adicionar botão "Ver categoria" usando permalink oficial
    if (hack.id === 'ml_category_adjustment' && hack.categoryPermalink) {
      // Usar permalink oficial do ML (não inventar URL)
      actions.push({
        label: 'Ver categoria no Mercado Livre',
        url: hack.categoryPermalink,
        variant: 'secondary',
      })
    } else if (hack.id === 'ml_category_adjustment' && hack.categoryId) {
      // Fallback: se não houver permalink, não renderizar botão (ou renderizar disabled)
      // HOTFIX 09.10: Não inventar URL, apenas logar que permalink não está disponível
      console.warn('[HACKS-PANEL] categoryPermalink não disponível para hack de categoria', {
        hackId: hack.id,
        categoryId: hack.categoryId,
      })
    }
    
    return {
      title: hack.title,
      summary: hack.summary,
      impact: hack.impact,
      confidence: hack.confidence,
      confidenceLevel: hack.confidenceLevel,
      evidence: evidenceItems,
      diagnosis,
      recommendation,
      requires: undefined, // TODO: extrair de blocking se disponível
      status,
      onConfirm: () => handleFeedback(hack.id, 'confirmed'),
      onDismiss: () => handleFeedback(hack.id, 'dismissed'),
      actions,
      opportunityScore: hack.opportunityScore,
      priorityRank,
      isLoading: isSubmitting[hack.id] || false,
    }
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg">🚀 Hacks Mercado Livre</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {immediateHacks.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="text-primary">Fazer agora</span>
            </div>
            {immediateHacks.map((hack, idx) => (
              <HackCardUX2
                key={hack.id}
                {...transformHackToCardProps(hack, idx + 1)}
              />
            ))}
          </div>
        )}

        {supportHacks.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mt-6">
              <span>Melhorias de suporte</span>
            </div>
            {supportHacks.map((hack, idx) => (
              <HackCardUX2
                key={hack.id}
                {...transformHackToCardProps(hack, immediateHacks.length + idx + 1)}
              />
            ))}
          </div>
        )}

        {bestPracticeHacks.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mt-6">
              <span>Boas práticas</span>
            </div>
            {bestPracticeHacks.map((hack, idx) => (
              <HackCardUX2
                key={hack.id}
                {...transformHackToCardProps(hack, immediateHacks.length + supportHacks.length + idx + 1)}
              />
            ))}
          </div>
        )}

        {/* Hacks confirmados (já aplicados) */}
        {confirmedHacks.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mt-6">
              <span>Já aplicados</span>
            </div>
            {confirmedHacks.map((hack, idx) => (
              <HackCardUX2
                key={hack.id}
                {...transformHackToCardProps(hack, sortedHacks.length + idx + 1)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
