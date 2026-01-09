/**
 * SEO Rule Engine v1 - Mercado Livre
 *
 * Motor de regras determinístico para análise de SEO de anúncios.
 * 100% baseado em regras, sem uso de LLM para decisão.
 *
 * A SEO Rule Engine NÃO reescreve texto.
 * Ela apenas:
 * - Avalia o título e descrição
 * - Pontua com base em regras de marketplace
 * - Gera guidelines claras para reescrita pela IA
 *
 * INTEGRAÇÃO COM IA (ONDA 3):
 * - IA recebe rewriteGuidelines
 * - IA apenas reescreve DENTRO das regras
 * - IA pode gerar variações A/B válidas
 *
 * @example
 * // Input
 * const input: SeoRuleEngineInput = {
 *   title: "Camiseta Masculina Nike Dri-Fit",
 *   description: "Camiseta esportiva de alta qualidade...",
 *   categoryId: "MLB123456",
 *   attributes: {
 *     brand: "Nike",
 *     model: "Dri-Fit",
 *     color: "Preto",
 *     size: "M"
 *   }
 * };
 *
 * // Output
 * const analysis: SeoAnalysis = {
 *   seoScore: 72,
 *   issues: [
 *     {
 *       code: "TITLE_TOO_SHORT",
 *       severity: "warning",
 *       message: "Título com 32 caracteres. Ideal: 55-60 caracteres.",
 *       field: "title",
 *       currentValue: "Camiseta Masculina Nike Dri-Fit",
 *       suggestion: "Expanda o título para incluir benefícios-chave"
 *     }
 *   ],
 *   rewriteGuidelines: {
 *     title: {
 *       structure: ["produto_principal", "variacao", "beneficio_chave"],
 *       idealLength: { min: 55, max: 60 },
 *       mustInclude: ["Nike", "Dri-Fit"],
 *       mustAvoid: ["promoção", "oferta", "imperdível"],
 *       suggestions: ["Incluir cor e tamanho no título"]
 *     },
 *     description: {
 *       openingFocus: "valor_diferenciacao",
 *       useBullets: true,
 *       avoidTitleRepetition: true,
 *       tone: "claro_informativo",
 *       suggestions: ["Destacar tecnologia Dri-Fit nas primeiras linhas"]
 *     }
 *   }
 * };
 */

// ============================================================
// TYPES & INTERFACES
// ============================================================

/**
 * Atributos do produto (brand, model, color, etc.)
 */
export interface ProductAttributes {
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  [key: string]: string | null | undefined;
}

/**
 * Input para a SEO Rule Engine
 */
export interface SeoRuleEngineInput {
  title: string;
  description: string | null;
  categoryId: string | null;
  attributes: ProductAttributes;
}

/**
 * Severidade do problema de SEO
 */
export type SeoIssueSeverity = 'error' | 'warning' | 'info';

/**
 * Campo afetado pelo problema
 */
export type SeoIssueField = 'title' | 'description' | 'both';

/**
 * Código do problema de SEO (para tracking e i18n)
 */
export type SeoIssueCode =
  // Title issues
  | 'TITLE_TOO_SHORT'
  | 'TITLE_TOO_LONG'
  | 'TITLE_EXCESSIVE_REPETITION'
  | 'TITLE_GENERIC_TERMS'
  | 'TITLE_MISSING_BRAND'
  | 'TITLE_MISSING_MODEL'
  | 'TITLE_WRONG_ORDER'
  | 'TITLE_ALL_CAPS'
  | 'TITLE_SPECIAL_CHARS'
  // Description issues
  | 'DESC_MISSING'
  | 'DESC_TOO_SHORT'
  | 'DESC_NO_BULLETS'
  | 'DESC_TITLE_REPETITION'
  | 'DESC_ADVERTISING_LANGUAGE'
  | 'DESC_WEAK_OPENING'
  | 'DESC_NO_DIFFERENTIATION';

/**
 * Problema de SEO identificado
 */
export interface SeoIssue {
  code: SeoIssueCode;
  severity: SeoIssueSeverity;
  message: string;
  field: SeoIssueField;
  currentValue?: string;
  suggestion: string;
  impact: number; // Impacto no score (pontos perdidos)
}

/**
 * Estrutura recomendada para o título
 */
