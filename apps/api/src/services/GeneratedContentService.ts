/**
 * Generated Content Service
 *
 * Gera conteúdo acionável (títulos, bullets, descrição SEO) orientado por dados e gaps.
 * NÃO promete o que não existe. NÃO assume clip se não há clip confirmado.
 * Conteúdo é sugestão assistiva (copy & paste).
 */

import { CriticalGap } from './BenchmarkInsightsService';

export interface GeneratedTitle {
  variation: 'A' | 'B' | 'C';
  text: string;
}

export interface GeneratedContent {
  titles: GeneratedTitle[];
  bullets: string[];
  seoDescription: {
    short: string;
    long: string;
  };
}

type ListingInput = {
  title: string;
  description?: string | null;
  picturesCount: number;
  hasClips: boolean | null;
  hasPromotion: boolean;
  discountPercent: number | null;
  price: number;
  originalPrice?: number | null;
  category?: string | null;
};

type ListingProfile = {
  tokens: string[];
  normalizedTitle: string;
  productLabel: string;
  seoLabel: string;
  categoryLabel: string;
  audienceLabel: string;
  audienceContext: string;
  benefitLabel: string;
  useContext: string;
  offerHook: string;
  detailLabel: string;
  openingStyle: 0 | 1 | 2 | 3;
};

const STOP_WORDS = new Set([
  'a',
  'as',
  'o',
  'os',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
  'em',
  'para',
  'por',
  'com',
  'sem',
  'no',
  'na',
  'nos',
  'nas',
  'um',
  'uma',
  'kit',
]);

/**
 * Gera conteúdo para um listing baseado em dados reais e criticalGaps
 */
