'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { loadChecklistState, saveChecklistState, resetChecklistState } from '@/lib/storage'
import { ChecklistState, INITIAL_CHECKLIST_STATE } from '@/types/onboarding'
import { getMercadoLivreAuthUrl, getMercadoLivreHealth } from '@/lib/marketplaces'

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
    title: 'Cadastrar primeiro anúncio',
    description: 'Adicione seu primeiro produto para análise',
  },
  {
    key: 'validateInitialMetrics',
    title: 'Validar métricas iniciais',
    description: 'Aguarde a coleta das primeiras métricas de performance',
  },
  {
    key: 'enableAutoRecommendations',
    title: 'Ativar recomendações automáticas',
    description: 'Habilite sugestões inteligentes para otimizar seus anúncios',
    cta: {
      label: 'Ver recomendações',
      href: '/recommendations',
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

  const handleToggleItem = (key: ChecklistItemKey) => {
    const newState: ChecklistState = {
      ...state,
      completed: {
        ...state.completed,
        [key]: !state.completed[key],
      },
    }
    setState(newState)
    saveChecklistState(newState)
    
    console.info('[Checklist]', 'toggle_item', {
      item: key,
      completed: newState.completed[key],
    })
  }

  const handleMarkAll = () => {
    const newState: ChecklistState = {
      ...state,
      completed: {
        connectMarketplace: true,
        createFirstListing: true,
        validateInitialMetrics: true,
        enableAutoRecommendations: true,
      },
    }
    setState(newState)
    saveChecklistState(newState)
    
    console.info('[Checklist]', 'mark_all', { completed: true })
  }

  const handleClearAll = () => {
    const newState: ChecklistState = {
      ...state,
      completed: {
        connectMarketplace: false,
        createFirstListing: false,
        validateInitialMetrics: false,
        enableAutoRecommendations: false,
      },
    }
    setState(newState)
    saveChecklistState(newState)
    
    console.info('[Checklist]', 'clear_all', { completed: false })
  }

  const handleReset = () => {
    resetChecklistState()
    setState(INITIAL_CHECKLIST_STATE)
    
    console.info('[Checklist]', 'reset', { completed: false })
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
                onCheckedChange={() => handleToggleItem(item.key)}
                className="mt-1"
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

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={progress === 100}
          >
            Marcar tudo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={progress === 0}
          >
            Limpar tudo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={progress === 0}
          >
            Resetar progresso
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
