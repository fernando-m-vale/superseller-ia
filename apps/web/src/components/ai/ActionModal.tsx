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
import { Badge } from '@/components/ui/badge'
import { 
  ExternalLink, 
  Copy, 
  Check, 
  Image, 
  Video, 
  FileText,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'

type ActionDimension = 'cadastro' | 'midia' | 'performance' | 'seo' | 'competitividade'

interface ActionPlanItem {
  dimension: ActionDimension
  lostPoints: number
  whyThisMatters: string
  expectedScoreAfterFix: number
  priority: 'high' | 'medium' | 'low'
}

interface SEOSuggestions {
  title?: string
  description?: string
}

interface MediaVerdict {
  hasVideoDetected: boolean | null
  canSuggestVideo: boolean
  message: string
  shortMessage: string
}

interface ActionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: ActionPlanItem | null
  listingId?: string
  listingTitle?: string
  seoSuggestions?: SEOSuggestions
  permalinkUrl?: string
  mediaVerdict?: MediaVerdict
}

const DIMENSION_NAMES: Record<ActionDimension, string> = {
  cadastro: 'Cadastro',
  midia: 'Mídia',
  performance: 'Performance',
  seo: 'SEO',
  competitividade: 'Competitividade',
}

export function ActionModal({
  open,
  onOpenChange,
  action,
  listingId,
  listingTitle,
  seoSuggestions,
  permalinkUrl,
  mediaVerdict,
}: ActionModalProps) {
  const [copiedField, setCopiedField] = useState<'title' | 'description' | null>(null)

  if (!action) return null

  const handleCopy = async (text: string, field: 'title' | 'description') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleOpenListing = () => {
    if (permalinkUrl) {
      window.open(permalinkUrl, '_blank', 'noopener,noreferrer')
    } else if (listingId) {
      // Fallback: construct ML URL from listing ID
      window.open(`https://www.mercadolivre.com.br/p/${listingId}`, '_blank', 'noopener,noreferrer')
    }
  }

  const renderMidiaContent = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Checklist de Mídia</h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Image className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Fotos de alta qualidade</p>
              <p className="text-xs text-muted-foreground">
                Use pelo menos 6 fotos em alta resolução (1200x1200px) com fundo branco, mostrando diferentes angulos e detalhes do produto.
              </p>
            </div>
          </div>
          {/* Clips e Videos - Usar MediaVerdict como fonte única de verdade */}
          {mediaVerdict && (
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Video className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Clips e Videos</p>
                <p className="text-xs text-muted-foreground">
                  {mediaVerdict.message}
                </p>
                {mediaVerdict.hasVideoDetected === null && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Valide no painel do Mercado Livre; a API não detecta clips automaticamente.
                  </p>
                )}
              </div>
            </div>
          )}
          {!mediaVerdict && (
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Video className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Clips e Videos</p>
                <p className="text-xs text-muted-foreground">
                  Verifique no painel do Mercado Livre se seu anúncio possui clips ou vídeo. Vídeos aumentam a conversão em até 40%.
                </p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Clareza e consistencia</p>
              <p className="text-xs text-muted-foreground">
                Certifique-se de que as fotos mostram exatamente o produto que sera entregue, sem edições excessivas.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <Button onClick={handleOpenListing} className="w-full">
        <ExternalLink className="h-4 w-4 mr-2" />
        Abrir anuncio no Mercado Livre
      </Button>
    </div>
  )

  const renderSEOContent = () => (
    <div className="space-y-6">
      {/* Titulo atual vs sugestao */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Titulo atual</h4>
            <Badge variant="outline" className="text-xs">Original</Badge>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm">{listingTitle || 'Titulo nao disponivel'}</p>
          </div>
        </div>

        {seoSuggestions?.title && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Titulo sugerido pela IA</h4>
              <Badge variant="default" className="text-xs bg-primary">Otimizado</Badge>
            </div>
            <div className="p-3 bg-primary/5 border-2 border-primary/20 rounded-lg">
              <p className="text-sm">{seoSuggestions.title}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(seoSuggestions.title!, 'title')}
              className="w-full"
            >
              {copiedField === 'title' ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar titulo sugerido
                </>
              )}
            </Button>
          </div>
        )}

        {seoSuggestions?.description && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Descricao sugerida pela IA</h4>
              <Badge variant="default" className="text-xs bg-primary">Otimizado</Badge>
            </div>
            <div className="p-3 bg-primary/5 border-2 border-primary/20 rounded-lg max-h-32 overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{seoSuggestions.description}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(seoSuggestions.description!, 'description')}
              className="w-full"
            >
              {copiedField === 'description' ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar descricao sugerida
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <Button onClick={handleOpenListing} className="w-full">
        <ExternalLink className="h-4 w-4 mr-2" />
        Abrir anuncio no Mercado Livre
      </Button>
    </div>
  )

  const renderCadastroContent = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Checklist de Cadastro</h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Titulo completo</p>
              <p className="text-xs text-muted-foreground">
                Use os 60 caracteres disponiveis para incluir palavras-chave relevantes como marca, modelo, cor e tamanho.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Descricao detalhada</p>
              <p className="text-xs text-muted-foreground">
                Inclua especificacoes tecnicas, beneficios e diferenciais do produto. Descricoes completas aumentam a confianca do comprador.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Categoria correta</p>
              <p className="text-xs text-muted-foreground">
                Verifique se o produto esta na categoria mais especifica possivel para melhorar a relevancia nas buscas.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <Button onClick={handleOpenListing} className="w-full">
        <ExternalLink className="h-4 w-4 mr-2" />
        Abrir anuncio no Mercado Livre
      </Button>
    </div>
  )

  const renderCompetitividadeContent = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Dicas de Competitividade</h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <ArrowRight className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Analise a concorrencia</p>
              <p className="text-xs text-muted-foreground">
                Verifique os precos e condicoes dos concorrentes para posicionar seu produto de forma competitiva.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <ArrowRight className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Frete competitivo</p>
              <p className="text-xs text-muted-foreground">
                Considere oferecer frete gratis ou Mercado Envios Full para aumentar a atratividade do anuncio.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <ArrowRight className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Promocoes e descontos</p>
              <p className="text-xs text-muted-foreground">
                Participe de campanhas promocionais do Mercado Livre para aumentar a visibilidade.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <Button onClick={handleOpenListing} className="w-full">
        <ExternalLink className="h-4 w-4 mr-2" />
        Abrir anuncio no Mercado Livre
      </Button>
    </div>
  )

  const renderPerformanceContent = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Dicas de Performance</h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <ArrowRight className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Aumente as visitas</p>
              <p className="text-xs text-muted-foreground">
                Melhore o titulo e as fotos para aumentar o CTR nas buscas. Considere investir em anuncios patrocinados.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <ArrowRight className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Melhore a conversao</p>
              <p className="text-xs text-muted-foreground">
                Revise o preco, descricao e fotos. Responda perguntas rapidamente e mantenha boa reputacao.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <ArrowRight className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Acompanhe metricas</p>
              <p className="text-xs text-muted-foreground">
                Monitore visitas, conversao e vendas no painel do Mercado Livre para identificar oportunidades.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <Button onClick={handleOpenListing} className="w-full">
        <ExternalLink className="h-4 w-4 mr-2" />
        Abrir anuncio no Mercado Livre
      </Button>
    </div>
  )

  const renderContent = () => {
    switch (action.dimension) {
      case 'midia':
        return renderMidiaContent()
      case 'seo':
        return renderSEOContent()
      case 'cadastro':
        return renderCadastroContent()
      case 'competitividade':
        return renderCompetitividadeContent()
      case 'performance':
        return renderPerformanceContent()
      default:
        return renderCadastroContent()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Melhorar {DIMENSION_NAMES[action.dimension]}
          </DialogTitle>
          <DialogDescription>
            {action.whyThisMatters}
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
