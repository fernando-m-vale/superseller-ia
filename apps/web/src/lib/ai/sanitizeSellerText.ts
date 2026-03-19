/**
 * Sanitiza textos vindos do backend para exibir linguagem “seller-friendly”.
 * Objetivo: remover/neutralizar labels internas como fallback/snapshot/integration/debug.
 */

export function sanitizeSellerText(input: string | null | undefined): string {
  if (!input) return ''

  let text = String(input)

  // Remove trechos em código (se vierem acidentalmente).
  text = text.replace(/```[\s\S]*?```/g, '')

  // Remove tokens que costumam identificar conteúdo interno/op (hotfix/debug/prompt).
  const internalLineMatchers: RegExp[] = [
    /\b(hotfix|p0|p1|p2|debug|admin|operacional|internal)\b/i,
    /\bsnapshot\b/i,
    /\b(janela\s+m[oó]vel|m[oó]vel\s+window)\b/i,
    /\bfallback\b/i,
    /\b(cache(_|\s)?(hit|miss)|cache[_-]?(hit|miss))\b/i,
    /\b(integration|integra[cç][aã]o)\b/i,
    /\b(model|prompt|prompt_version)\b/i,
    /\bconsole\.(log|warn|error)\b/i,
    // Labels internas que já apareceram em CTA e afins
    /\banalysisV21\./i,
    /\bgeneratedContent\./i,
  ]

  // Remove linhas inteiras “suspeitas”.
  const lines = text
    .split(/\r?\n/)
    .filter((line) => !internalLineMatchers.some((rx) => rx.test(line)))

  text = lines.join('\n')

  // Limpeza inline de labels internas.
  text = text
    .replace(/\banalysisV21\.[a-zA-Z0-9_.-]+\b/gi, '')
    .replace(/\bgeneratedContent\.[a-zA-Z0-9_.-]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return text
}

/**
 * CTA vindo de card pode carregar “Versão principal: analysisV21... (fallback...)”.
 * Convertemos isso em uma microcopy prática e neutra.
 */
export function sanitizePracticalCta(text: string | null | undefined): string | null {
  if (!text) return null

  const raw = String(text).trim()
  if (!raw) return null

  // Se o CTA contém rótulos internos, devolvemos um texto genérico.
  const looksTechnical =
    /vers[aã]o\s+principal:/i.test(raw) ||
    /fallback/i.test(raw) ||
    /analysisV21\./i.test(raw) ||
    /generatedContent\./i.test(raw)

  if (looksTechnical) {
    return 'Aplicação prática: copie a versão sugerida e ajuste para seu produto (diferenciais, medidas e garantia).'
  }

  const cleaned = sanitizeSellerText(raw)
  return cleaned || null
}

export function isMeaningfulJsonObject(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return Object.keys(obj).some((k) => {
    const v = obj[k]
    if (v === null || v === undefined) return false
    if (typeof v === 'string' && v.trim() === '') return false
    if (Array.isArray(v) && v.length === 0) return false
    return true
  })
}

