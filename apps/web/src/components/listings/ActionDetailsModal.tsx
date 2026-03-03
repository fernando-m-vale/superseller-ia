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
import { ActionDetailsV2Sections } from './ActionDetailsV2Sections'
import type { ActionDetailsV2 } from '@/types/action-details-v2'

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
  // Feature flag: usar V2 se habilitado
  const v2Enabled = process.env.NEXT_PUBLIC_ACTION_DETAILS_V2_ENABLED === 'true'
  const { data, error, isLoading, isGenerating, version, refetch } = useActionDetails(
    listingId,
    open ? actionId : null,
    v2Enabled ? 'v2' : 'v1',
  )
  
  const isV2 = version === 'action_details_v2'
  const v2Data = isV2 ? (data as ActionDetailsV2) : null
  const v1Data = !isV2 ? data : null
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
          {(v2Data?.impact || v1Data?.impact) && (
            <Badge className={getImpactColor(v2Data?.impact || v1Data?.impact)}>
              <TrendingUp className="h-3 w-3 mr-1" />
              Impacto: {(v2Data?.impact || v1Data?.impact) === 'high' ? 'Alto' : (v2Data?.impact || v1Data?.impact) === 'medium' ? 'Médio' : 'Baixo'}
            </Badge>
          )}
          {(v2Data?.effort || v1Data?.effort) && (
            <Badge className={getEffortColor(v2Data?.effort || v1Data?.effort)}>
              <Target className="h-3 w-3 mr-1" />
              Esforço: {(v2Data?.effort || v1Data?.effort) === 'low' ? 'Baixo' : (v2Data?.effort || v1Data?.effort) === 'medium' ? 'Médio' : 'Alto'}
            </Badge>
          )}
          {(v2Data?.priority || v1Data?.priority) && (
            <Badge className={getPriorityColor(v2Data?.priority || v1Data?.priority)}>
              <Zap className="h-3 w-3 mr-1" />
              Prioridade: {(v2Data?.priority || v1Data?.priority) === 'critical' ? 'Crítica' : (v2Data?.priority || v1Data?.priority) === 'high' ? 'Alta' : (v2Data?.priority || v1Data?.priority) === 'medium' ? 'Média' : 'Baixa'}
            </Badge>
          )}
          {(v2Data?.confidence || v1Data?.confidence) && (
            <Badge className={getConfidenceColor(v2Data?.confidence || v1Data?.confidence)}>
              <BarChart3 className="h-3 w-3 mr-1" />
              Confiança: {(v2Data?.confidence || v1Data?.confidence) === 'high' ? 'Alta' : (v2Data?.confidence || v1Data?.confidence) === 'medium' ? 'Média' : 'Baixa'}
            </Badge>
          )}
        </div>

        {/* Loading / Generating */}
        {(isLoading || isGenerating) && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
            {isGenerating && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Gerando detalhes da ação. Isso pode levar alguns segundos...
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Error */}
<<<<<<< HEAD
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

        {/* Content V2 */}
        {!isLoading && !error && !isGenerating && isV2 && v2Data && (
          <div className="space-y-6">
            {/* Por que importa */}
            {v2Data.whyThisMatters && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Por que isso importa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{v2Data.whyThisMatters}</p>
                </CardContent>
              </Card>
            )}

            {/* Como fazer */}
            {v2Data.howToSteps && v2Data.howToSteps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Como fazer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    {v2Data.howToSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {/* Checklist */}
            {v2Data.doThisNow && v2Data.doThisNow.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {v2Data.doThisNow.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Artifacts V2 */}
            <ActionDetailsV2Sections
              details={v2Data}
              onCopy={handleCopy}
              copiedText={copiedText}
            />

            {/* Benchmark */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Benchmark
                </CardTitle>
              </CardHeader>
              <CardContent>
                {v2Data.benchmark?.available === false ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Benchmark indisponível para esta ação.
                      {v2Data.benchmark.notes && (
                        <p className="mt-2 text-sm text-muted-foreground">{v2Data.benchmark.notes}</p>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : v2Data.benchmark?.data ? (
                  <div className="text-sm text-muted-foreground">
                    <pre className="whitespace-pre-wrap bg-muted p-3 rounded">
                      {JSON.stringify(v2Data.benchmark.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Dados de benchmark não disponíveis.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content V1 (fallback) */}
        {!isLoading && !error && !isGenerating && !isV2 && v1Data && (
          <div className="space-y-6">
            {/* Por que importa */}
            {v1Data.whyThisMatters && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Por que isso importa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{v1Data.whyThisMatters}</p>
                </CardContent>
              </Card>
            )}

            {/* Como fazer */}
            {v1Data.howToSteps && v1Data.howToSteps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Como fazer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    {v1Data.howToSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {/* Checklist */}
            {v1Data.doThisNow && v1Data.doThisNow.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {v1Data.doThisNow.map((item, idx) => (
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
            {v1Data.copySuggestions && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Copy className="h-4 w-4 text-primary" />
                    Sugestões de texto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Títulos A/B/C */}
                  {v1Data.copySuggestions.titles && v1Data.copySuggestions.titles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Títulos sugeridos:</h4>
                      <div className="space-y-2">
                        {v1Data.copySuggestions.titles.map((title, idx) => (
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
                  {v1Data.copySuggestions.description && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Template de descrição:</h4>
                      <div className="p-3 bg-muted rounded text-sm text-muted-foreground whitespace-pre-wrap">
                        {v1Data.copySuggestions.description}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(v1Data.copySuggestions!.description!, 'Descrição')}
                        className="mt-2"
                      >
                        {copiedText === v1Data.copySuggestions.description ? (
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
                  {v1Data.copySuggestions.bullets && v1Data.copySuggestions.bullets.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Bullets sugeridos:</h4>
                      <ul className="space-y-1">
                        {v1Data.copySuggestions.bullets.map((bullet, idx) => (
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
                {v1Data.benchmark?.available === false ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Benchmark indisponível para esta ação.
                      {v1Data.benchmark.notes && (
                        <p className="mt-2 text-sm text-muted-foreground">{v1Data.benchmark.notes}</p>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : v1Data.benchmark?.data ? (
                  <div className="text-sm text-muted-foreground">
                    <pre className="whitespace-pre-wrap bg-muted p-3 rounded">
                      {JSON.stringify(v1Data.benchmark.data, null, 2)}
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
