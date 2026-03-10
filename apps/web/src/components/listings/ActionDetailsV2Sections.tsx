'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Copy,
  Check,
  Image,
  Video,
  DollarSign,
  Package,
  Layers,
  Settings,
  Shield,
  Search,
  FileText,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react'
import type { ActionDetailsV2 } from '@/types/action-details-v2'

interface ActionDetailsV2SectionsProps {
  details: ActionDetailsV2
  onCopy?: (text: string, label: string) => void
  copiedText?: string | null
}

export function ActionDetailsV2Sections({
  details,
  onCopy,
  copiedText,
}: ActionDetailsV2SectionsProps) {
  const handleCopy = (text: string, label: string) => {
    if (onCopy) {
      onCopy(text, label)
    } else {
      navigator.clipboard.writeText(text)
    }
  }

  return (
    <div className="space-y-6">
      {/* Copy Artifacts */}
      {details.artifacts?.copy && (
        <>
          {/* Title Suggestions */}
          {details.artifacts.copy.titleSuggestions && details.artifacts.copy.titleSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Sugestões de Título
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {details.artifacts.copy.titleSuggestions.map((title, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-3 p-3 bg-muted rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{title.variation}</Badge>
                        {title.rationale && (
                          <span className="text-xs text-muted-foreground">{title.rationale}</span>
                        )}
                      </div>
                      <p className="font-mono text-sm">{title.text}</p>
                    </div>
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
              </CardContent>
            </Card>
          )}

          {/* Description Template */}
          {details.artifacts.copy.descriptionTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Template de Descrição
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">{details.artifacts.copy.descriptionTemplate.headline}</h4>
                  <div className="space-y-2">
                    {details.artifacts.copy.descriptionTemplate.blocks.map((block, index) => (
                      <p key={index} className="text-sm text-muted-foreground">
                        {block}
                      </p>
                    ))}
                  </div>
                  {details.artifacts.copy.descriptionTemplate.bullets && (
                    <ul className="list-disc list-inside mt-3 space-y-1">
                      {details.artifacts.copy.descriptionTemplate.bullets.map((bullet, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                  {details.artifacts.copy.descriptionTemplate.cta && (
                    <p className="mt-3 font-medium">{details.artifacts.copy.descriptionTemplate.cta}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    handleCopy(
                      [
                        details.artifacts!.copy!.descriptionTemplate!.headline,
                        ...details.artifacts!.copy!.descriptionTemplate!.blocks,
                        ...(details.artifacts!.copy!.descriptionTemplate!.bullets || []),
                        details.artifacts!.copy!.descriptionTemplate!.cta || '',
                      ]
                        .filter(Boolean)
                        .join('\n\n'),
                      'Descrição completa',
                    )
                  }
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Descrição Completa
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Bullet Suggestions */}
          {details.artifacts.copy.bulletSuggestions && details.artifacts.copy.bulletSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Bullets sugeridos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {details.artifacts.copy.bulletSuggestions.map((bullet, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-3 p-2 bg-muted rounded"
                  >
                    <span className="text-sm flex-1">{bullet}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(bullet, `Bullet ${index + 1}`)}
                    >
                      {copiedText === bullet ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Keyword Suggestions */}
          {details.artifacts.copy.keywordSuggestions && details.artifacts.copy.keywordSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Palavras-chave
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {details.artifacts.copy.keywordSuggestions.map((kw, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-muted rounded"
                    >
                      <Badge variant="secondary">{kw.keyword}</Badge>
                      <span className="text-xs text-muted-foreground">({kw.placement})</span>
                      {kw.rationale && (
                        <span className="text-xs text-muted-foreground ml-1">{kw.rationale}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Media Artifacts */}
      {details.artifacts?.media && (
        <>
          {/* Gallery Plan */}
          {details.artifacts.media.galleryPlan && details.artifacts.media.galleryPlan.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Image className="h-5 w-5 text-primary" />
                  Plano de Galeria ({details.artifacts.media.galleryPlan.length} fotos)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {details.artifacts.media.galleryPlan.map((slot) => (
                    <div
                      key={slot.slotNumber}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Slot {slot.slotNumber}</Badge>
                        <span className="text-xs font-medium">{slot.objective}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{slot.whatToShow}</p>
                      {slot.overlaySuggestion && (
                        <div className="text-xs bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
                          <strong>Overlay:</strong> {slot.overlaySuggestion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Video Script */}
          {details.artifacts.media.videoScript && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  Roteiro de Clip
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Hook (primeiros 3-5s):</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                    {details.artifacts.media.videoScript.hook}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Cenas:</h4>
                  <ol className="list-decimal list-inside space-y-2">
                    {details.artifacts.media.videoScript.scenes.map((scene, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        <strong>Cena {scene.order}:</strong> {scene.description}
                        {scene.durationSeconds && (
                          <span className="text-xs ml-2">({scene.durationSeconds}s)</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Pricing Artifacts */}
      {details.artifacts?.pricing?.suggestions && details.artifacts.pricing.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Sugestões de Preço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {details.artifacts.pricing.suggestions.map((suggestion, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold">
                      R$ {suggestion.suggestedPrice.toFixed(2).replace('.', ',')}
                    </span>
                    {suggestion.expectedImpact && (
                      <Badge variant="secondary">{suggestion.expectedImpact}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variations */}
      {details.artifacts?.variations && details.artifacts.variations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Variações Sugeridas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {details.artifacts.variations.map((variation, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="font-semibold mb-2">{variation.attributeName}</div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {variation.values.map((value, vIndex) => (
                    <Badge key={vIndex} variant="outline">
                      {value}
                    </Badge>
                  ))}
                </div>
                {variation.rationale && (
                  <p className="text-xs text-muted-foreground">{variation.rationale}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Kits */}
      {details.artifacts?.kits && details.artifacts.kits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Combos Sugeridos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {details.artifacts.kits.map((kit, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{kit.comboTitle}</h4>
                  {kit.suggestedPrice && (
                    <Badge variant="secondary">
                      R$ {kit.suggestedPrice.toFixed(2).replace('.', ',')}
                    </Badge>
                  )}
                </div>
                <ul className="list-disc list-inside space-y-1 mb-2">
                  {kit.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="text-sm text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
                {kit.rationale && (
                  <p className="text-xs text-muted-foreground">{kit.rationale}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tech Specs */}
      {details.artifacts?.techSpecs && details.artifacts.techSpecs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Especificações Técnicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {details.artifacts.techSpecs.map((spec, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="font-semibold mb-1">{spec.attributeName}</div>
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Sugestão:</strong> {spec.suggestedValue}
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Como confirmar:</strong> {spec.howToConfirm}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Trust Guarantees */}
      {details.artifacts?.trustGuarantees && details.artifacts.trustGuarantees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Garantias e Confiança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {details.artifacts.trustGuarantees.map((guarantee, index) => (
              <div key={index} className="flex items-start justify-between gap-3 p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{guarantee.type}</Badge>
                    {guarantee.placement && (
                      <Badge variant="secondary">{guarantee.placement}</Badge>
                    )}
                  </div>
                  <p className="text-sm">{guarantee.text}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(guarantee.text, `Garantia ${guarantee.type}`)}
                >
                  {copiedText === guarantee.text ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Required Inputs */}
      {details.requiredInputs && details.requiredInputs.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <Lightbulb className="h-5 w-5" />
              Informações Necessárias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {details.requiredInputs.map((input, index) => (
                <div key={index} className="p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded">
                  <p className="text-sm font-medium">{input.field}</p>
                  <p className="text-xs text-muted-foreground">{input.howToConfirm}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
