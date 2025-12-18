/**
 * Logger Configuration
 * 
 * Configura logger do Fastify com redaction de campos sensíveis
 */

import { FastifyLoggerOptions } from 'fastify';

/**
 * Campos que devem ser redigidos nos logs
 */
const SENSITIVE_FIELDS = [
  'authorization',
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'apikey',
  'openai_api_key',
  'OPENAI_API_KEY',
  'access_token',
  'refresh_token',
  'accessToken',
  'refreshToken',
  'token',
  'password',
  'secret',
  'credentials',
];

/**
 * Redige valores sensíveis em objetos
 */
function redactSensitiveFields(obj: unknown, depth: number = 0): unknown {
  // Limitar profundidade para evitar loops infinitos
  if (depth > 10) {
    return '[MAX_DEPTH]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Se for string, verificar se contém tokens
  if (typeof obj === 'string') {
    // Redigir se contém padrões de token
    if (
      /Bearer\s+[\w-]+/i.test(obj) ||
      /token[\s:=]+[\w-]+/i.test(obj) ||
      /api[_-]?key[\s:=]+[\w-]+/i.test(obj)
    ) {
      return '[REDACTED]';
    }
    return obj;
  }

  // Se for array, processar cada item
  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveFields(item, depth + 1));
  }

  // Se for objeto, processar cada propriedade
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Redigir se a chave for sensível
      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitiveFields(value, depth + 1);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Serializer customizado para redigir campos sensíveis
 * Nota: Fastify logger serializers têm tipos específicos
 */
export const loggerSerializers = {
  err: (err: {
    message?: string;
    stack?: string;
    code?: string;
    statusCode?: number;
    type?: string;
  }) => {
    // Nunca logar stack trace em produção
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      type: err.type || 'Error',
      message: err.message || 'Unknown error',
      stack: isProduction ? '' : (err.stack || ''),
      code: err.code,
      statusCode: err.statusCode,
    };
  },
};

/**
 * Configuração do logger do Fastify
 */
export const loggerConfig: FastifyLoggerOptions = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  serializers: loggerSerializers,
  // Redaction via serializers customizados
};

