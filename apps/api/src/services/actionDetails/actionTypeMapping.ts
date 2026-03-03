/**
 * Mapeamento ActionType → Artifacts (required/optional)
 * 
 * Define quais artifacts são obrigatórios para cada tipo de ação.
 * Usado para validação e construção de prompts específicos.
 */

export type ActionType =
  | 'SEO_TITLE_REWRITE'
  | 'DESCRIPTION_REWRITE_BLOCKS'
  | 'MEDIA_GALLERY_PLAN'
  | 'MEDIA_ADD_VIDEO_CLIP'
  | 'TECH_SPECS_FILL_ATTRIBUTES'
  | 'VARIATIONS_ADD'
  | 'KITS_CREATE_COMBO'
  | 'PRICE_PSYCHOLOGICAL'
  | 'CATEGORY_VERIFY_BREADCRUMB'
  | 'TRUST_GUARANTEES_HIGHLIGHT'
  | 'SEO_KEYWORDS_ENRICH'
  | 'UNKNOWN'; // fallback para actionKeys não mapeados

export interface RequiredArtifacts {
  copy?: {
    titleSuggestions?: boolean;
    descriptionTemplate?: boolean;
    bulletSuggestions?: boolean;
    keywordSuggestions?: boolean;
  };
  media?: {
    galleryPlan?: boolean;
    videoScript?: boolean;
  };
  pricing?: {
    suggestions?: boolean;
  };
  variations?: boolean;
  kits?: boolean;
  techSpecs?: boolean;
  trustGuarantees?: boolean;
}

/**
 * Mapeia actionKey (string) para ActionType (enum)
 * 
 * Heurística baseada em padrões comuns:
 * - seo_title* → SEO_TITLE_REWRITE
 * - seo_description* → DESCRIPTION_REWRITE_BLOCKS
 * - midia_gallery* → MEDIA_GALLERY_PLAN
 * - midia_video* → MEDIA_ADD_VIDEO_CLIP
 * - price* → PRICE_PSYCHOLOGICAL
 * - category* → CATEGORY_VERIFY_BREADCRUMB
 * - variation* → VARIATIONS_ADD
 * - kit* → KITS_CREATE_COMBO
 * - tech* → TECH_SPECS_FILL_ATTRIBUTES
 * - trust* → TRUST_GUARANTEES_HIGHLIGHT
 * - keyword* → SEO_KEYWORDS_ENRICH
 */
export function mapActionKeyToActionType(actionKey: string): ActionType {
  const key = actionKey.toLowerCase();
  
  if (key.includes('seo_title') || key.includes('title_refresh') || key.includes('title_rewrite')) {
    return 'SEO_TITLE_REWRITE';
  }
  if (key.includes('seo_description') || key.includes('description_blocks') || key.includes('description_rewrite')) {
    return 'DESCRIPTION_REWRITE_BLOCKS';
  }
  if (key.includes('midia_gallery') || key.includes('gallery_upgrade') || key.includes('gallery_plan')) {
    return 'MEDIA_GALLERY_PLAN';
  }
  if (key.includes('midia_video') || key.includes('video_clip') || key.includes('add_video')) {
    return 'MEDIA_ADD_VIDEO_CLIP';
  }
  if (key.includes('price') || key.includes('pricing')) {
    return 'PRICE_PSYCHOLOGICAL';
  }
  if (key.includes('category') || key.includes('breadcrumb')) {
    return 'CATEGORY_VERIFY_BREADCRUMB';
  }
  if (key.includes('variation') || key.includes('variacoes')) {
    return 'VARIATIONS_ADD';
  }
  if (key.includes('kit') || key.includes('combo')) {
    return 'KITS_CREATE_COMBO';
  }
  if (key.includes('tech') || key.includes('spec') || key.includes('attribute') || key.includes('atributo')) {
    return 'TECH_SPECS_FILL_ATTRIBUTES';
  }
  if (key.includes('trust') || key.includes('guarantee') || key.includes('garantia')) {
    return 'TRUST_GUARANTEES_HIGHLIGHT';
  }
  if (key.includes('keyword') || key.includes('palavra_chave')) {
    return 'SEO_KEYWORDS_ENRICH';
  }
  
  return 'UNKNOWN';
}

/**
 * Define artifacts obrigatórios para cada ActionType
 */
export const ACTION_TYPE_REQUIRED_ARTIFACTS: Record<ActionType, RequiredArtifacts> = {
  SEO_TITLE_REWRITE: {
    copy: {
      titleSuggestions: true,
      keywordSuggestions: true,
    },
  },
  DESCRIPTION_REWRITE_BLOCKS: {
    copy: {
      descriptionTemplate: true,
      bulletSuggestions: true,
      keywordSuggestions: true,
    },
  },
  MEDIA_GALLERY_PLAN: {
    media: {
      galleryPlan: true,
    },
  },
  MEDIA_ADD_VIDEO_CLIP: {
    media: {
      videoScript: true,
    },
  },
  TECH_SPECS_FILL_ATTRIBUTES: {
    techSpecs: true,
  },
  VARIATIONS_ADD: {
    variations: true,
  },
  KITS_CREATE_COMBO: {
    kits: true,
  },
  PRICE_PSYCHOLOGICAL: {
    pricing: {
      suggestions: true,
    },
  },
  CATEGORY_VERIFY_BREADCRUMB: {
    // Não requer artifacts específicos, apenas validação
  },
  TRUST_GUARANTEES_HIGHLIGHT: {
    trustGuarantees: true,
  },
  SEO_KEYWORDS_ENRICH: {
    copy: {
      keywordSuggestions: true,
    },
  },
  UNKNOWN: {
    // Fallback: não requer artifacts específicos
  },
};

/**
 * Retorna artifacts obrigatórios para um actionKey
 */
export function getRequiredArtifactsForActionKey(actionKey: string): RequiredArtifacts {
  const actionType = mapActionKeyToActionType(actionKey);
  return ACTION_TYPE_REQUIRED_ARTIFACTS[actionType] || {};
}
