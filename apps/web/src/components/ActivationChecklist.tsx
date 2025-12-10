'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { loadChecklistState, saveChecklistState } from '@/lib/storage'
import { ChecklistState, INITIAL_CHECKLIST_STATE } from '@/types/onboarding'
import { getMercadoLivreAuthUrl, getMercadoLivreHealth } from '@/lib/marketplaces'
import { api } from '@/lib/axios'

type ChecklistItemKey = keyof ChecklistState['completed']

interface ChecklistItem {
  key: ChecklistItemKey
  title: string
  description: string
  cta?: {
    label: string
    href: string
  }
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    key: 'connectMarketplace',
    title: 'Conectar conta Shopee ou Mercado Livre',
    description: 'Vincule sua conta de marketplace para começar a sincronizar anúncios',
  },
  {
    key: 'createFirstListing',
    title: 'Sincronizar anúncios',
    description: 'Sincronize seus anúncios para análise',
  },
  {
    key: 'validateInitialMetrics',
    title: 'Validar métricas iniciais',
    description: 'Aguarde a coleta das primeiras métricas de vendas',
  },
  {
    key: 'enableAutoRecommendations',
    title: 'Ativar recomendações automáticas',
    description: 'Habilite sugestões inteligentes para otimizar seus anúncios',
    cta: {
      label: 'Ver recomendações',
      href: '/ai',
    },
  },
]

export function ActivationChecklist() {
  const [state, setState] = useState<ChecklistState>(INITIAL_CHECKLIST_STATE)
  const [isClient, setIsClient] = useState(false)
  const [mlConnecting, setMlConnecting] = useState(false)
  const [mlConnected, setMlConnected] = useState(false)
  const [mlError, setMlError] = useState<string | null>(null)
  const [mlNickname, setMlNickname] = useState<string | null>(null)

  useEffect(() => {
    setIsClient(true)
    const loadedState = loadChecklistState()
    setState(loadedState)

    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('mercadolivre') === 'connected') {
      const newState: ChecklistState = {
        ...loadedState,
        completed: {
          ...loadedState.completed,
          connectMarketplace: true,
        },
      }
      setState(newState)
      saveChecklistState(newState)
      window.history.replaceState({}, '', window.location.pathname)
    }

    checkMercadoLivreConnection()
    checkListingsExist()
    checkMetricsAndRecommendations()
  }, [])

  const checkMercadoLivreConnection = async () => {
    try {
      const health = await getMercadoLivreHealth()
      if (health && health.ok) {
        setMlConnected(true)
        setMlNickname(health.nickname)
        
        const currentState = loadChecklistState()
        if (!currentState.completed.connectMarketplace) {
          const newState: ChecklistState = {
            ...currentState,
            completed: {
              ...currentState.completed,
              connectMarketplace: true,
            },
          }
          setState(newState)
          saveChecklistState(newState)
        }
      }
    } catch {
      setMlConnected(false)
    }
  }

  const checkListingsExist = async () => {
    try {
      const response = await api.get('/listings?pageSize=1')
      const data = response.data
      if (data && data.total > 0) {
        const currentState = loadChecklistState()
        if (!currentState.completed.connectMarketplace) {
          const newState: ChecklistState = {
            ...currentState,
            completed: {
              ...currentState.completed,
              connectMarketplace: true,
            },
          }
          setState(newState)
          saveChecklistState(newState)
          setMlConnected(true)
        }
        if (!currentState.completed.createFirstListing) {
          const newState: ChecklistState = {
            ...currentState,
            completed: {
              ...currentState.completed,
              connectMarketplace: true,
              createFirstListing: true,
            },
          }
          setState(newState)
          saveChecklistState(newState)
        }
      }
    } catch {
      // Silently fail - listings check is supplementary
    }
  }

  // Verifica se há métricas (Passo 3) e recomendações (Passo 4)
  const checkMetricsAndRecommendations = async () => {
    try {
      // Passo 3: Validar métricas - true se totalOrders > 0
      const metricsResponse = await api.get('/metrics/overview')
      const metricsData = metricsResponse.data
      const hasMetrics = (metricsData?.totalOrders || 0) > 0

      // Passo 4: Recomendações - true se existir pelo menos 1 recomendação
      let hasRecommendations = false
      try {
        const recsResponse = await api.get('/ai/recommendations?limit=1')
        hasRecommendations = (recsResponse.data?.items?.length || 0) > 0
      } catch {
        // Se o endpoint não existir, manter false
        hasRecommendations = false
      }

      const currentState = loadChecklistState()
      let shouldUpdate = false
      const newCompleted = { ...currentState.completed }

      if (hasMetrics && !currentState.completed.validateInitialMetrics) {
        newCompleted.validateInitialMetrics = true
        shouldUpdate = true
      }

      if (hasRecommendations && !currentState.completed.enableAutoRecommendations) {
        newCompleted.enableAutoRecommendations = true
        shouldUpdate = true
      }

      if (shouldUpdate) {
        const newState: ChecklistState = {
          ...currentState,
          completed: newCompleted,
        }
        setState(newState)
        saveChecklistState(newState)
      }
    } catch {
      // Silently fail
    }
  }

  const handleConnectMercadoLivre = async () => {
    setMlConnecting(true)
    setMlError(null)
    
    try {
      const authUrl = await getMercadoLivreAuthUrl()
      window.location.href = authUrl
    } catch (error) {
      setMlError(error instanceof Error ? error.message : 'Erro ao conectar Mercado Livre')
      setMlConnecting(false)
    }
  }

  const calculateProgress = (): number => {
    const completed = Object.values(state.completed).filter(Boolean).length
    const total = Object.keys(state.completed).length
    return Math.round((completed / total) * 100)
  }

  if (!isClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Primeiros passos</CardTitle>
          <CardDescription>
            Complete estas etapas para começar a usar o SuperSeller IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={0} className="w-full" />
            <div className="h-64 animate-pulse bg-muted rounded-md" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const progress = calculateProgress()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Primeiros passos</CardTitle>
        <CardDescription>
          Complete estas etapas para começar a usar o SuperSeller IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        <Separator />

        <div className="space-y-4">
          {CHECKLIST_ITEMS.map((item, index) => (
            <div key={item.key} className="flex items-start gap-3 group">
              <Checkbox
                id={item.key}
                checked={state.completed[item.key]}
                disabled
                className="mt-1 cursor-not-allowed"
              />
              <div className="flex-1 space-y-1">
                <label
                  htmlFor={item.key}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {index + 1}. {item.title}
                </label>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
                {item.cta && (
                  <a
                    href={item.cta.href}
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    {item.cta.label}
                  </a>
                )}
                {item.key === 'connectMarketplace' && (
                  <div className="mt-2 flex items-center gap-2">
                    {mlConnected ? (
                      <Badge variant="default" className="bg-green-600">
                        Mercado Livre conectado{mlNickname ? `: ${mlNickname}` : ''}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleConnectMercadoLivre}
                        disabled={mlConnecting}
                      >
                        {mlConnecting ? 'Conectando...' : 'Conectar Mercado Livre'}
                      </Button>
                    )}
                    {mlError && (
                      <span className="text-xs text-red-500">{mlError}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  )
}