export type TitleStructureElement =
  | 'produto_principal'
  | 'variacao'
  | 'beneficio_chave'
  | 'marca'
  | 'modelo';

/**
 * Tom da descrição
 */
export type DescriptionTone = 'claro_informativo' | 'tecnico' | 'persuasivo_moderado';

/**
 * Guidelines para reescrita do título
 */
export interface TitleRewriteGuidelines {
  structure: TitleStructureElement[];
  idealLength: {
    min: number;
    max: number;
  };
  mustInclude: string[];
  mustAvoid: string[];
  suggestions: string[];
}

/**
 * Guidelines para reescrita da descrição
 */
export interface DescriptionRewriteGuidelines {
  openingFocus: 'valor_diferenciacao' | 'especificacoes' | 'beneficios';
  useBullets: boolean;
  avoidTitleRepetition: boolean;
  tone: DescriptionTone;
  minLength: number;
  suggestions: string[];
}

/**
 * Guidelines completas para reescrita
 */
export interface SeoRewriteGuidelines {
  title: TitleRewriteGuidelines;
  description: DescriptionRewriteGuidelines;
}

/**
 * Resultado completo da análise de SEO
 */
export interface SeoAnalysis {
  seoScore: number; // 0-100
  issues: SeoIssue[];
  rewriteGuidelines: SeoRewriteGuidelines;
  metadata: {
    analyzedAt: string;
    engineVersion: string;
    titleLength: number;
    descriptionLength: number;
  };
}

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Termos genéricos que devem ser evitados no título
 * (não agregam valor de busca e ocupam espaço)
 */
const GENERIC_TERMS = [
  'promoção',
  'promocao',
  'oferta',
  'imperdível',
  'imperdivel',
  'super oferta',
  'mega oferta',
  'liquidação',
  'liquidacao',
  'queima',
  'barato',
  'mais barato',
  'melhor preço',
  'melhor preco',
  'frete grátis',
  'frete gratis',
  'desconto',
  'black friday',
  'cyber monday',
  'aproveite',
  'compre já',
  'compre ja',
  'últimas unidades',
  'ultimas unidades',
  'corra',
  'não perca',
  'nao perca',
  'exclusivo',
  'limitado',
  'só hoje',
  'so hoje',
];

/**
 * Termos publicitários que devem ser evitados na descrição
 */
const ADVERTISING_TERMS = [
  'o melhor do mercado',
  'qualidade incomparável',
  'qualidade incomparavel',
  'não vai se arrepender',
  'nao vai se arrepender',
  'garantia de satisfação',
  'garantia de satisfacao',
  'compre agora',
  'aproveite já',
  'aproveite ja',
  'oportunidade única',
  'oportunidade unica',
  'preço imbatível',
  'preco imbativel',
  'o mais vendido',
  'sucesso de vendas',
  'campeão de vendas',
  'campeao de vendas',
  'você não vai encontrar',
  'voce nao vai encontrar',
  'confie em nós',
  'confie em nos',
];

/**
 * Caracteres especiais que devem ser evitados no título
 */
