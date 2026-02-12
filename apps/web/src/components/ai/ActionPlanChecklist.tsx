'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, ChevronRight, ExternalLink } from 'lucide-react'
import type { ActionType } from '@/hooks/use-apply-action'

interface ActionPlanItem {
  id: string
  title: string
  actionType: ActionType | null // null = não executável via apply-action
  sectionId?: string // ID da seção para scroll/highlight
  mlDeeplink?: string // Link para editar no ML
}

interface ActionPlanChecklistProps {
  items: ActionPlanItem[]
  appliedActions: Array<{
    actionType: string
    appliedAt: string
  }>
  onApplyAction?: (actionType: ActionType, before: string, after: string) => void
  onScrollToSection?: (sectionId: string) => void
  editUrl?: string | null
}

export function ActionPlanChecklist({
  items,
  appliedActions,
  onApplyAction,
  onScrollToSection,
}: ActionPlanChecklistProps) {
  const isActionApplied = (actionType: ActionType | null): boolean => {
    if (!actionType) return false
    
    // Verificar ação específica
    if (appliedActions.some(action => action.actionType === actionType)) {
      return true
    }
    
    // Compatibilidade: se procurar "seo", verificar "seo_title" ou "seo_description"
    if (actionType === 'seo') {
      return appliedActions.some(action => 
        action.actionType === 'seo_title' || action.actionType === 'seo_description'
      )
    }
    
    // Compatibilidade: se procurar "midia", verificar "media_images"
    if (actionType === 'midia') {
      return appliedActions.some(action => action.actionType === 'media_images')
    }
    
    return false
  }

  const getNextPendingAction = (): ActionPlanItem | null => {
    return items.find(item => item.actionType && !isActionApplied(item.actionType)) || null
  }

  const nextAction = getNextPendingAction()

  const handleApplyNext = () => {
    if (!nextAction || !nextAction.actionType) return
    
    if (onScrollToSection && nextAction.sectionId) {
      onScrollToSection(nextAction.sectionId)
    }
    
    // Se tiver onApplyAction, chamar com valores padrão
    // (o modal será aberto pela seção correspondente após scroll)
    if (onApplyAction && nextAction.actionType) {
      // Valores serão preenchidos pela seção após scroll
      // Por enquanto, apenas scroll
    }
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">📋 Plano de Execução</CardTitle>
          {nextAction && (
            <Button
              variant="default"
              size="sm"
              onClick={handleApplyNext}
              className="bg-primary hover:bg-primary/90"
            >
              <ChevronRight className="h-4 w-4 mr-2" />
              Aplicar Próximo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => {
            const applied = item.actionType ? isActionApplied(item.actionType) : false
            
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors ${
                  applied
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                    : 'bg-muted/30 border-muted hover:bg-muted/50'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {applied ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <div className="w-5 h-5 rounded border-2 border-primary flex items-center justify-center">
                      <Clock className="h-3 w-3 text-primary opacity-50" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${
                      applied ? 'text-green-800 dark:text-green-200' : 'text-foreground'
                    }`}>
                      {item.title}
                    </p>
                    {applied && (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
                        Implementado
                      </Badge>
                    )}
                  </div>
                </div>
                {!applied && item.actionType && (
                  <div className="flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (onScrollToSection && item.sectionId) {
                          onScrollToSection(item.sectionId)
                        }
                      }}
                    >
                      Aplicar
                    </Button>
                  </div>
                )}
                {!applied && !item.actionType && item.mlDeeplink && (
                  <div className="flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(item.mlDeeplink, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir ML
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {nextAction && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              Próxima ação recomendada:
            </p>
            <p className="text-sm font-medium text-primary">
              {nextAction.title}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
