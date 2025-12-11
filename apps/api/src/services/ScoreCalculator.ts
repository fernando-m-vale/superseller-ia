/**
 * Super Seller Score Calculator
 * 
 * Algoritmo proprietário de pontuação de anúncios (0-100)
 * Baseado em 3 pilares: Cadastro, Tráfego e Disponibilidade
 */

export interface ScoreBreakdown {
  cadastro: number;       // Qualidade do Cadastro (máx 30)
  trafego: number;        // Saúde de Tráfego (máx 30)
  disponibilidade: number; // Status e Disponibilidade (máx 40)
  total: number;          // Score total (0-100)
  details: ScoreDetails;
}

export interface ScoreDetails {
  // Cadastro
  hasGoodTitle: boolean;      // Título > 20 chars (+10)
  hasDescription: boolean;    // Descrição > 100 chars (+10)
  hasGoodImage: boolean;      // Imagem de qualidade (+5)
  hasValidPrice: boolean;     // Preço > 0 (+5)
  
  // Tráfego
  hasRecentVisits: boolean;   // Visitas nos últimos 7 dias (+15)
  hasGoodConversion: boolean; // Conversão > 1% (+15)
  
  // Disponibilidade
  isActive: boolean;          // Status ativo (+20)
  hasStock: boolean;          // Estoque > 0 (+20)
}

export interface ListingForScore {
  id: string;
  title: string;
  description?: string | null;
  price: number | string; // Pode ser Decimal do Prisma
  stock: number;
  status: string;
  thumbnail_url?: string | null;
  pictures_count?: number | null;
  visits_last_7d?: number | null;
  sales_last_7d?: number | null;
}

export class ScoreCalculator {
  /**
   * Calcula o Super Seller Score de um anúncio
   */
  static calculate(listing: ListingForScore): ScoreBreakdown {
    const details: ScoreDetails = {
      hasGoodTitle: false,
      hasDescription: false,
      hasGoodImage: false,
      hasValidPrice: false,
      hasRecentVisits: false,
      hasGoodConversion: false,
      isActive: false,
      hasStock: false,
    };

    let cadastro = 0;
    let trafego = 0;
    let disponibilidade = 0;

    // ============================================
    // 1. QUALIDADE DO CADASTRO (Máximo: 30 pontos)
    // ============================================

    // Tem título > 20 caracteres? (+10)
    if (listing.title && listing.title.length > 20) {
      cadastro += 10;
      details.hasGoodTitle = true;
    }

    // Tem descrição > 100 caracteres? (+10)
    if (listing.description && listing.description.length > 100) {
      cadastro += 10;
      details.hasDescription = true;
    }

    // Tem imagem de qualidade? (+5)
    // Critério: tem thumbnail OU tem mais de 1 foto
    const picturesCount = listing.pictures_count ?? 0;
    if (listing.thumbnail_url || picturesCount > 1) {
      cadastro += 5;
      details.hasGoodImage = true;
    }

    // Preço preenchido e > 0? (+5)
    const price = typeof listing.price === 'string' 
      ? parseFloat(listing.price) 
      : Number(listing.price);
    if (price > 0) {
      cadastro += 5;
      details.hasValidPrice = true;
    }

    // ============================================
    // 2. SAÚDE DE TRÁFEGO (Máximo: 30 pontos)
    // ============================================

    const visits = listing.visits_last_7d ?? 0;
    const sales = listing.sales_last_7d ?? 0;

    // Teve visitas nos últimos 7 dias? (+15)
    if (visits > 0) {
      trafego += 15;
      details.hasRecentVisits = true;
    }

    // Taxa de conversão > 1%? (+15)
    // Conversão = Vendas / Visitas * 100
    if (visits > 0 && sales > 0) {
      const conversionRate = (sales / visits) * 100;
      if (conversionRate >= 1) {
        trafego += 15;
        details.hasGoodConversion = true;
      }
    }

    // ============================================
    // 3. STATUS E DISPONIBILIDADE (Máximo: 40 pontos)
    // ============================================

    // Status é 'active'? (+20)
    if (listing.status === 'active') {
      disponibilidade += 20;
      details.isActive = true;
    }

    // Estoque disponível > 0? (+20)
    if (listing.stock > 0) {
      disponibilidade += 20;
      details.hasStock = true;
    }

    // ============================================
    // TOTAL
    // ============================================
    const total = cadastro + trafego + disponibilidade;

    return {
      cadastro,
      trafego,
      disponibilidade,
      total,
      details,
    };
  }

  /**
   * Classifica o score em uma categoria
   */
  static getGrade(score: number): { label: string; color: string } {
    if (score >= 80) return { label: 'Excelente', color: 'green' };
    if (score >= 60) return { label: 'Bom', color: 'blue' };
    if (score >= 40) return { label: 'Regular', color: 'yellow' };
    return { label: 'Crítico', color: 'red' };
  }

  /**
   * Gera recomendações com base no breakdown
   */
  static getRecommendations(breakdown: ScoreBreakdown): string[] {
    const recommendations: string[] = [];
    const { details } = breakdown;

    // Cadastro
    if (!details.hasGoodTitle) {
      recommendations.push('Melhore o título: use mais de 20 caracteres com palavras-chave relevantes');
    }
    if (!details.hasDescription) {
      recommendations.push('Adicione uma descrição detalhada com mais de 100 caracteres');
    }
    if (!details.hasGoodImage) {
      recommendations.push('Adicione mais fotos de qualidade do seu produto');
    }
    if (!details.hasValidPrice) {
      recommendations.push('Defina um preço válido para o anúncio');
    }

    // Tráfego
    if (!details.hasRecentVisits) {
      recommendations.push('Seu anúncio não teve visitas recentes. Considere promovê-lo');
    }
    if (details.hasRecentVisits && !details.hasGoodConversion) {
      recommendations.push('Taxa de conversão baixa. Revise preço, fotos ou descrição');
    }

    // Disponibilidade
    if (!details.isActive) {
      recommendations.push('Anúncio pausado. Reative-o para voltar a vender');
    }
    if (!details.hasStock) {
      recommendations.push('Anúncio sem estoque. Reponha o estoque para continuar vendendo');
    }

    return recommendations;
  }
}

