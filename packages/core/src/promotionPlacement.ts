export interface PromotionPlacementSuggestion {
  id: string;
  title: string;
  where: string;
  how: string;
  constraints: string[];
  exampleText: string;
}

export interface PricingInput {
  hasPromotion: boolean;
  originalPrice: number;
  finalPrice: number;
  discountPercent: number | null;
}

function formatDiscount(pricing: PricingInput): { pct: string; label: string } {
  const pct = pricing.discountPercent
    ? `${Math.round(pricing.discountPercent)}%`
    : `${Math.round((1 - pricing.finalPrice / pricing.originalPrice) * 100)}%`;
  const label = `De R$ ${pricing.originalPrice.toFixed(2)} por R$ ${pricing.finalPrice.toFixed(2)}`;
  return { pct, label };
}

export function buildPromotionPlacementSuggestions(
  pricing: PricingInput
): PromotionPlacementSuggestion[] {
  if (!pricing.hasPromotion) {
    return [];
  }

  const { pct, label } = formatDiscount(pricing);

  return [
    {
      id: 'promo_cover',
      title: 'Selo de desconto na imagem de capa',
      where: 'Imagem de capa do anuncio',
      how: `Adicionar selo visual simples com '${pct} OFF' ou '${label}'.`,
      constraints: [
        'Texto curto',
        'Alta legibilidade',
        'Nao poluir a imagem',
      ],
      exampleText: `${pct} OFF - ${label}`,
    },
    {
      id: 'promo_secondary_image',
      title: 'Banner de promocao na imagem 2 ou 3',
      where: 'Imagem 2 ou 3 do anuncio',
      how: `Criar imagem informativa com o preco promocional (${label}) e destaque visual do desconto.`,
      constraints: [
        'Nao repetir a capa',
        'Fundo limpo',
        'Foco no preco e beneficio',
      ],
      exampleText: `Aproveite: ${label} - ${pct} de desconto`,
    },
    {
      id: 'promo_description',
      title: 'Destaque nas primeiras linhas da descricao',
      where: 'Primeiras linhas da descricao do anuncio',
      how: `Incluir frase sobre a promocao ativa logo no inicio da descricao, antes dos detalhes do produto.`,
      constraints: [
        'Sem emojis',
        'Sem markdown',
        'Texto simples e direto',
      ],
      exampleText: `Promocao ativa: de R$ ${pricing.originalPrice.toFixed(2)} por R$ ${pricing.finalPrice.toFixed(2)} enquanto durar a oferta.`,
    },
    {
      id: 'promo_seo_rule',
      title: 'Regra de SEO - nao usar preco no titulo',
      where: 'Titulo do anuncio',
      how: 'Nao incluir valores monetarios no titulo. O algoritmo do Mercado Livre penaliza titulos com preco. Deixe o destaque de preco para imagens e descricao.',
      constraints: [
        'Titulo sem cifrao ou valores',
        'Manter keywords relevantes',
        'Maximo 60 caracteres',
      ],
      exampleText: '',
    },
  ];
}
