Contexto do Projeto: SuperSeller IA

Status: Fase 2 - Estabilização de Integrações
Última Atualização: 02/12/2025 (Fim do dia)

1. Visão Geral

SaaS Multi-tenant para otimização de e-commerce.
Foco Imediato: Debuggar o erro 404 Not Found na rota de conexão do Mercado Livre.

2. Status Técnico

Infraestrutura: ✅ AWS App Runner + RDS (Estável).

Banco de Dados: ✅ Conectado e Migrado. Schema validado (snake_case).

Autenticação: ✅ Registro e Login funcionais.

Integração ML: ⚠️ Backend compilando e corrigido (PR #57), mas Frontend ainda recebe 404 ao chamar a rota.

3. Problemas Conhecidos (Bloqueante Atual)

Rota de Conexão ML (404):

O Frontend chama: /api/v1/auth/mercadolivre/connect.

O Backend (teoricamente) expõe: /api/v1/auth/mercadolivre/connect.

Sintoma: O navegador recebe 404 Not Found.

Hipóteses para amanhã: Cache do navegador/CDN, Cache de Build do Docker (imagem antiga), ou erro na montagem do prefixo no Fastify.

4. Próximos Passos (Plano de Ação)

Verificar se a versão nova do código realmente subiu no App Runner (via Logs).

Testar a rota via curl direto no terminal para isolar se é erro de Frontend ou Backend.

Validar variável NEXT_PUBLIC_API_URL no build do Frontend.