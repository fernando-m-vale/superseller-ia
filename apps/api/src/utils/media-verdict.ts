/**
 * Media Verdict - Fonte Única de Verdade para Mídia
 * 
 * Este utilitário determina de forma determinística o que pode ser afirmado
 * sobre clips (vídeo) de anúncios, garantindo que nunca afirmemos ausência
 * quando os dados são null ou true.
 * 
 * REGRAS OBRIGATÓRIAS:
 * - hasClips continua existindo apenas como sinal interno
 * - o seller-facing não recomenda nem exibe clip
 * - a mensagem pública deve focar em leitura visual/galeria
 */

export interface MediaVerdict {
  /** Classificação determinística do status de clip */
  clipStatus: 'HAS_CLIP' | 'NO_CLIP' | 'INCONCLUSIVE';
  /** Se clip foi detectado via API (true) ou não (false) ou não detectável (null) */
  hasClipDetected: boolean | null;
  /** Mantido por compatibilidade; seller-facing não recomenda clip */
  canSuggestClip: boolean;
  /** Mensagem pública focada em galeria/qualidade visual */
  message: string;
  /** Mensagem curta para tooltips/badges */
  shortMessage: string;
}

/**
 * Gera verdict determinístico sobre mídia (clips)
 * 
 * @param hasClips - Status do clip: true (tem), false (não tem), null (não detectável)
 * @param picturesCount - Quantidade de imagens (opcional, para contexto)
 * @returns MediaVerdict com decisão determinística
 */
export function getMediaVerdict(
  hasClips: boolean | null,
  picturesCount?: number | null
): MediaVerdict {
  const picturesContext = picturesCount !== null && picturesCount !== undefined
    ? picturesCount >= 8
      ? ' Galeria já está robusta.'
      : picturesCount >= 6
      ? ' Galeria está suficiente.'
      : ' Ainda vale ampliar a galeria com mais contexto visual.'
    : '';

  if (hasClips === true) {
    return {
      clipStatus: 'HAS_CLIP',
      hasClipDetected: true,
      canSuggestClip: false,
      message: `A mídia do anúncio já conta com boa cobertura visual.${picturesContext}`,
      shortMessage: 'Cobertura visual forte',
    };
  }

  if (hasClips === false) {
    return {
      clipStatus: 'NO_CLIP',
      hasClipDetected: false,
      canSuggestClip: false,
      message: `A prioridade de mídia aqui é fortalecer a galeria e o contexto visual da oferta.${picturesContext}`,
      shortMessage: 'Galeria pode evoluir',
    };
  }

  return {
    clipStatus: 'INCONCLUSIVE',
    hasClipDetected: null,
    canSuggestClip: false,
    message: `A leitura visual foi avaliada com base na galeria disponível.${picturesContext}`,
    shortMessage: 'Leitura visual parcial',
  };
}

/**
 * Verifica se é seguro afirmar que o anúncio NÃO tem clip
 * 
 * @param hasClips - Status do clip
 * @returns true apenas se hasClips === false (certeza de ausência)
 */
export function canAffirmNoClip(hasClips: boolean | null): boolean {
  return hasClips === false;
}

/**
 * Verifica se é seguro afirmar que o anúncio TEM clip
 * 
 * @param hasClips - Status do clip
 * @returns true apenas se hasClips === true (certeza de presença)
 */
export function canAffirmHasClip(hasClips: boolean | null): boolean {
  return hasClips === true;
}

/**
 * Verifica se clip é detectável via API
 * 
 * @param hasClips - Status do clip
 * @returns true se hasClips não é null (foi detectado via API)
 */
export function isClipStatusKnown(hasClips: boolean | null): boolean {
  return hasClips !== null;
}