const SPECIAL_CHARS_PATTERN = /[!@#$%^&*()+=[\]{}|\\:";'<>?,/~`★☆●○■□▲△▼▽◆◇♦♠♣♥]/g;

/**
 * Configurações de pontuação
 */
const SCORE_CONFIG = {
  TITLE_BASE: 50, // Pontos base para título
  DESC_BASE: 50, // Pontos base para descrição
  TITLE_LENGTH_IDEAL_MIN: 55,
  TITLE_LENGTH_IDEAL_MAX: 60,
  TITLE_LENGTH_MIN: 30,
  TITLE_LENGTH_MAX: 80,
  DESC_LENGTH_MIN: 200,
  DESC_LENGTH_IDEAL: 500,
};

// ============================================================
// SEO RULE ENGINE CLASS
// ============================================================

export class SeoRuleEngine {
  private readonly engineVersion = '1.0.0';

  /**
   * Analisa um anúncio e retorna a análise de SEO completa
   *
   * @param input Dados do anúncio para análise
   * @returns Análise de SEO com score, issues e guidelines
   */
  analyze(input: SeoRuleEngineInput): SeoAnalysis {
    const issues: SeoIssue[] = [];
    let titleScore = SCORE_CONFIG.TITLE_BASE;
    let descScore = SCORE_CONFIG.DESC_BASE;

    // Normalizar inputs
    const title = input.title?.trim() || '';
    const description = input.description?.trim() || '';
    const titleLength = title.length;
    const descriptionLength = this.stripHtml(description).length;

    // ========================================
    // ANÁLISE DO TÍTULO
    // ========================================

    // 1. Comprimento do título
    const titleLengthIssue = this.analyzeTitleLength(title, titleLength);
    if (titleLengthIssue) {
      issues.push(titleLengthIssue);
      titleScore -= titleLengthIssue.impact;
    }

    // 2. Repetição excessiva
    const repetitionIssue = this.analyzeTitleRepetition(title);
    if (repetitionIssue) {
      issues.push(repetitionIssue);
      titleScore -= repetitionIssue.impact;
    }

    // 3. Termos genéricos
    const genericTermsIssue = this.analyzeTitleGenericTerms(title);
    if (genericTermsIssue) {
      issues.push(genericTermsIssue);
      titleScore -= genericTermsIssue.impact;
    }

    // 4. Marca e modelo
    const brandModelIssues = this.analyzeTitleBrandModel(title, input.attributes);
    for (const issue of brandModelIssues) {
      issues.push(issue);
      titleScore -= issue.impact;
    }

    // 5. ALL CAPS
    const allCapsIssue = this.analyzeTitleAllCaps(title);
    if (allCapsIssue) {
      issues.push(allCapsIssue);
      titleScore -= allCapsIssue.impact;
    }

    // 6. Caracteres especiais
    const specialCharsIssue = this.analyzeTitleSpecialChars(title);
    if (specialCharsIssue) {
      issues.push(specialCharsIssue);
      titleScore -= specialCharsIssue.impact;
    }

    // ========================================
    // ANÁLISE DA DESCRIÇÃO
    // ========================================

    // 1. Descrição ausente
    if (!description || descriptionLength === 0) {
      issues.push({
        code: 'DESC_MISSING',
        severity: 'error',
        message: 'Descrição ausente. Anúncios sem descrição têm menor conversão.',
        field: 'description',
        suggestion: 'Adicione uma descrição detalhada com especificações e benefícios do produto.',
        impact: 25,
      });
      descScore -= 25;
    } else {
      // 2. Descrição muito curta
      const descLengthIssue = this.analyzeDescriptionLength(description, descriptionLength);
      if (descLengthIssue) {
        issues.push(descLengthIssue);
        descScore -= descLengthIssue.impact;
      }

      // 3. Uso de bullets
      const bulletsIssue = this.analyzeDescriptionBullets(description);
      if (bulletsIssue) {
        issues.push(bulletsIssue);
        descScore -= bulletsIssue.impact;
      }

      // 4. Repetição do título
      const titleRepetitionIssue = this.analyzeDescriptionTitleRepetition(title, description);
      if (titleRepetitionIssue) {
        issues.push(titleRepetitionIssue);
        descScore -= titleRepetitionIssue.impact;
      }

      // 5. Linguagem publicitária
      const advertisingIssue = this.analyzeDescriptionAdvertising(description);
      if (advertisingIssue) {
        issues.push(advertisingIssue);
        descScore -= advertisingIssue.impact;
      }

      // 6. Abertura fraca
      const weakOpeningIssue = this.analyzeDescriptionOpening(description);
      if (weakOpeningIssue) {
        issues.push(weakOpeningIssue);
        descScore -= weakOpeningIssue.impact;
      }
    }

    // Calcular score final (clamp entre 0-100)
    const finalScore = Math.max(0, Math.min(100, Math.round((titleScore + descScore) / 2)));

    // Gerar guidelines
    const rewriteGuidelines = this.generateRewriteGuidelines(input, issues);

    return {
      seoScore: finalScore,
      issues: issues.sort((a, b) => {
        // Ordenar por severidade (error > warning > info) e depois por impacto
        const severityOrder = { error: 0, warning: 1, info: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.impact - a.impact;
      }),
      rewriteGuidelines,
      metadata: {
        analyzedAt: new Date().toISOString(),
        engineVersion: this.engineVersion,
        titleLength,
        descriptionLength,
      },
    };
  }

  // ============================================================
  // TITLE ANALYSIS METHODS
  // ============================================================

  private analyzeTitleLength(title: string, length: number): SeoIssue | null {
    if (length < SCORE_CONFIG.TITLE_LENGTH_MIN) {
      return {
        code: 'TITLE_TOO_SHORT',
        severity: 'warning',
        message: `Título com ${length} caracteres. Ideal: ${SCORE_CONFIG.TITLE_LENGTH_IDEAL_MIN}-${SCORE_CONFIG.TITLE_LENGTH_IDEAL_MAX} caracteres.`,
        field: 'title',
        currentValue: title,
        suggestion:
          'Expanda o título incluindo variações (cor, tamanho) e benefícios-chave do produto.',
        impact: 10,
      };
    }

    if (length > SCORE_CONFIG.TITLE_LENGTH_MAX) {
      return {
        code: 'TITLE_TOO_LONG',
        severity: 'warning',
        message: `Título com ${length} caracteres. Máximo recomendado: ${SCORE_CONFIG.TITLE_LENGTH_MAX} caracteres.`,
        field: 'title',
        currentValue: title,
        suggestion:
          'Reduza o título removendo informações redundantes. Foque no essencial: produto + variação + benefício.',
        impact: 8,
      };
    }

    // Título fora do ideal mas aceitável
    if (length < SCORE_CONFIG.TITLE_LENGTH_IDEAL_MIN) {
      return {
        code: 'TITLE_TOO_SHORT',
        severity: 'info',
        message: `Título com ${length} caracteres. Ideal: ${SCORE_CONFIG.TITLE_LENGTH_IDEAL_MIN}-${SCORE_CONFIG.TITLE_LENGTH_IDEAL_MAX} caracteres.`,
        field: 'title',
        currentValue: title,
        suggestion: 'Considere adicionar mais detalhes relevantes para melhorar a busca.',
        impact: 5,
      };
    }

    if (length > SCORE_CONFIG.TITLE_LENGTH_IDEAL_MAX) {
      return {
        code: 'TITLE_TOO_LONG',
        severity: 'info',
        message: `Título com ${length} caracteres. Ideal: ${SCORE_CONFIG.TITLE_LENGTH_IDEAL_MIN}-${SCORE_CONFIG.TITLE_LENGTH_IDEAL_MAX} caracteres.`,
        field: 'title',
        currentValue: title,
        suggestion: 'Considere reduzir levemente para melhor exibição nos resultados de busca.',
        impact: 3,
      };
    }

    return null;
  }

  private analyzeTitleRepetition(title: string): SeoIssue | null {
    const words = title.toLowerCase().split(/\s+/);
    const wordCount: Record<string, number> = {};

    // Ignorar palavras muito curtas (artigos, preposições)
    const significantWords = words.filter((w) => w.length > 3);

    for (const word of significantWords) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }

    const repeatedWords = Object.entries(wordCount)
      .filter(([, count]) => count > 2)
      .map(([word]) => word);

    if (repeatedWords.length > 0) {
      return {
        code: 'TITLE_EXCESSIVE_REPETITION',
        severity: 'warning',
        message: `Palavras repetidas excessivamente: "${repeatedWords.join('", "')}".`,
        field: 'title',
        currentValue: title,
        suggestion:
          'Evite repetir palavras mais de 2 vezes. Use sinônimos ou remova redundâncias.',
        impact: 8,
      };
    }

    return null;
  }

  private analyzeTitleGenericTerms(title: string): SeoIssue | null {
    const titleLower = title.toLowerCase();
    const foundTerms = GENERIC_TERMS.filter((term) => titleLower.includes(term));

    if (foundTerms.length > 0) {
      return {
        code: 'TITLE_GENERIC_TERMS',
        severity: 'warning',
        message: `Termos genéricos encontrados: "${foundTerms.join('", "')}".`,
        field: 'title',
        currentValue: title,
        suggestion:
          'Remova termos promocionais. Use o espaço para palavras-chave que descrevam o produto.',
        impact: 10,
      };
    }

    return null;
  }

  private analyzeTitleBrandModel(title: string, attributes: ProductAttributes): SeoIssue[] {
    const issues: SeoIssue[] = [];
    const titleLower = title.toLowerCase();

    // Verificar marca
    if (attributes.brand) {
      const brandLower = attributes.brand.toLowerCase();
      if (!titleLower.includes(brandLower)) {
        issues.push({
          code: 'TITLE_MISSING_BRAND',
          severity: 'info',
          message: `Marca "${attributes.brand}" não encontrada no título.`,
          field: 'title',
          currentValue: title,
          suggestion: `Inclua a marca "${attributes.brand}" no início do título para melhorar a busca.`,
          impact: 5,
        });
      }
    }

    // Verificar modelo
    if (attributes.model) {
      const modelLower = attributes.model.toLowerCase();
      if (!titleLower.includes(modelLower)) {
        issues.push({
          code: 'TITLE_MISSING_MODEL',
          severity: 'info',
          message: `Modelo "${attributes.model}" não encontrado no título.`,
          field: 'title',
          currentValue: title,
          suggestion: `Inclua o modelo "${attributes.model}" após a marca para facilitar a identificação.`,
          impact: 5,
        });
      }
    }

    return issues;
  }

  private analyzeTitleAllCaps(title: string): SeoIssue | null {
    // Verificar se mais de 50% do título está em CAPS
    const letters = title.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    const upperCase = letters.replace(/[^A-ZÀ-Ÿ]/g, '');

    if (letters.length > 10 && upperCase.length / letters.length > 0.5) {
      return {
        code: 'TITLE_ALL_CAPS',
        severity: 'warning',
        message: 'Título com excesso de letras maiúsculas.',
        field: 'title',
        currentValue: title,
        suggestion:
          'Use capitalização normal (primeira letra maiúscula). ALL CAPS dificulta a leitura.',
        impact: 8,
      };
    }

    return null;
  }

  private analyzeTitleSpecialChars(title: string): SeoIssue | null {
    const matches = title.match(SPECIAL_CHARS_PATTERN);

    if (matches && matches.length > 0) {
      return {
        code: 'TITLE_SPECIAL_CHARS',
        severity: 'info',
        message: `Caracteres especiais encontrados: "${[...new Set(matches)].join('')}".`,
        field: 'title',
        currentValue: title,
        suggestion:
          'Evite caracteres especiais no título. Use apenas letras, números e hífens quando necessário.',
        impact: 3,
      };
    }

    return null;
  }

  // ============================================================
  // DESCRIPTION ANALYSIS METHODS
  // ============================================================

  private analyzeDescriptionLength(description: string, length: number): SeoIssue | null {
    if (length < SCORE_CONFIG.DESC_LENGTH_MIN) {
      return {
        code: 'DESC_TOO_SHORT',
        severity: 'warning',
        message: `Descrição com ${length} caracteres. Mínimo recomendado: ${SCORE_CONFIG.DESC_LENGTH_MIN} caracteres.`,
        field: 'description',
        suggestion:
          'Expanda a descrição com especificações técnicas, benefícios e diferenciais do produto.',
        impact: 12,
      };
    }

    return null;
  }

  private analyzeDescriptionBullets(description: string): SeoIssue | null {
    // Verificar presença de bullets/listas
    const hasBullets =
      /[-•●○■□▪▫★☆]\s/.test(description) ||
      /<li>/i.test(description) ||
      /^\s*[-*]\s/m.test(description);

    if (!hasBullets && description.length > 300) {
      return {
        code: 'DESC_NO_BULLETS',
        severity: 'info',
        message: 'Descrição sem uso de bullets ou listas.',
        field: 'description',
        suggestion:
          'Use bullets para destacar características principais. Facilita a leitura e aumenta conversão.',
        impact: 5,
      };
    }

    return null;
  }

  private analyzeDescriptionTitleRepetition(title: string, description: string): SeoIssue | null {
    const descClean = this.stripHtml(description).toLowerCase();
    const titleClean = title.toLowerCase().trim();

    // Verificar se o título aparece literalmente na descrição
    if (descClean.includes(titleClean)) {
      return {
        code: 'DESC_TITLE_REPETITION',
        severity: 'warning',
        message: 'Título repetido literalmente na descrição.',
        field: 'description',
        suggestion:
          'Evite copiar o título na descrição. Use o espaço para informações complementares.',
        impact: 8,
      };
    }

    return null;
  }

  private analyzeDescriptionAdvertising(description: string): SeoIssue | null {
    const descLower = description.toLowerCase();
    const foundTerms = ADVERTISING_TERMS.filter((term) => descLower.includes(term));

    if (foundTerms.length >= 2) {
      return {
        code: 'DESC_ADVERTISING_LANGUAGE',
        severity: 'warning',
        message: `Linguagem publicitária excessiva: "${foundTerms.slice(0, 3).join('", "')}".`,
        field: 'description',
        suggestion:
          'Use linguagem clara e informativa. Foque em especificações e benefícios reais.',
        impact: 8,
      };
    }

    return null;
  }

  private analyzeDescriptionOpening(description: string): SeoIssue | null {
    const cleanDesc = this.stripHtml(description);
    const firstLines = cleanDesc.substring(0, 200).toLowerCase();

    // Verificar se as primeiras linhas têm conteúdo de valor
    const weakOpenings = [
      'olá',
      'ola',
      'bem-vindo',
      'bem vindo',
      'obrigado',
      'seja bem-vindo',
      'seja bem vindo',
      'confira',
      'veja',
      'aproveite',
      'não perca',
      'nao perca',
    ];

    const startsWeak = weakOpenings.some((term) => firstLines.startsWith(term));

    if (startsWeak) {
      return {
        code: 'DESC_WEAK_OPENING',
        severity: 'info',
        message: 'Abertura da descrição não destaca valor ou diferenciação.',
        field: 'description',
        suggestion:
          'Comece a descrição com o principal benefício ou diferencial do produto. As 3 primeiras linhas são cruciais.',
        impact: 5,
      };
    }

    return null;
  }

  // ============================================================
  // GUIDELINES GENERATION
  // ============================================================

  private generateRewriteGuidelines(
    input: SeoRuleEngineInput,
    issues: SeoIssue[]
  ): SeoRewriteGuidelines {
    const titleSuggestions: string[] = [];
    const descSuggestions: string[] = [];

    // Coletar sugestões dos issues
    for (const issue of issues) {
      if (issue.field === 'title' || issue.field === 'both') {
        titleSuggestions.push(issue.suggestion);
      }
      if (issue.field === 'description' || issue.field === 'both') {
        descSuggestions.push(issue.suggestion);
      }
    }

    // Determinar o que deve ser incluído no título
    const mustInclude: string[] = [];
    if (input.attributes.brand) {
      mustInclude.push(input.attributes.brand);
    }
    if (input.attributes.model) {
      mustInclude.push(input.attributes.model);
    }

    // Adicionar sugestões específicas baseadas nos atributos
    if (input.attributes.color && !input.title.toLowerCase().includes(input.attributes.color.toLowerCase())) {
      titleSuggestions.push(`Considere incluir a cor "${input.attributes.color}" no título`);
    }
    if (input.attributes.size && !input.title.toLowerCase().includes(input.attributes.size.toLowerCase())) {
      titleSuggestions.push(`Considere incluir o tamanho "${input.attributes.size}" no título`);
    }

    return {
      title: {
        structure: ['produto_principal', 'variacao', 'beneficio_chave'],
        idealLength: {
          min: SCORE_CONFIG.TITLE_LENGTH_IDEAL_MIN,
          max: SCORE_CONFIG.TITLE_LENGTH_IDEAL_MAX,
        },
        mustInclude,
        mustAvoid: GENERIC_TERMS.slice(0, 10), // Top 10 termos a evitar
        suggestions: [...new Set(titleSuggestions)], // Remove duplicatas
      },
      description: {
        openingFocus: 'valor_diferenciacao',
        useBullets: true,
        avoidTitleRepetition: true,
        tone: 'claro_informativo',
        minLength: SCORE_CONFIG.DESC_LENGTH_MIN,
        suggestions: [...new Set(descSuggestions)], // Remove duplicatas
      },
    };
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  private stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }
}

// ============================================================
// FACTORY FUNCTION (para consistência com outros services)
// ============================================================

/**
 * Cria uma instância da SEO Rule Engine
 *
 * @returns Instância da SeoRuleEngine
 *
 * @example
 * const engine = createSeoRuleEngine();
 * const analysis = engine.analyze({
 *   title: "Camiseta Nike Dri-Fit Masculina",
 *   description: "Camiseta esportiva...",
 *   categoryId: "MLB123",
 *   attributes: { brand: "Nike", model: "Dri-Fit" }
 * });
 */
export function createSeoRuleEngine(): SeoRuleEngine {
  return new SeoRuleEngine();
}
