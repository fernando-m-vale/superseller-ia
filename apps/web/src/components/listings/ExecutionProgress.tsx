'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'

interface ExecutionProgressProps {
  pending: number
  applied: number
  dismissed: number
}

export function ExecutionProgress({ pending, applied, dismissed }: ExecutionProgressProps) {
  const total = pending + applied + dismissed

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Progresso de Execução</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <div className="text-2xl font-bold">{pending}</div>
            <div className="text-xs text-muted-foreground mt-1">Pendentes</div>
          </div>
          <div className="text-center p-4 border rounded-lg border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
            <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{applied}</div>
            <div className="text-xs text-muted-foreground mt-1">Implementadas</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <XCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <div className="text-2xl font-bold">{dismissed}</div>
            <div className="text-xs text-muted-foreground mt-1">Descartadas</div>
          </div>
        </div>
        {total > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total de ações</span>
              <span className="font-semibold">{total}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
