# ROADMAP — SuperSeller IA
Atualizado em: 2026-03-10

Este é o roadmap **ativo** do projeto (referência para as próximas sessões).

---

## Estado atual

- **Dia 10 — UX Premium:** ✅ CONCLUÍDO (produto parecer profissional em 2 minutos)
- **Próxima sessão:** **Dia 11 — Data Layer + Jobs Automáticos**

---

## DIA 10 — UX Premium ✅ CONCLUÍDO

**Objetivo:** Produto parecer profissional em 2 minutos.

**Status:** CONCLUÍDO.

---

## DIA 11 — Data Layer + Jobs Automáticos

**Objetivo:** Persistir o máximo possível de dados da API do Mercado Livre; esses dados alimentarão futuras análises da IA.

**Implementar:**

- Sync automático de visitas
- Sync automático de pedidos
- Sync automático de promoções
- Sync automático de preço

---

## DIA 12 — IA Visual (MVP)

**Objetivo:** Análise da imagem principal do anúncio.

**Avaliar:**

- Clareza
- Contraste
- Presença do produto
- Poluição visual
- Diferenciação em relação a concorrentes

**Output:** score visual + sugestões de melhoria. **Sem geração de imagens** neste momento.

---

## DIA 13 — Ads Intelligence

**Objetivo:** Analisar campanhas de anúncios patrocinados.

**Métricas:** CTR, CPC, ROAS, conversão.

**Output:** recomendações simples.

---

## DIA 14 — Refinamento da IA

**Objetivo:** Com novos dados disponíveis (Data Layer, IA Visual, Ads), melhorar:

- Diagnóstico
- Consultoria
- Priorização de ações

---

## DIA 15 — Onboarding inteligente

**Fluxo ideal:**

```
login → conectar Mercado Livre → escolher anúncio → primeira vitória
```

---

## DIA 16 — Landing comercial

**Objetivo:** Página pública do produto com:

- Proposta de valor
- Planos
- Lista de espera

---

## DIA 17–19 — Execução real via API

**Objetivo:** Permitir que o sistema aplique mudanças diretamente no anúncio:

- Alterar título
- Alterar descrição
- Alterar preço

**Requisitos:** confirmação, log de alterações, rollback.
