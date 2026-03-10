# NEXT SESSION PLAN — SuperSeller IA
Atualizado em: 2026-03-09

## Próxima sessão (Dia 10) — UX Premium: validação final do painel

**Objetivo:** validar estabilidade e experiência final do painel de análise (antes de seguir para Dia 11).

---

## Checklist (PASS/FAIL)

### Validar clip detection (determinístico)
- [ ] Re-analisar o mesmo anúncio 3x e confirmar que a detecção de clip não oscila (com mesmo payload do ML)
- [ ] Confirmar que o backend usa múltiplas fontes do payload do ML (batch + fallback quando aplicável)

### Validar modal de Action Details
- [ ] Abrir “Detalhes” em 3 ações diferentes
- [ ] Confirmar que o modal usa `analysis.status` (não quebra em estados de geração/erro)
- [ ] Confirmar loading/skeleton coerente e ausência de erro no console

### Validar idioma da interface
- [ ] Confirmar que os termos principais estão em PT-BR (sem termos em inglês no painel)
- [ ] Conferir consistência: “clip”, “gargalo”, “impacto estimado”, “plano de execução”

### Validar roadmap e impacto estimado (UX + lógica)
- [ ] Roadmap em 3 passos: ordenado por gargalo + impacto + esforço
- [ ] Badge visual de gargalo aparece e faz sentido (SEARCH/CLICK/CONVERSION)
- [ ] “Impacto estimado” aparece em todos os cards de ação e é legível/escaneável
- [ ] Quando a ação resolve o gargalo principal, o multiplicador de impacto está refletido no impacto estimado

---

## Critério de aprovação

**Se tudo passar:** seguir para **Dia 11 — Jobs automáticos** (ver `docs/ROADMAP.md`).  
**Se falhar:** registrar no `docs/DAILY_EXECUTION_LOG.md` o que quebrou + evidência (print, payload, passo a passo) e corrigir P0 antes de avançar.

