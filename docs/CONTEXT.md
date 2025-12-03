Contexto do Projeto: SuperSeller IA

Status: Fase 2 - Estabilização de Integrações
Última Atualização: 02/12/2025

1. Visão Geral

SaaS Multi-tenant para otimização de e-commerce.
Foco Atual: Concluir integração OAuth com Mercado Livre e corrigir erros de tipagem no Backend.

2. Status Técnico

Infraestrutura: ✅ AWS App Runner + RDS (Estável e Econômico).

Banco de Dados: ✅ Conectado. Schema utiliza snake_case para campos de relação (ex: tenant_id).

Autenticação: ✅ Registro e Login de usuários funcionando (Testes T04-T06 aprovados).

Frontend: ⚠️ Funcional, mas testes V2 indicaram falta de Menu de Navegação nas rotas internas.

3. Problemas Conhecidos (Bloqueantes)

Build da API (TypeScript/Prisma):

Erro de compilação na rota mercadolivre.ts.

Causa: O código está tentando usar camelCase (tenantId, accessToken), mas o Prisma Client foi gerado esperando snake_case (tenant_id, access_token) conforme o banco de dados.

Integração Mercado Livre:

URL de Auth corrigida para auth.mercadolivre.com.br.

Falta validar o fluxo ponta a ponta após correção do build.

Usabilidade (Frontend):

Falta menu de navegação para acessar páginas internas (/ai, /recommendations).

4. Próximos Passos Imediatos

Corrigir mercadolivre.ts para usar os nomes de campos corretos do Prisma (tenant_id, etc).

Validar conexão ML com sucesso.

Implementar Menu de Navegação no Frontend.