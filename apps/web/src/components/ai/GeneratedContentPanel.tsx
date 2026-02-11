'use client'

import { useState } from 'react'
import { Copy, Check, FileText, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface GeneratedTitle {
  variation: 'A' | 'B' | 'C'
  text: string
}

interface GeneratedContent {
  titles: GeneratedTitle[]
  bullets: string[]
  seoDescription: {
    short: string
    long: string
  }
}

interface GeneratedContentPanelProps {
  generatedContent: GeneratedContent
}

export function GeneratedContentPanel({ generatedContent }: GeneratedContentPanelProps) {
  const { toast } = useToast()
  const [copiedTexts, setCopiedTexts] = useState<Set<string>>(new Set())

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedTexts(prev => new Set(prev).add(text))
      toast({
        title: 'Copiado!',
        description: `${label} copiado para a área de transferência`,
        duration: 2000,
      })
      setTimeout(() => {
        setCopiedTexts(prev => {
          const newSet = new Set(prev)
          newSet.delete(text)
          return newSet
        })
      }, 2000)
    } catch (error) {
      console.error('Erro ao copiar:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o texto',
        variant: 'destructive',
        duration: 2000,
      })
    }
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Sparkles className="h-5 w-5 text-blue-600" />
          </div>
          <CardTitle className="text-lg">Conteúdo Gerado</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className="text-xs text-muted-foreground">
            Conteúdo sugerido por IA. Revise antes de publicar.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="titles" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="titles">Títulos</TabsTrigger>
            <TabsTrigger value="bullets">Bullets</TabsTrigger>
            <TabsTrigger value="description">Descrição</TabsTrigger>
          </TabsList>

          {/* Títulos */}
          <TabsContent value="titles" className="space-y-3">
            {generatedContent.titles.map((title) => (
              <div key={title.variation} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Variação {title.variation}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(title.text, `Título ${title.variation}`)}
                  >
                    {copiedTexts.has(title.text) ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={title.text}
                  className="text-sm font-mono bg-muted/30"
                />
              </div>
            ))}
          </TabsContent>

          {/* Bullets */}
          <TabsContent value="bullets" className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Bullets de valor</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(generatedContent.bullets.join('\n'), 'Bullets')}
              >
                {copiedTexts.has(generatedContent.bullets.join('\n')) ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar todos
                  </>
                )}
              </Button>
            </div>
            <ul className="space-y-2">
              {generatedContent.bullets.map((bullet, idx) => (
                <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </TabsContent>

          {/* Descrição */}
          <TabsContent value="description" className="space-y-3">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Descrição curta (até 200 caracteres)</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(generatedContent.seoDescription.short, 'Descrição curta')}
                  >
                    {copiedTexts.has(generatedContent.seoDescription.short) ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={generatedContent.seoDescription.short}
                  className="text-sm font-mono bg-muted/30 min-h-[80px]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Descrição completa (SEO)</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(generatedContent.seoDescription.long, 'Descrição completa')}
                  >
                    {copiedTexts.has(generatedContent.seoDescription.long) ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={generatedContent.seoDescription.long}
                  className="text-sm font-mono bg-muted/30 min-h-[200px]"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