export function generateListingContent(
  listing: ListingInput,
  criticalGaps: CriticalGap[]
): GeneratedContent {
  const profile = buildListingProfile(listing);
  const titles = generateDistinctTitles(listing, criticalGaps, profile);
  const bullets = generateBullets(listing, criticalGaps, profile);
  const seoDescription = generateSeoDescription(listing, criticalGaps, profile);

  return {
    titles,
    bullets,
    seoDescription,
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateTitle(value: string, max = 60): string {
  const clean = normalizeWhitespace(value);
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trimEnd();
}

function uniqueTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  return tokens.filter((token) => {
    const normalized = token.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function extractTokens(title: string): string[] {
  return uniqueTokens(
    title
      .split(/[^\p{L}\p{N}%]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  );
}

function buildListingProfile(listing: ListingInput): ListingProfile {
  const tokens = extractTokens(listing.title);
  const normalizedTitle = listing.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const semanticTokens = tokens.filter((token) => !STOP_WORDS.has(token.toLowerCase()));
  const baseTokens = semanticTokens.length > 0 ? semanticTokens : tokens;
  const productLabel = normalizeWhitespace(baseTokens.slice(0, 4).join(' ')) || normalizeWhitespace(listing.title);
  const seoLabel = normalizeWhitespace(baseTokens.slice(0, 6).join(' ')) || productLabel;
  const categoryLabel = inferCategoryLabel(normalizedTitle, baseTokens);
  const audienceLabel = inferAudienceLabel(normalizedTitle);
  const audienceContext = inferAudienceContext(audienceLabel);
  const benefitLabel = inferBenefitLabel(normalizedTitle);
  const useContext = inferUseContext(normalizedTitle, audienceContext);
  const offerHook = inferOfferHook(listing, normalizedTitle);
  const detailLabel = normalizeWhitespace(baseTokens.slice(1, 5).join(' ')) || productLabel;
  const openingStyle = (normalizedTitle.length % 4) as 0 | 1 | 2 | 3;

  return {
    tokens: baseTokens,
    normalizedTitle,
    productLabel,
    seoLabel,
    categoryLabel,
    audienceLabel,
    audienceContext,
    benefitLabel,
    useContext,
    offerHook,
    detailLabel,
    openingStyle,
  };
}

function inferAudienceLabel(normalizedTitle: string): string {
  if (/(infantil|crianca|criancas|menino|menina|bebe)/.test(normalizedTitle)) return 'infantil';
  if (/(masculin|homem)/.test(normalizedTitle)) return 'masculino';
  if (/(feminin|mulher)/.test(normalizedTitle)) return 'feminino';
  if (/(unissex)/.test(normalizedTitle)) return 'unissex';
  if (/(profission|premium)/.test(normalizedTitle)) return 'profissional';
  return 'geral';
}

function inferAudienceContext(audienceLabel: string): string {
  if (audienceLabel === 'infantil') return 'o dia a dia das crianças';
  if (audienceLabel === 'masculino') return 'a rotina masculina';
  if (audienceLabel === 'feminino') return 'a rotina feminina';
  if (audienceLabel === 'profissional') return 'uso profissional';
  return 'uso diário';
}

function inferCategoryLabel(normalizedTitle: string, tokens: string[]): string {
  if (/(cueca|calcinha|camiseta|meia|tenis|sapato|vestido|jaqueta|calca)/.test(normalizedTitle)) return 'moda';
  if (/(cabo|fone|caixa de som|bluetooth|hdmi|carregador|notebook|mouse|teclado)/.test(normalizedTitle)) return 'eletrônicos';
  if (/(cadeira|aspirador|purificador|panela|cozinha|almofada)/.test(normalizedTitle)) return 'casa';
  return normalizeWhitespace(tokens.slice(0, 2).join(' ')) || 'produto';
}

function inferBenefitLabel(normalizedTitle: string): string {
  if (/(algod|maci|confort|ergonom|respir)/.test(normalizedTitle)) return 'conforto e ajuste';
  if (/(durav|reforc|resistent)/.test(normalizedTitle)) return 'durabilidade no uso';
  if (/(4k|ultra|potenc|rapido|speed|pro)/.test(normalizedTitle)) return 'desempenho consistente';
  if (/(leve|portat|compact)/.test(normalizedTitle)) return 'praticidade no dia a dia';
  return 'bom desempenho no uso diário';
}

function inferUseContext(normalizedTitle: string, audienceContext: string): string {
  if (/(escola|infantil|crianca)/.test(normalizedTitle)) return 'na escola, em casa e na rotina';
  if (/(corrida|treino|academia|esporte)/.test(normalizedTitle)) return 'na rotina de treino e movimento';
  if (/(casa|cozinha|office|escritorio)/.test(normalizedTitle)) return 'na rotina da casa ou do trabalho';
  if (/(cabo|fone|bluetooth|hdmi|carregador)/.test(normalizedTitle)) return 'na instalação e no uso diário';
  return `em ${audienceContext}`;
}

function inferOfferHook(listing: ListingInput, normalizedTitle: string): string {
  if (listing.hasPromotion && listing.discountPercent !== null && listing.discountPercent >= 20) {
    return `condição especial com ${listing.discountPercent}% de desconto`;
  }
  if (/\bkit\b/.test(normalizedTitle)) return 'kit com melhor custo-benefício';
  if (/(premium|pro|profission)/.test(normalizedTitle)) return 'valor percebido de linha premium';
  return 'ótimo custo-benefício';
}

function generateDistinctTitles(
  listing: ListingInput,
  criticalGaps: CriticalGap[],
  profile: ListingProfile
): GeneratedTitle[] {
  const seoTitle = truncateTitle([
    profile.seoLabel,
    profile.audienceLabel !== 'geral' ? profile.audienceLabel : '',
  ].filter(Boolean).join(' '));

  const conversionLead = profile.benefitLabel.charAt(0).toUpperCase() + profile.benefitLabel.slice(1);
  const conversionTitle = truncateTitle(
    `${conversionLead} para ${profile.audienceContext} - ${profile.productLabel}`
  );

  const offerSuffix = buildOfferSuffix(listing, criticalGaps, profile);
  const offerTitle = truncateTitle(`${profile.productLabel} com ${offerSuffix}`);

  return [
    { variation: 'A', text: seoTitle },
    { variation: 'B', text: conversionTitle },
    { variation: 'C', text: offerTitle },
  ];
}

function buildOfferSuffix(
  listing: ListingInput,
  criticalGaps: CriticalGap[],
  profile: ListingProfile
): string {
  if (listing.hasPromotion && listing.discountPercent !== null && listing.discountPercent >= 20) {
    return `${listing.discountPercent}% de desconto e ${profile.offerHook}`;
  }
  if (criticalGaps.some((gap) => gap.dimension === 'price' || gap.id.includes('promo'))) {
    return 'estratégia de oferta mais forte';
  }
  return profile.offerHook;
}

/**
 * Gera bullets baseados em gaps e dados reais
 */
function generateBullets(
  listing: ListingInput,
  criticalGaps: CriticalGap[],
  profile: ListingProfile
): string[] {
  const bullets: string[] = [];

  if (listing.picturesCount > 0 && listing.picturesCount >= 5) {
    bullets.push(`Galeria com ${listing.picturesCount} imagens para apoiar a decisão`);
  } else if (criticalGaps.some((g) => g.dimension === 'images')) {
    bullets.push('Conteúdo visual pronto para explicar melhor o produto');
  }

  if (listing.hasClips === true) {
    bullets.push('Clip demonstrativo disponível');
  }

  if (listing.hasPromotion && listing.discountPercent !== null && listing.discountPercent >= 20) {
    bullets.push(`${listing.discountPercent}% de desconto aplicado na oferta`);
  }

  bullets.push(`${profile.benefitLabel.charAt(0).toUpperCase() + profile.benefitLabel.slice(1)} para ${profile.audienceContext}`);
  bullets.push(`Categoria ${profile.categoryLabel} com foco em ${profile.useContext}`);
  bullets.push('Envio rápido e seguro para todo o Brasil');

  return bullets.slice(0, 5);
}

function buildOpening(profile: ListingProfile): string {
  if (profile.openingStyle === 0) {
    return `${profile.productLabel} para ${profile.audienceContext}, com foco em ${profile.benefitLabel}.`;
  }
  if (profile.openingStyle === 1) {
    return `Buscando mais ${profile.benefitLabel} em ${profile.useContext}? ${profile.productLabel} entra como uma opção prática.`;
  }
  if (profile.openingStyle === 2) {
    return `${profile.benefitLabel.charAt(0).toUpperCase() + profile.benefitLabel.slice(1)} é o diferencial que faz ${profile.productLabel} ganhar força na categoria ${profile.categoryLabel}.`;
  }
  return `${profile.useContext.charAt(0).toUpperCase() + profile.useContext.slice(1)} pedem um produto com leitura clara, e ${profile.productLabel} responde bem a esse cenário.`;
}

/**
 * Gera descrição SEO (short e long)
 */
function generateSeoDescription(
  listing: ListingInput,
  criticalGaps: CriticalGap[],
  profile: ListingProfile
): { short: string; long: string } {
  const opening = buildOpening(profile);
  const promoLine = listing.hasPromotion && listing.discountPercent !== null && listing.discountPercent >= 20
    ? ` Oferta com ${listing.discountPercent}% de desconto para aumentar o valor percebido.`
    : '';
  const trustLine = listing.hasClips === true
    ? ' Clip demonstrativo e galeria ajudam a validar a compra.'
    : ' A descrição prioriza clareza para acelerar a decisão.';

  const short = normalizeWhitespace(`${opening}${promoLine}${trustLine}`).slice(0, 200);

  const sections: string[] = [];
  sections.push(opening);
  sections.push(
    `Na categoria ${profile.categoryLabel}, este anúncio conversa com ${profile.audienceContext} e destaca ${profile.detailLabel} com linguagem mais consultiva.`
  );

  const benefits: string[] = [
    `Foco em ${profile.benefitLabel}`,
    `Uso pensado para ${profile.useContext}`,
  ];
  if (listing.picturesCount >= 5) {
    benefits.push(`Galeria com ${listing.picturesCount} imagens para apoiar a análise do comprador`);
  }
  if (listing.hasClips === true) {
    benefits.push('Clip demonstrativo disponível para reforçar contexto de uso');
  }
  if (listing.hasPromotion && listing.discountPercent !== null && listing.discountPercent >= 20) {
    benefits.push(`Oferta ativa com ${listing.discountPercent}% de desconto`);
  }

  sections.push(`BENEFICIOS:\n• ${benefits.join('\n• ')}`);

  if (criticalGaps.some((gap) => gap.id === 'gap_conversion_vs_promo')) {
    sections.push('OPORTUNIDADE:\n• Reforçar a leitura da oferta para transformar interesse em pedido com mais consistência.');
  }

  sections.push(
    'COMPRE COM CONFIANCA:\n• Produto com comunicação mais clara de uso e diferencial\n• Atendimento para apoiar dúvidas principais\n• Estrutura pensada para reduzir objeções antes da compra'
  );
  sections.push(`Fechamento: ${profile.productLabel} entrega ${profile.offerHook} sem perder clareza comercial.`);

  return {
    short,
    long: sections.join('\n\n').slice(0, 1000),
  };
}
