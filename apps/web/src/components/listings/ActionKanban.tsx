'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, ExternalLink, Info } from 'lucide-react'
import type { ListingActionStatus } from '@/hooks/use-listing-actions'
import { ActionDetailsModal } from './ActionDetailsModal'

export type ActionStatus = ListingActionStatus

export interface ActionItem {
  id: string
  actionKey?: string
  title: string
  description: string
  status: ActionStatus
  priority?: string | null
  expectedImpact?: string | null
  effort?: string | null
  suggestedActionUrl?: string | null
}

interface ActionKanbanProps {
  actions: ActionItem[]
  onStatusChange: (actionId: string, newStatus: ActionStatus) => Promise<void>
  editUrl?: string | null
  listingId?: string | null
}

export function ActionKanban({ actions, onStatusChange, editUrl, listingId }: ActionKanbanProps) {
  const [changingStatus, setChangingStatus] = useState<Set<string>>(new Set())
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)

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

  const handleOpenDetails = (actionId: string) => {
    setSelectedActionId(actionId)
    setDetailsModalOpen(true)
  }

  const getImpactColor = (impact?: string | null) => {
    if (!impact) return 'bg-muted text-muted-foreground'
    const normalized = impact.toLowerCase()
    switch (normalized) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      default:
        // Range impacts (+10% a +40%) should look like opportunity, not fallback.
        if (normalized.includes('%') || normalized.includes('+')) {
          return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
        }
        return 'bg-muted text-muted-foreground'
    }
  }

  const formatImpactLabel = (impact?: string | null) => {
    if (!impact) return null
    switch (impact.toLowerCase()) {
      case 'high':
        return 'Alto'
      case 'medium':
        return 'Médio'
      case 'low':
        return 'Baixo'
      default:
        return impact.includes('%') || impact.includes('+') ? `📈 ${impact}` : impact
    }
  }



  const ActionCard = ({ action }: { action: ActionItem }) => {
    const isLoading = changingStatus.has(action.id)
    const hasLink = action.suggestedActionUrl || editUrl
    const selectedAction = selectedActionId === action.id ? action : null

    return (
      <>
        <Card className="p-4 space-y-3">
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-semibold text-sm flex-1">{action.title}</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenDetails(action.id)}
                className="h-8 shrink-0 px-2"
              >
                <Info className="h-3.5 w-3.5 mr-1" />
                Ver detalhes
              </Button>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-1">
            {action.expectedImpact && (
              <Badge className={`text-xs ${getImpactColor(action.expectedImpact)}`}>
                Impacto estimado: {formatImpactLabel(action.expectedImpact)}
              </Badge>
            )}
            {action.effort && (
              <Badge className="text-xs bg-muted text-muted-foreground">
                Esforço: {action.effort === 'low' ? 'Baixo' : action.effort === 'medium' ? 'Médio' : 'Alto'}
              </Badge>
            )}
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

        {/* Modal de detalhes */}
        {selectedAction && listingId && (
          <ActionDetailsModal
            open={detailsModalOpen && selectedActionId === action.id}
            onOpenChange={setDetailsModalOpen}
            listingId={listingId}
            actionId={action.id}
            actionTitle={action.title}
            actionDescription={action.description}
            actionStatus={action.status}
            suggestedActionUrl={action.suggestedActionUrl}
            editUrl={editUrl}
            onStatusChange={onStatusChange}
          />
        )}
      </>
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
