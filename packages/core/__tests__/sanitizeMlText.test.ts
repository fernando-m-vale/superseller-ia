import { describe, it, expect } from 'vitest';
import { sanitizeMlText } from '../src/sanitizeMlText';

describe('sanitizeMlText', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeMlText('')).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(sanitizeMlText(null as unknown as string)).toBe('');
    expect(sanitizeMlText(undefined as unknown as string)).toBe('');
  });

  it('removes common emojis', () => {
    const input = 'Promocao ativa 🔥🚀✅ aproveite!';
    const result = sanitizeMlText(input);
    expect(result).toBe('Promocao ativa aproveite!');
    expect(result).not.toContain('🔥');
    expect(result).not.toContain('🚀');
    expect(result).not.toContain('✅');
  });

  it('removes star and check emojis', () => {
    const input = '⭐ Destaques ✨ do produto';
    const result = sanitizeMlText(input);
    expect(result).not.toContain('⭐');
    expect(result).not.toContain('✨');
  });

  it('removes markdown bold and italic', () => {
    const input = 'Texto **negrito** e *italico* e __sublinhado__ e _outro_';
    const result = sanitizeMlText(input);
    expect(result).toBe('Texto negrito e italico e sublinhado e outro');
    expect(result).not.toContain('**');
    expect(result).not.toContain('*');
    expect(result).not.toContain('__');
    expect(result).not.toContain('_');
  });

  it('removes markdown headers', () => {
    const input = '# Titulo\n## Subtitulo\n### Outro';
    const result = sanitizeMlText(input);
    expect(result).not.toContain('#');
    expect(result).toContain('Titulo');
    expect(result).toContain('Subtitulo');
  });

  it('removes markdown links but keeps text', () => {
    const input = 'Veja [aqui](https://example.com) mais detalhes';
    const result = sanitizeMlText(input);
    expect(result).toBe('Veja aqui mais detalhes');
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
    expect(result).not.toContain('(');
    expect(result).not.toContain('https');
  });

  it('removes markdown images but keeps alt text', () => {
    const input = 'Imagem: ![foto do produto](https://img.com/foto.jpg)';
    const result = sanitizeMlText(input);
    expect(result).toBe('Imagem: foto do produto');
  });

  it('removes strikethrough markdown', () => {
    const input = 'Preco ~~antigo~~ novo';
    const result = sanitizeMlText(input);
    expect(result).toBe('Preco antigo novo');
  });

  it('removes inline code markdown', () => {
    const input = 'Use o codigo `PROMO10` para desconto';
    const result = sanitizeMlText(input);
    expect(result).toBe('Use o codigo PROMO10 para desconto');
  });

  it('removes code blocks', () => {
    const input = 'Antes\n```\ncodigo aqui\n```\nDepois';
    const result = sanitizeMlText(input);
    expect(result).toBe('Antes\n\nDepois');
    expect(result).not.toContain('```');
    expect(result).not.toContain('codigo aqui');
  });

  it('replaces decorative bullets with simple hyphen', () => {
    const input = '• Item 1\n► Item 2\n★ Item 3';
    const result = sanitizeMlText(input);
    expect(result).toContain('- Item 1');
    expect(result).toContain('- Item 2');
    expect(result).toContain('- Item 3');
    expect(result).not.toContain('•');
    expect(result).not.toContain('►');
    expect(result).not.toContain('★');
  });

  it('collapses multiple spaces', () => {
    const input = 'Texto   com    muitos     espacos';
    const result = sanitizeMlText(input);
    expect(result).toBe('Texto com muitos espacos');
  });

  it('collapses multiple newlines', () => {
    const input = 'Linha 1\n\n\n\n\nLinha 2';
    const result = sanitizeMlText(input);
    expect(result).toBe('Linha 1\n\nLinha 2');
  });

  it('trims whitespace', () => {
    const input = '   Texto com espacos   ';
    const result = sanitizeMlText(input);
    expect(result).toBe('Texto com espacos');
  });

  it('handles complex mixed input', () => {
    const input = `# ⭐ Destaques do Produto

**Promocao ativa** 🔥 de R$ 60,00 por R$ 32,00!

• Beneficio 1
• Beneficio 2
► Beneficio 3

Veja mais em [nosso site](https://example.com).

\`\`\`
codigo ignorado
\`\`\`

✅ Garantia de 1 ano`;

    const result = sanitizeMlText(input);
    
    expect(result).not.toContain('⭐');
    expect(result).not.toContain('🔥');
    expect(result).not.toContain('✅');
    expect(result).not.toContain('**');
    expect(result).not.toContain('#');
    expect(result).not.toContain('•');
    expect(result).not.toContain('►');
    expect(result).not.toContain('[');
    expect(result).not.toContain('```');
    
    expect(result).toContain('Destaques do Produto');
    expect(result).toContain('Promocao ativa');
    expect(result).toContain('R$ 60,00');
    expect(result).toContain('R$ 32,00');
    expect(result).toContain('- Beneficio 1');
    expect(result).toContain('nosso site');
    expect(result).toContain('Garantia de 1 ano');
  });

  it('preserves numbered lists', () => {
    const input = '1. Primeiro item\n2. Segundo item\n3. Terceiro item';
    const result = sanitizeMlText(input);
    expect(result).toBe('1. Primeiro item\n2. Segundo item\n3. Terceiro item');
  });

  it('preserves simple hyphens', () => {
    const input = '- Item A\n- Item B\n- Item C';
    const result = sanitizeMlText(input);
    expect(result).toBe('- Item A\n- Item B\n- Item C');
  });
});
