# PR: ML Data Audit - Limpeza e Contrato de Dados

## 📋 Motivo

Este PR implementa correções seguras identificadas no ML Data Audit para garantir integridade dos dados e remover estimativas não confiáveis.

## 🎯 Objetivos

1. **Remover estimativas de impressions/clicks/ctr**: Eliminar lógica que estima esses valores (ex: `visits * 10`), substituindo por `null` quando não houver fonte real
2. **Preservar null para visits**: Garantir que `visits` permaneça `null` quando indisponível, sem conversões silenciosas para `0`
3. **Unificar credenciais do ML**: Padronizar todos os services para usar o mesmo método de obtenção de credenciais

## 📝 Arquivos Alterados

### Backend

1. **`apps/api/src/services/MercadoLivreSyncService.ts`**
   - Removida estimativa `impressions = visits * 10` (linha 1074)
   - Removida estimativa `clicks = visits` (linha 1075)
   - Removida estimativa `ctr = clicks / impressions` (linha 1076)
   - Agora `impressions`, `clicks` e `ctr` são `null` quando não há fonte real
   - Ajustado `visits_last_7d` para preservar `null` quando todos os valores são `null` (linha 1155)
   - Removido `|| 0` em `visits_last_7d` (linha 654)
   - Ajustado fallback de `visits` para `null` em vez de `0` na criação de listings (linha 734)

2. **`apps/api/src/services/MercadoLivreOrdersService.ts`**
   - Unificado para usar `getMercadoLivreCredentials()` em vez de `process.env.ML_CLIENT_ID/SECRET` (linha 314)
   - Agora usa o mesmo método de credenciais que `MercadoLivreSyncService`

3. **`apps/api/prisma/schema.prisma`**
   - `impressions`: `Int` → `Int?` (nullable)
   - `clicks`: `Int` → `Int?` (nullable)
   - `ctr`: `Decimal` → `Decimal?` (nullable)
   - Permite que esses campos sejam `null` quando não há fonte real

### Frontend

*Nota: Frontend será ajustado em PR separado se necessário após validação dos dados*

## 🔍 Mudanças Detalhadas

### 1. Remoção de Estimativas

**Antes:**
```typescript
const impressions = visits_30d !== null && visits_30d > 0 ? visits_30d * 10 : 0;
const clicks = visits_30d !== null ? visits_30d : 0;
const ctr = impressions > 0 ? clicks / impressions : 0;
```

**Depois:**
```typescript
// Impressions/clicks/ctr: null quando não houver fonte real (sem estimativas)
const impressions = null;
const clicks = null;
const ctr = null;
```

### 2. Preservação de null para visits

**Antes:**
```typescript
visits_last_7d: item.visits || 0,
const visitsLast7d = last7DaysMetrics.reduce((sum, m) => sum + (m.visits ?? 0), 0);
```

**Depois:**
```typescript
visits_last_7d: item.visits ?? null,
const visitsValues = last7DaysMetrics.map(m => m.visits).filter((v): v is number => v !== null);
const visitsLast7d = visitsValues.length > 0 ? visitsValues.reduce((sum, v) => sum + v, 0) : null;
```

### 3. Unificação de Credenciais

**Antes (MercadoLivreOrdersService):**
```typescript
client_id: process.env.ML_CLIENT_ID,
client_secret: process.env.ML_CLIENT_SECRET,
```

**Depois:**
```typescript
const credentials = await import('../lib/secrets').then(m => m.getMercadoLivreCredentials());
client_id: credentials.clientId,
client_secret: credentials.clientSecret,
```

## ✅ Checklist de Testes

### Testes de Sync

- [ ] Executar sync de listings e verificar que `impressions`, `clicks`, `ctr` são `null` no banco
- [ ] Verificar que `visits` permanece `null` quando não disponível na API do ML
- [ ] Validar que `visits_last_7d` é `null` quando todas as métricas diárias têm `visits = null`
- [ ] Confirmar que `visits_last_7d` é calculado corretamente quando há valores não-null

### Testes de Credenciais

- [ ] Verificar que `MercadoLivreOrdersService` consegue renovar token usando `getMercadoLivreCredentials()`
- [ ] Confirmar que ambos os services (`Sync` e `Orders`) usam o mesmo método de credenciais
- [ ] Testar em ambiente de desenvolvimento (env vars) e produção (secrets manager)

### Testes de UI

- [ ] Verificar que métricas com `visits = null` são exibidas corretamente (não como "0")
- [ ] Confirmar que `impressions`, `clicks`, `ctr` não aparecem quando são `null`
- [ ] Validar que cálculos de conversão não quebram quando `visits = null`
- [ ] Testar exibição de mensagens apropriadas quando dados não estão disponíveis

### Testes de Migração

- [ ] Executar migração do Prisma para tornar `impressions`, `clicks`, `ctr` nullable
- [ ] Verificar que dados existentes não são afetados (valores 0 permanecem 0)
- [ ] Confirmar que novos registros podem ter `null` nesses campos

## 🚨 Observações Importantes

1. **Não implementa Visits API**: Este PR apenas remove estimativas e corrige contrato de dados. A integração com Visits API será feita em PR separado.

2. **Migração do Banco**: É necessário executar migração do Prisma para tornar `impressions`, `clicks`, `ctr` nullable:
   ```bash
   npx prisma migrate dev --name make_impressions_clicks_ctr_nullable
   ```

3. **Compatibilidade com Frontend**: O frontend pode precisar de ajustes para lidar com `null` em vez de `0` para visits. Isso será validado após deploy deste PR.

4. **Dados Existentes**: Dados existentes com `impressions = 0`, `clicks = 0`, `ctr = 0` permanecerão como estão. Apenas novos registros terão `null` quando não houver fonte real.

## 📊 Impacto Esperado

- **Dados mais confiáveis**: Remoção de estimativas não confiáveis melhora qualidade dos dados
- **Contrato claro**: `null` indica claramente quando dados não estão disponíveis vs. `0` que indica valor real zero
- **Preparação para Visits API**: Estrutura pronta para quando Visits API for integrada

## 🔗 Referências

- `docs/ML_DATA_AUDIT.md` - Auditoria completa que identificou essas questões
- `docs/PROJECT_CONTEXT.md` - Contexto do projeto e gaps conhecidos

