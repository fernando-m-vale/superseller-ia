/**
 * Utilitário para parsing robusto de variáveis de ambiente
 * 
 * Suporta valores plaintext e JSON (quando secret foi criado como key/value no AWS Secrets Manager)
 */

/**
 * Obtém um valor booleano de uma variável de ambiente de forma robusta
 * 
 * Suporta:
 * - Plaintext: "true" ou "false"
 * - JSON string: {"VAR_NAME":"true"} ou {"VAR_NAME":"false"}
 * 
 * @param name Nome da variável de ambiente
 * @param defaultValue Valor padrão se não encontrado (default: false)
 * @returns Valor booleano parseado
 */
export function getBooleanEnv(name: string, defaultValue: boolean = false): boolean {
  const rawValue = process.env[name];
  
  // Se não existe, retornar default
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  // Se começa com "{", tentar parsear como JSON
  if (rawValue.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawValue);
      const jsonValue = parsed[name];
      
      // Se encontrou a chave no JSON, parsear o valor
      if (jsonValue !== undefined && jsonValue !== null) {
        const stringValue = String(jsonValue).toLowerCase().trim();
        return stringValue === 'true';
      }
    } catch (error) {
      // Se falhar ao parsear JSON, continuar com parse direto
      console.warn(`[ENV-PARSER] Falha ao parsear ${name} como JSON, tentando parse direto:`, error instanceof Error ? error.message : 'Erro desconhecido');
    }
  }

  // Parse direto: "true" ou "false"
  const stringValue = rawValue.toLowerCase().trim();
  return stringValue === 'true';
}

/**
 * Obtém um valor string de uma variável de ambiente de forma robusta
 * 
 * Suporta:
 * - Plaintext: valor direto
 * - JSON string: {"VAR_NAME":"value"}
 * 
 * @param name Nome da variável de ambiente
 * @param defaultValue Valor padrão se não encontrado
 * @returns Valor string parseado
 */
export function getStringEnv(name: string, defaultValue: string = ''): string {
  const rawValue = process.env[name];
  
  // Se não existe, retornar default
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  // Se começa com "{", tentar parsear como JSON
  if (rawValue.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawValue);
      const jsonValue = parsed[name];
      
      // Se encontrou a chave no JSON, retornar o valor
      if (jsonValue !== undefined && jsonValue !== null) {
        return String(jsonValue);
      }
    } catch (error) {
      // Se falhar ao parsear JSON, continuar com valor direto
      console.warn(`[ENV-PARSER] Falha ao parsear ${name} como JSON, usando valor direto:`, error instanceof Error ? error.message : 'Erro desconhecido');
    }
  }

  // Retornar valor direto
  return rawValue;
}

/**
 * Obtém um valor numérico de uma variável de ambiente de forma robusta
 * 
 * Suporta:
 * - Plaintext: "123"
 * - JSON string: {"VAR_NAME":"123"}
 * 
 * @param name Nome da variável de ambiente
 * @param defaultValue Valor padrão se não encontrado ou inválido
 * @returns Valor numérico parseado
 */
export function getNumberEnv(name: string, defaultValue: number = 0): number {
  const rawValue = process.env[name];
  
  // Se não existe, retornar default
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  let stringValue: string;

  // Se começa com "{", tentar parsear como JSON
  if (rawValue.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawValue);
      const jsonValue = parsed[name];
      
      // Se encontrou a chave no JSON, usar o valor
      if (jsonValue !== undefined && jsonValue !== null) {
        stringValue = String(jsonValue);
      } else {
        return defaultValue;
      }
    } catch (error) {
      // Se falhar ao parsear JSON, continuar com valor direto
      console.warn(`[ENV-PARSER] Falha ao parsear ${name} como JSON, tentando parse direto:`, error instanceof Error ? error.message : 'Erro desconhecido');
      stringValue = rawValue;
    }
  } else {
    stringValue = rawValue;
  }

  // Parse numérico
  const parsed = parseFloat(stringValue);
  return isNaN(parsed) ? defaultValue : parsed;
}
