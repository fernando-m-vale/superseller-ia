'use client'

import React, { useState } from 'react'
import { Zap, CheckCircle2, XCircle, TrendingUp, AlertCircle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { getApiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

export interface HackSuggestion {
  id: string
  title: string
  summary: string
  why: string[]
  impact: 'low' | 'medium' | 'high'
  confidence: number
  confidenceLevel: 'low' | 'medium' | 'high'
  evidence: string[]
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

  const getImpactColor = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
  }

  const getConfidenceColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-300'
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
        {hacks.map((hack) => {
          const status = feedbackStatus[hack.id]
          const isDisabled = status !== null || isSubmitting[hack.id]

          return (
            <Card 
              key={hack.id} 
              className={`bg-gradient-to-r from-primary/5 to-primary/10 border-l-4 ${
                status === 'confirmed' 
                  ? 'border-l-green-500 opacity-60' 
                  : status === 'dismissed'
                  ? 'border-l-gray-400 opacity-60'
                  : 'border-l-primary'
              }`}
            >
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {/* Header com título e badges */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-base text-foreground mb-2">{hack.title}</h4>
                      <p className="text-sm text-muted-foreground mb-3">{hack.summary}</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge className={getImpactColor(hack.impact)}>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Impacto: {hack.impact === 'high' ? 'Alto' : hack.impact === 'medium' ? 'Médio' : 'Baixo'}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Badge className={getConfidenceColor(hack.confidenceLevel)}>
                          {hack.confidence}% {hack.confidenceLevel === 'high' ? 'Alta' : hack.confidenceLevel === 'medium' ? 'Média' : 'Baixa'}
                        </Badge>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-full p-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                                aria-label="Informações sobre Confidence"
                              >
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-2">
                                <p className="font-semibold">Confidence (Confiança)</p>
                                <p className="text-sm">
                                  A confiança do sistema na recomendação, baseada nos dados do anúncio (visitas, conversão, preço, mídia etc.).
                                </p>
                                <div className="text-xs space-y-1 pt-2 border-t">
                                  <p><strong>Alta (≥70%):</strong> Recomendação muito confiável</p>
                                  <p><strong>Média (40-69%):</strong> Recomendação moderadamente confiável</p>
                                  <p><strong>Baixa (0-39%):</strong> Recomendação com baixa confiança</p>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>

                  {/* Por que aplicar */}
                  {hack.why && hack.why.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        Por que aplicar:
                      </div>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-4">
                        {hack.why.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Evidências */}
                  {hack.evidence && hack.evidence.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">Evidências:</div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {hack.evidence.map((evidence, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-primary" />
                            {evidence}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Botões de ação */}
                  {/* HOTFIX 09.3: onClickCapture para evitar que accordion capture clique */}
                  <div 
                    className="flex gap-2"
                    onClickCapture={(e) => {
                      e.stopPropagation()
                    }}
                    onPointerDownCapture={(e) => {
                      e.stopPropagation()
                    }}
                    onMouseDownCapture={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    {status === 'confirmed' ? (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Implementado</span>
                      </div>
                    ) : status === 'dismissed' ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <XCircle className="h-4 w-4" />
                        <span>Não se aplica</span>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onPointerDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleFeedback(hack.id, 'confirmed')
                          }}
                          disabled={isDisabled}
                          className="flex-1 relative z-20 pointer-events-auto"
                          type="button"
                        >
                          {isSubmitting[hack.id] ? (
                            <>
                              <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Processando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Confirmar implementação
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onPointerDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleFeedback(hack.id, 'dismissed')
                          }}
                          disabled={isDisabled}
                          className="flex-1 relative z-20 pointer-events-auto"
                          type="button"
                        >
                          {isSubmitting[hack.id] ? (
                            <>
                              <div className="h-4 w-4 mr-2 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                              Processando...
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Não se aplica
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </CardContent>
    </Card>
  )
}
