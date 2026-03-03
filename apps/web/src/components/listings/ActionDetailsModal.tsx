'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  TrendingUp,
  Target,
  Zap,
  BarChart3,
} from 'lucide-react'
import { useActionDetails } from '@/hooks/use-action-details'
import type { ListingActionStatus } from '@/hooks/use-listing-actions'
import { useToast } from '@/hooks/use-toast'

interface ActionDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  listingId: string
  actionId: string
  actionTitle: string
  actionDescription: string
  actionStatus: ListingActionStatus
  suggestedActionUrl?: string | null
  editUrl?: string | null
  onStatusChange: (actionId: string, newStatus: ListingActionStatus) => Promise<void>
}

export function ActionDetailsModal({
  open,
  onOpenChange,
  listingId,
  actionId,
  actionTitle,
  actionDescription,
  actionStatus,
  suggestedActionUrl,
  editUrl,
  onStatusChange,
}: ActionDetailsModalProps) {
  const { data, error, isLoading, isGenerating, refetch } = useActionDetails(listingId, open ? actionId : null)
  const { toast } = useToast()
  const [changingStatus, setChangingStatus] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência`,
      duration: 2000,
    })
    setTimeout(() => setCopiedText(null), 2000)
  }

  const handleStatusChange = async (newStatus: ListingActionStatus) => {
    setChangingStatus(true)
    try {
      await onStatusChange(actionId, newStatus)
      toast({
        title: 'Status atualizado',
        description: 'O status da ação foi atualizado com sucesso.',
        duration: 1500,
      })
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro ao atualizar status',
        variant: 'destructive',
      })
    } finally {
      setChangingStatus(false)
    }
  }

  const getImpactColor = (impact?: string) => {
    switch (impact?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getEffortColor = (effort?: string) => {
    switch (effort?.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'high':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'high':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getConfidenceColor = (confidence?: string) => {
    switch (confidence?.toLowerCase()) {
      case 'high':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-xl">{actionTitle}</DialogTitle>
          <DialogDescription>{actionDescription}</DialogDescription>
        </DialogHeader>

        {/* Chips de metadados */}
        <div className="flex flex-wrap gap-2">
          {data?.impact && (
            <Badge className={getImpactColor(data.impact)}>
              <TrendingUp className="h-3 w-3 mr-1" />
              Impacto: {data.impact === 'high' ? 'Alto' : data.impact === 'medium' ? 'Médio' : 'Baixo'}
            </Badge>
          )}
          {data?.effort && (
            <Badge className={getEffortColor(data.effort)}>
              <Target className="h-3 w-3 mr-1" />
              Esforço: {data.effort === 'low' ? 'Baixo' : data.effort === 'medium' ? 'Médio' : 'Alto'}
            </Badge>
          )}
          {data?.priority && (
            <Badge className={getPriorityColor(data.priority)}>
              <Zap className="h-3 w-3 mr-1" />
              Prioridade: {data.priority === 'critical' ? 'Crítica' : data.priority === 'high' ? 'Alta' : data.priority === 'medium' ? 'Média' : 'Baixa'}
            </Badge>
          )}
          {data?.confidence && (
            <Badge className={getConfidenceColor(data.confidence)}>
              <BarChart3 className="h-3 w-3 mr-1" />
              Confiança: {data.confidence === 'high' ? 'Alta' : data.confidence === 'medium' ? 'Média' : 'Baixa'}
            </Badge>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {/* Error */}
        {isGenerating && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Gerando detalhes desta ação... isso pode levar até ~10s.
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                Atualizar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {error && !isGenerating && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar detalhes da ação. Tente novamente.
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-2"
              >
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Content */}

        {!isLoading && !error && !isGenerating && !data && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Ainda não há detalhes disponíveis para esta ação.
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                Atualizar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && !isGenerating && data && (
          <div className="space-y-6">
            {/* Por que importa */}
            {data.whyThisMatters && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Por que isso importa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{data.whyThisMatters}</p>
                </CardContent>
              </Card>
            )}

            {/* Como fazer */}
            {data.howToSteps && data.howToSteps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Como fazer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    {data.howToSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {/* Checklist */}
            {data.doThisNow && data.doThisNow.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.doThisNow.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Sugestões de texto */}
            {data.copySuggestions && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Copy className="h-4 w-4 text-primary" />
                    Sugestões de texto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Títulos A/B/C */}
                  {data.copySuggestions.titles && data.copySuggestions.titles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Títulos sugeridos:</h4>
                      <div className="space-y-2">
                        {data.copySuggestions.titles.map((title, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                            <Badge variant="outline" className="shrink-0">
                              {title.variation}
                            </Badge>
                            <span className="flex-1 text-sm">{title.text}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(title.text, `Título ${title.variation}`)}
                            >
                              {copiedText === title.text ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Descrição */}
                  {data.copySuggestions.description && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Template de descrição:</h4>
                      <div className="p-3 bg-muted rounded text-sm text-muted-foreground whitespace-pre-wrap">
                        {data.copySuggestions.description}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(data.copySuggestions!.description!, 'Descrição')}
                        className="mt-2"
                      >
                        {copiedText === data.copySuggestions.description ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copiar descrição
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Bullets */}
                  {data.copySuggestions.bullets && data.copySuggestions.bullets.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Bullets sugeridos:</h4>
                      <ul className="space-y-1">
                        {data.copySuggestions.bullets.map((bullet, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-primary">•</span>
                            <span className="flex-1">{bullet}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(bullet, `Bullet ${idx + 1}`)}
                            >
                              {copiedText === bullet ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Benchmark */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Benchmark
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.benchmark?.available === false ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Benchmark indisponível para esta ação.
                      {data.benchmark.notes && (
                        <p className="mt-2 text-sm text-muted-foreground">{data.benchmark.notes}</p>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : data.benchmark?.data ? (
                  <div className="text-sm text-muted-foreground">
                    <pre className="whitespace-pre-wrap bg-muted p-3 rounded">
                      {JSON.stringify(data.benchmark.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Dados de benchmark não disponíveis.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
          {(suggestedActionUrl || editUrl) && (
            <Button
              variant="default"
              onClick={() => {
                const url = suggestedActionUrl || editUrl
                if (url) window.open(url, '_blank', 'noopener,noreferrer')
              }}
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir anúncio
            </Button>
          )}
          {actionStatus === 'A_IMPLEMENTAR' && (
            <>
              <Button
                variant="outline"
                onClick={() => handleStatusChange('IMPLEMENTADO')}
                disabled={changingStatus}
                className="flex-1"
              >
                {changingStatus ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aplicar
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleStatusChange('DESCARTADO')}
                disabled={changingStatus}
                className="flex-1"
              >
                {changingStatus ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Descartando...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Descartar
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
