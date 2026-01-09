# ML DATA AUDIT — Mercado Livre (PRIORIDADE ZERO)

## 🎯 Objetivo
Garantir que métricas e sinais do Mercado Livre (ex.: performance, mídia, visitas, clips/vídeo) sejam coletados, armazenados e exibidos com confiabilidade, sem contradições.

---

## ✅ Status atual — Observações de campo (2026-01-09)

### 1) Sinais de Mídia no DB
Tabela: `listings`

Colunas identificadas:
- `has_video` (boolean)
- `has_clips` (boolean)
- `pictures_count` (integer)
- `clips_source` (text)
- `clips_checked_at` (timestamp)

Caso testado:
- marketplace: mercadolivre
- listing_id_ext: "MLB3923303743"
- pictures_count: 20
- has_clips: NULL
- has_video: exibido como “vazio” no client SQL (provável NULL)

**Risco atual:**
- Se `has_video` estiver NULL e algum mapper converter para false, o produto passa a afirmar “não tem vídeo” incorretamente.

### 2) Sinais de Performance
- Dimension “Performance” aparece como indisponível via API (dataQuality).
- Ainda precisamos consolidar exatamente quais endpoints estão sendo usados e quais campos retornam, para não inferir dados ausentes.

### 3) Snapshot / Payload bruto
- Não existe tabela `listing_snapshots` no schema atual.
- Tabelas relevantes existentes: `listing_action_outcomes`, `listing_ai_analysis`, `listing_metrics_daily`, `ai_model_metrics`, `job_logs`, etc.

**Risco atual:**
- Sem snapshot/payload bruto, não dá para auditar se a API do ML retornou “vídeo/clips” e o pipeline perdeu no caminho.

---

## ✅ Matriz de Confiabilidade (atual)

| Sinal | Origem | Armazenamento | Status | Observação |
|------|--------|---------------|--------|-----------|
| pictures_count | sync ML | listings.pictures_count | ✅ Confiável | Valor alto e consistente (ex.: 20) |
| has_video | sync ML | listings.has_video | ⚠️ Inconclusivo | Pode estar NULL e virar false por bug de mapper |
| has_clips | sync ML | listings.has_clips | ⚠️ Inconclusivo | NULL no caso testado |
| performance (visits etc.) | API ML | (não consolidado) | ❌ Indisponível/Parcial | UI mostra “dados indisponíveis via API” |

---

## 🧪 Próximos testes obrigatórios (para fechar causa raiz)

### Teste A — Validar DB (postgre)
Para o listing MLB3923303743:
- Confirmar valores reais:
  - has_video ∈ {true,false,null}
  - has_clips ∈ {true,false,null}
  - pictures_count

### Teste B — Validar pipeline (logs do /ai/analyze)
Capturar logs com:
- mediaInfo.hasVideo
- mediaInfo.hasClips
- mediaInfo.picturesCount
- mediaVerdict final

### Decisão baseada em evidência
- Se DB NULL e log mostra false → bug de conversão (NULL → false) no mapper
- Se DB false → falha de sync/detecção (ou API não expõe)
- Se API não expõe → ajustar linguagem e considerar armazenar payload bruto mínimo

---

## ✅ Melhorias recomendadas (não executar agora sem decisão)

### 1) Persistir payload bruto mínimo (debug/audit)
Opção A: criar tabela `listing_raw_payloads` (retenção 7 dias)
Opção B: adicionar coluna `raw_payload` (JSONB) em `listing_ai_analysis`

Objetivo: auditar sinais como clips/vídeo e evitar inferências.

### 2) Normalização de listing_id_ext
- Hoje: "MLB3923303743"
- Normalizar para extrair NUM:
  - 3923303743
Para construir URLs editáveis e padronizar integrações.

---

## 📌 DoD do ML Data Audit (para esta etapa)
- Conseguimos afirmar com certeza se has_video/has_clips são confiáveis ou não.
- O sistema nunca converte NULL em ausência.
- Os textos exibidos respeitam a confiabilidade do dado.
