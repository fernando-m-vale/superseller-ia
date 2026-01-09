/**
 * Media Verdict - Fonte Única de Verdade para Mídia
 * 
 * Este utilitário determina de forma determinística o que pode ser afirmado
 * sobre vídeo/clips de anúncios, garantindo que nunca afirmemos ausência
 * quando os dados são null ou true.
 * 
 * REGRAS OBRIGATÓRIAS:
 * - hasVideo === true  → canSuggestVideo = false, message afirma presença
 * - hasVideo === false → canSuggestVideo = true, message sugere adicionar
 * - hasVideo === null  → canSuggestVideo = false, message SEMPRE condicional
 */

export interface MediaVerdict {
  /** Se vídeo foi detectado via API (true) ou não (false) ou não detectável (null) */
  hasVideoDetected: boolean | null;
  /** Se é seguro sugerir adicionar vídeo (false quando já tem ou quando null) */
  canSuggestVideo: boolean;
  /** Mensagem determinística que pode ser usada em UI/IA */
  message: string;
  /** Mensagem curta para tooltips/badges */
  shortMessage: string;
}

/**
 * Gera verdict determinístico sobre mídia (vídeo/clips)
 * 
 * @param hasVideo - Status do vídeo: true (tem), false (não tem), null (não detectável)
 * @param picturesCount - Quantidade de imagens (opcional, para contexto)
 * @returns MediaVerdict com decisão determinística
 */
export function getMediaVerdict(
  hasVideo: boolean | null,
  picturesCount?: number | null
): MediaVerdict {
  // REGRA 1: hasVideo === true → NUNCA sugerir vídeo, SEMPRE afirmar presença
  if (hasVideo === true) {
    return {
      hasVideoDetected: true,
      canSuggestVideo: false,
      message: 'O anúncio possui vídeo/clips. Mídia está completa.',
      shortMessage: 'Vídeo presente',
    };
  }

  // REGRA 2: hasVideo === false → PODE sugerir vídeo, afirmar ausência
  if (hasVideo === false) {
    const picturesContext = picturesCount !== null && picturesCount !== undefined
      ? picturesCount >= 8
        ? ' Imagens estão suficientes.'
        : picturesCount >= 6
        ? ' Considere adicionar mais imagens também.'
        : ' Considere adicionar mais imagens e vídeo/clips.'
      : '';
    
    return {
      hasVideoDetected: false,
      canSuggestVideo: true,
      message: `O anúncio não possui vídeo/clips. Adicionar vídeo pode melhorar engajamento e conversão.${picturesContext}`,
      shortMessage: 'Sem vídeo',
    };
  }

  // REGRA 3: hasVideo === null → NUNCA sugerir vídeo, SEMPRE linguagem condicional
  const picturesContext = picturesCount !== null && picturesCount !== undefined
    ? picturesCount >= 8
      ? ' Imagens estão boas.'
      : picturesCount >= 6
      ? ' Imagens estão suficientes.'
      : ' Considere adicionar mais imagens.'
    : '';
  
  return {
    hasVideoDetected: null,
    canSuggestVideo: false,
    message: `Não foi possível confirmar via API se o anúncio possui vídeo/clips. Valide no painel do Mercado Livre.${picturesContext}`,
    shortMessage: 'Não detectável via API',
  };
}

/**
 * Verifica se é seguro afirmar que o anúncio NÃO tem vídeo
 * 
 * @param hasVideo - Status do vídeo
 * @returns true apenas se hasVideo === false (certeza de ausência)
 */
export function canAffirmNoVideo(hasVideo: boolean | null): boolean {
  return hasVideo === false;
}

/**
 * Verifica se é seguro afirmar que o anúncio TEM vídeo
 * 
 * @param hasVideo - Status do vídeo
 * @returns true apenas se hasVideo === true (certeza de presença)
 */
export function canAffirmHasVideo(hasVideo: boolean | null): boolean {
  return hasVideo === true;
}

/**
 * Verifica se vídeo é detectável via API
 * 
 * @param hasVideo - Status do vídeo
 * @returns true se hasVideo não é null (foi detectado via API)
 */
export function isVideoStatusKnown(hasVideo: boolean | null): boolean {
  return hasVideo !== null;
}

