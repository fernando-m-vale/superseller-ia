# Fluxo Automático Pós-OAuth — SuperSeller IA

## Objetivo
Garantir que, após conectar o Mercado Livre, o usuário receba:
- Dados completos
- Sem ações manuais
- Com ingestão progressiva e resiliente

---

## 1) Evento Gatilho

Evento:
```
OAuth conectado com sucesso
```

Condição:
- marketplace_connections.status = CONNECTED
- token válido

---

## 2) Fluxo Inicial (Bootstrap)

### Passo A — FULL Sync (imediato)
```
POST /sync/mercadolivre/full
```

Responsabilidades:
- Ingestão de listings (Search → fallback Orders)
- Ingestão de orders
- Persistência mínima viável

---

### Passo B — Visits Backfill
```
POST /sync/mercadolivre/visits/backfill
```

- Últimos 30 dias
- Somente para listings existentes

---

## 3) Jobs Automáticos (cron)

### 3.1 Sync Incremental Diário
Frequência:
- A cada 6h (ou diário inicialmente)

Executa:
- Orders incremental
- Listings incremental
- Visits últimos 2–3 dias

---

### 3.2 Token Refresh
Frequência:
- A cada 1h

Executa:
- Refresh automático de tokens
- Atualiza expiresAt

---

## 4) Fluxo Visual (simplificado)

OAuth  
↓  
FULL Sync  
↓  
Fallback Orders (se necessário)  
↓  
Persistir Listings  
↓  
Backfill Visits  
↓  
Jobs Incrementais  
↓  
Dashboard + IA

---

## 5) Regras Importantes

- UI nunca bloqueia esperando jobs
- Dashboard exibe estado:
  - “Carregando dados”
  - “Parcial”
  - “Completo”
- Jobs são idempotentes
- Falhas não quebram o fluxo inteiro

---

## 6) Critérios de Aceite

- Usuário conecta ML → dados aparecem sem ação manual
- Listings existem mesmo com PolicyAgent ativo
- Visits aparecem progressivamente
- Sistema é resiliente a falhas parciais

---

## Status
✅ Arquitetura definida  
🕒 Implementação incremental
