/**
 * Media Verdict - Fonte Única de Verdade para Mídia
 * 
 * Este utilitário determina de forma determinística o que pode ser afirmado
 * sobre clips (vídeo) de anúncios, garantindo que nunca afirmemos ausência
 * quando os dados são null ou true.
 * 
 * IMPORTANTE: No Mercado Livre, sellers têm "CLIP". Usar termo "clip" consistentemente.
 * 
 * REGRAS OBRIGATÓRIAS:
 * - hasClips === true  → canSuggestClip = false, message afirma presença
 * - hasClips === false → canSuggestClip = true, message sugere adicionar
 * - hasClips === null  → canSuggestClip = false, message SEMPRE condicional
 */

export interface MediaVerdict {
  /** Se clip foi detectado via API (true) ou não (false) ou não detectável (null) */
  hasClipDetected: boolean | null;
  /** Se é seguro sugerir adicionar clip (false quando já tem ou quando null) */
  canSuggestClip: boolean;
  /** Mensagem determinística que pode ser usada em UI/IA */
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
  // REGRA 1: hasClips === true → NUNCA sugerir clip, SEMPRE afirmar presença
  if (hasClips === true) {
    return {
      hasClipDetected: true,
      canSuggestClip: false,
      message: 'O anúncio possui clip. Mídia está completa.',
      shortMessage: 'Clip presente',
    };
  }

  // REGRA 2: hasClips === false → PODE sugerir clip, afirmar ausência
  if (hasClips === false) {
    const picturesContext = picturesCount !== null && picturesCount !== undefined
      ? picturesCount >= 8
        ? ' Imagens estão suficientes.'
        : picturesCount >= 6
        ? ' Considere adicionar mais imagens também.'
        : ' Considere adicionar mais imagens e clip.'
      : '';
    
    return {
      hasClipDetected: false,
      canSuggestClip: true,
      message: `O anúncio não possui clip. Adicionar clip pode melhorar engajamento e conversão.${picturesContext}`,
      shortMessage: 'Sem clip',
    };
  }

  // REGRA 3: hasClips === null → NUNCA sugerir clip, SEMPRE linguagem condicional
  const picturesContext = picturesCount !== null && picturesCount !== undefined
    ? picturesCount >= 8
      ? ' Imagens estão boas.'
      : picturesCount >= 6
      ? ' Imagens estão suficientes.'
      : ' Considere adicionar mais imagens.'
    : '';
  
  return {
    hasClipDetected: null,
    canSuggestClip: false,
    message: `Não foi possível confirmar via API se o anúncio possui clip. Valide no painel do Mercado Livre.${picturesContext}`,
    shortMessage: 'Não detectável via API',
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

