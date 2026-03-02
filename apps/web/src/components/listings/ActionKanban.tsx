'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react'

export type ActionStatus = 'A_IMPLEMENTAR' | 'IMPLEMENTADO' | 'DESCARTADO'

export interface ActionItem {
  id: string
  actionKey?: string
  title: string
  description: string
  status: ActionStatus
  priority?: string | null
  expectedImpact?: string | null
  suggestedActionUrl?: string | null
}

interface ActionKanbanProps {
  actions: ActionItem[]
  onStatusChange: (actionId: string, newStatus: ActionStatus) => Promise<void>
  editUrl?: string | null
}

export function ActionKanban({ actions, onStatusChange, editUrl }: ActionKanbanProps) {
  const [changingStatus, setChangingStatus] = useState<Set<string>>(new Set())

  const handleStatusChange = async (actionId: string, newStatus: ActionStatus) => {
    setChangingStatus(prev => new Set(prev).add(actionId))
    try {
      await onStatusChange(actionId, newStatus)
    } finally {
      setChangingStatus(prev => {
        const next = new Set(prev)
        next.delete(actionId)
        return next
      })
    }
  }

  const pendingActions = actions.filter(a => a.status === 'A_IMPLEMENTAR')
  const appliedActions = actions.filter(a => a.status === 'IMPLEMENTADO')
  const dismissedActions = actions.filter(a => a.status === 'DESCARTADO')

  const ActionCard = ({ action }: { action: ActionItem }) => {
    const isLoading = changingStatus.has(action.id)
    const hasLink = action.suggestedActionUrl || editUrl

    return (
      <Card className="p-4 space-y-3">
        <div>
          <h4 className="font-semibold text-sm mb-1">{action.title}</h4>
          <p className="text-xs text-muted-foreground">{action.description}</p>
        </div>
        
        <div className="flex flex-col gap-2">
          {hasLink && action.status === 'A_IMPLEMENTAR' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const url = action.suggestedActionUrl || editUrl
                if (url) window.open(url, '_blank', 'noopener,noreferrer')
              }}
              className="w-full"
              disabled={isLoading}
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              APLICAR AGORA
            </Button>
          )}
          
          {action.status === 'A_IMPLEMENTAR' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange(action.id, 'IMPLEMENTADO')}
                disabled={isLoading}
                className="w-full"
              >
                <CheckCircle2 className="h-3 w-3 mr-2" />
                APLICADO
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange(action.id, 'DESCARTADO')}
                disabled={isLoading}
                className="w-full text-muted-foreground"
              >
                <XCircle className="h-3 w-3 mr-2" />
                NÃO SE APLICA
              </Button>
            </>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* A Implementar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">A Implementar</h3>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {pendingActions.length}
          </span>
        </div>
        <div className="space-y-3">
          {pendingActions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma ação pendente</p>
          ) : (
            pendingActions.map(action => (
              <ActionCard key={action.id} action={action} />
            ))
          )}
        </div>
      </div>

      {/* Implementado */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <h3 className="font-semibold text-sm">Implementado</h3>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {appliedActions.length}
          </span>
        </div>
        <div className="space-y-3">
          {appliedActions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma ação implementada</p>
          ) : (
            appliedActions.map(action => (
              <ActionCard key={action.id} action={action} />
            ))
          )}
        </div>
      </div>

      {/* Descartado */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <XCircle className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Descartado</h3>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {dismissedActions.length}
          </span>
        </div>
        <div className="space-y-3">
          {dismissedActions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma ação descartada</p>
          ) : (
            dismissedActions.map(action => (
              <ActionCard key={action.id} action={action} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
