## Estado Atual do Projeto (Dezembro/2025)

O SuperSeller IA encontra-se em estágio funcional avançado, com o core de Inteligência Artificial operacional e integrado ao fluxo principal do produto.

### Status Geral
- Frontend e Backend em produção estáveis
- Integração com OpenAI (gpt-4o) funcionando
- Análises de IA geram score, diagnóstico, hacks de crescimento e sugestões de SEO
- Recomendações são persistidas no banco de dados
- UI renderiza corretamente sem crashes (React error #31 resolvido)

### Fluxo de IA (Atual)
1. Usuário acessa Anúncios
2. Abre modal de um anúncio
3. Aba "Inteligência Artificial"
4. Clica em "Gerar Análise Completa"
5. Backend executa análise com OpenAI
6. Retorno inclui:
   - Score (0–100)
   - Diagnóstico textual
   - Hacks de crescimento estruturados
   - Sugestões de SEO (título + descrição)
7. Frontend adapta e renderiza os dados corretamente
8. Usuário pode copiar sugestões diretamente

### Decisões Técnicas Importantes
- Uso de adapter no frontend para compatibilizar resposta da API com UI
- Backend retorna erros da OpenAI de forma semântica (429, 401, 5xx)
- Frontend nunca renderiza objetos diretamente (String(...) obrigatório)
- IA é tratada como serviço crítico do produto (core)

### Estado do Beta
- Produto pronto para Beta Fechado
- Falta apenas:
  - UX de sessão expirada (tratamento global de 401)
  - Refinar UX de ativação e limites
  - Preparar controle de custos e rate limit


## Estado atual — PRIORIDADE 0 (Higiene e segurança)

### Decisão: desativar página `/ai` (temporário)
- Motivo: `/ai` chamava rota inexistente no backend (`GET /api/v1/ai/recommendations?days=7`) e exibia “Route not found” mesmo autenticado.
- A IA que gera valor está no fluxo de anúncios: modal do anúncio → aba **Inteligência Artificial** → “Gerar Análise Completa”.

### Implementação desejada
- Frontend: `apps/web/src/app/ai/page.tsx`
  - Remover/evitar fetches para `/ai/recommendations` e `/ai/actions`.
  - Renderizar conteúdo estático com instrução: usar IA dentro dos anúncios.
- Navegação:
  - Remover link/menu para `/ai` ou marcar como “IA (em breve)” sem permitir UX quebrada.


### Atualização (2025-12-18) — Sessão expirada (401) padronizada + /ai desativado (informativo)

#### Sessão expirada (401) — resolvido (global)
- Implementado tratamento centralizado de 401 no frontend:
  - Para axios: interceptor chama `handleUnauthorized()` e força logout seguro (limpa tokens + redirect /login).
  - Para fetch: wrapper `apiFetch()` injeta Authorization e chama `handleUnauthorized()` em 401.
- UX no login:
  - Página `/login` exibe mensagem clara quando `auth:reason=session_expired`.

**Resultado:** toda chamada autenticada agora tem comportamento consistente ao expirar o token (sem crash, sem “tela branca”).

#### IA no produto — fluxo oficial consolidado
- A IA **permanece integrada no fluxo de Anúncios**:
  1) Anúncios → abrir modal do anúncio  
  2) Aba “Inteligência Artificial”  
  3) “Gerar Análise Completa” (score, diagnóstico, hacks e SEO)  
  4) Copiar sugestões (título/descrição)  
- A rota `/ai` foi **desativada como página “dinâmica”** e virou **página informativa** (instruções), para evitar dependência de endpoints inexistentes.

#### Estado atual do menu “Recomendações”
- Ainda existe no menu lateral.
- Página está instável (erro 500 no carregamento).
- Diretriz de curto prazo:
  - Ocultar/retirar “Recomendações” do menu **até estabilizar backend**, ou manter rota com placeholder “Em breve / Em manutenção” para não quebrar UX.

#### Commits relacionados (rastreabilidade)
- `3a29040` — global 401 session expired handling (axios + UX login)
- `10c10a4` — global 401 handling para fetch (apiFetch + migrações)
- `d6874e6` — desativação da página /ai (informativa)
