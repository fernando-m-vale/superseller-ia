'use client'

import React, { useState } from 'react'
import { Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { getApiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'
import { HackCardUX2, type HackEvidenceItem, type HackRecommendation, type HackAction } from '@/components/hacks/HackCardUX2'

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
}

export interface HacksPanelProps {
  hacks: HackSuggestion[]
  listingId: string
  onFeedback?: (hackId: string, status: 'confirmed' | 'dismissed') => Promise<void>
}

export function HacksPanel({ hacks, listingId, onFeedback }: HacksPanelProps) {
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, 'confirmed' | 'dismissed' | null>>({})
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  if (!hacks || hacks.length === 0) {
    return null
  }

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
      }

      setFeedbackStatus(prev => ({ ...prev, [hackId]: status }))
      
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
  const transformHackToCardProps = (hack: HackSuggestion, index: number) => {
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
      priorityRank: index + 1,
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
        {hacks.map((hack, index) => (
          <HackCardUX2
            key={hack.id}
            {...transformHackToCardProps(hack, index)}
          />
        ))}
      </CardContent>
    </Card>
  )
}
