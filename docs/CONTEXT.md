Contexto do Projeto: SuperSeller IA

Status: Fase 2 - Estabilização de Integrações
Última Atualização: 05/12/2025

1. Visão Geral

SaaS Multi-tenant para otimização de e-commerce.
Foco Atual: Resolver erro 502 Bad Gateway no callback do Mercado Livre.

2. Status Técnico

Infraestrutura:

✅ AWS App Runner (API + Web).

✅ RDS PostgreSQL (Privado).

✅ NAT Gateway: Implementado para permitir que o App Runner acesse APIs externas (Mercado Livre) a partir da VPC.

Banco de Dados: ✅ Conectado e Migrado.

Autenticação: ✅ Registro, Login e OAuth ML (Login) funcionais.

Integração ML: ⚠️ Callback retorna 502. Diagnóstico aponta para falta de conectividade de saída (resolvido com NAT Gateway).

3. Arquitetura de Rede (Novo)

O App Runner utiliza um VPC Connector para acessar o RDS nas subnets privadas.
Para acessar a internet (ex: api.mercadolibre.com), o tráfego é roteado através de um NAT Gateway localizado nas subnets públicas.

4. Próximos Passos

Aplicar o Terraform para criar o NAT Gateway.

Testar novamente o fluxo de conexão com o Mercado Livre.

Validar se o token é salvo no banco e o redirecionamento ocorre com sucesso.