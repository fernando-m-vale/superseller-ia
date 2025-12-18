/**
 * Sanitize Error Utility
 * 
 * Remove informações sensíveis de erros antes de logar ou retornar ao cliente.
 * Garante que stack traces, tokens e detalhes internos não sejam expostos.
 */

interface SanitizedError {
  message: string;
  code?: string;
  statusCode?: number;
  type?: string;
}

/**
 * Sanita um erro removendo informações sensíveis
 * 
 * @param error - Erro original (pode ser Error, objeto ou string)
 * @param includeDetails - Se true, inclui código/tipo (apenas para logs internos)
 * @returns Erro sanitizado seguro para logar ou retornar ao cliente
 */
export function sanitizeError(
  error: unknown,
  includeDetails: boolean = false
): SanitizedError {
  // Se for string, retornar como mensagem
  if (typeof error === 'string') {
    return { message: error };
  }

  // Se não for objeto, retornar mensagem genérica
  if (!error || typeof error !== 'object') {
    return { message: 'Erro interno do servidor' };
  }

  const err = error as Record<string, unknown>;
  const sanitized: SanitizedError = {
    message: 'Erro interno do servidor',
  };

  // Extrair mensagem segura
  if (err.message && typeof err.message === 'string') {
    // Remover possíveis tokens/secrets da mensagem
    sanitized.message = err.message
      .replace(/Bearer\s+[\w-]+/gi, '[REDACTED_TOKEN]')
      .replace(/Authorization:\s*[\w\s-]+/gi, '[REDACTED_AUTH]')
      .replace(/api[_-]?key[\s:=]+[\w-]+/gi, '[REDACTED_API_KEY]')
      .replace(/token[\s:=]+[\w-]+/gi, '[REDACTED_TOKEN]');
  }

  // Em produção, nunca incluir detalhes adicionais
  if (includeDetails && process.env.NODE_ENV !== 'production') {
    if (err.code && typeof err.code === 'string') {
      sanitized.code = err.code;
    }
    if (err.statusCode && typeof err.statusCode === 'number') {
      sanitized.statusCode = err.statusCode;
    }
    if (err.type && typeof err.type === 'string') {
      sanitized.type = err.type;
    }
  }

  return sanitized;
}

/**
 * Sanita erro da OpenAI removendo detalhes sensíveis
 * 
 * @param error - Erro da OpenAI SDK
 * @returns Erro sanitizado seguro
 */
export function sanitizeOpenAIError(error: unknown): SanitizedError {
  const err = error as Record<string, unknown>;
  const response = err?.response as Record<string, unknown> | undefined;
  
  // Detectar erros comuns da OpenAI
  const statusCode = (err?.status || err?.statusCode || response?.status) as number | undefined;
  const errorType = err?.type || err?.code || '';
  const errorMessage = err?.message || '';

  // Mensagens amigáveis baseadas no tipo de erro
  if (statusCode === 429) {
    return {
      message: 'Limite de uso da IA atingido. Tente novamente mais tarde.',
      statusCode: 429,
      type: 'rate_limit',
    };
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      message: 'Erro de autenticação com o serviço de IA.',
      statusCode: statusCode as number,
      type: 'auth_error',
    };
  }

  if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
    return {
      message: 'Serviço de IA temporariamente indisponível. Tente novamente em alguns instantes.',
      statusCode: statusCode as number,
      type: 'service_unavailable',
    };
  }

  // Para outros erros, usar sanitização padrão
  return sanitizeError(error);
}

/**
 * Cria mensagem de erro segura para retornar ao cliente
 * Nunca inclui stack trace ou detalhes internos
 */
export function createSafeErrorMessage(error: unknown): string {
  const sanitized = sanitizeError(error, false);
  return sanitized.message;
}

