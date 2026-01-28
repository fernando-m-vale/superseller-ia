/**
 * AI Analysis Result V2.1
 * 
 * Estrutura JSON estruturada retornada pela IA V2.1.
 * Compatível com o tipo do backend (apps/api/src/types/ai-analysis-v21.ts).
 * Schema REAL retornado pela API em response.data.data.analysisV21
 */

/**
 * Metadados da análise
 */
export interface AnalysisMetaV21 {
  version: '2.1';
  model: string; // ex: "gpt-4o"
  analyzed_at: string; // ISO 8601
  prompt_version: string;
  processing_time_ms?: number;
  cache_hit?: boolean;
  error?: string;
}

/**
 * Score breakdown
 */
export interface ScoreBreakdownV21 {
  cadastro: number; // 0-20
  midia: number; // 0-20
  performance: number; // 0-30
  seo: number; // 0-20
  competitividade: number; // 0-10
}

/**
 * Score completo
 */
export interface ScoreV21 {
  final: number; // 0-100
  breakdown: ScoreBreakdownV21;
  potential_gain: number;
}

/**
 * Diagnóstico geral do anúncio
 */
export interface DiagnosticV21 {
  overall_health: 'critical' | 'needs_attention' | 'good' | 'excellent';
  main_bottleneck: string;
  quick_wins: string[];
  long_term: string[];
}

/**
 * Ação concreta e acionável
 */
export interface ActionItemV21 {
  id: string;
  type: 'title' | 'description' | 'media' | 'price' | 'stock' | 'seo' | 'promotion';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: {
    metric: string;
    estimated_gain: string;
    confidence: 'high' | 'medium' | 'low';
  };
  how_to: string[];
  ml_deeplink?: string;
}

/**
 * Sugestão de título
 */
export interface TitleSuggestionV21 {
  text: string;
  focus: 'seo' | 'conversion' | 'promotion';
  rationale: string;
}

/**
 * Análise de título
 */
export interface TitleAnalysisV21 {
  current: string;
  score: number; // 0-100
  issues: string[];
  suggestions: TitleSuggestionV21[];
  keywords: {
    present: string[];
    missing: string[];
    recommended: string[];
  };
}

/**
 * Estrutura sugerida para descrição
 */
export interface DescriptionStructureV21 {
  section: string;
  content: string;
}

/**
 * Análise de descrição
 */
export interface DescriptionAnalysisV21 {
  current_length: number;
  score: number; // 0-100
  has_description: boolean;
  issues: string[];
  structure: {
    has_headline: boolean;
    has_benefits: boolean;
    has_specs: boolean;
    has_trust_elements: boolean;
  };
  suggested_structure: DescriptionStructureV21[];
}

/**
 * Análise de mídia (fotos)
 */
export interface PhotosAnalysisV21 {
  count: number;
  score: number; // 0-100
  is_sufficient: boolean;
  issues: string[];
  recommendations: string[];
}

/**
 * Análise de vídeo
 */
export interface VideoAnalysisV21 {
  has_video: boolean | null;
  can_suggest: boolean;
  status_message: string;
  recommendation?: string | null;
}

/**
 * Análise de mídia
 */
export interface MediaAnalysisV21 {
  photos: PhotosAnalysisV21;
  video: VideoAnalysisV21;
}

/**
 * Análise de preço e promoção
 */
export interface PriceAnalysisV21 {
  price_base: number;
  price_final: number;
  has_promotion: boolean;
  discount_percent: number | null;
  score: number; // 0-100
  analysis: string;
  recommendation: string | null;
}

/**
 * Qualidade dos dados
 */
export interface DataQualityV21 {
  visits_status: 'ok' | 'partial' | 'unavailable';
  performance_available: boolean;
  warnings: string[];
}

/**
 * Resultado completo da análise V2.1
 */
export interface AIAnalysisResultV21 {
  meta: AnalysisMetaV21;
  score: ScoreV21;
  diagnostic: DiagnosticV21;
  title_analysis: TitleAnalysisV21;
  description_analysis: DescriptionAnalysisV21;
  media_analysis: MediaAnalysisV21;
  price_analysis: PriceAnalysisV21;
  actions: ActionItemV21[];
  critique: string;
  data_quality: DataQualityV21;
}
