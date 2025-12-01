# Contexto do Projeto: SuperSeller IA
**Status:** MVP Infraestrutura Estabilizada
**Última Atualização:** 01/12/2025

## 1. Visão Geral
SaaS Multi-tenant para otimização de e-commerce. Infraestrutura migrada para App Runner com sucesso.

## 2. Status Atual
- **Infraestrutura:** ✅ App Runner + RDS (Conectividade OK).
- **Banco de Dados:** ✅ Migrations aplicadas, conexão segura via VPC Connector.
- **Autenticação:** ✅ Registro e Login funcionais.
- **Domínios:** ⏳ Propagação de DNS para `app.superselleria.com.br`.

## 3. Problemas Conhecidos (Foco Atual)
1.  **Integração Mercado Livre:**
    - Botão "Conectar" na dashboard provavelmente falhará (Secrets e Callback URI pendentes).
    - Tokens não estão sendo renovados automaticamente.
2.  **Health Checks:** Validar se a rota `/health` está consistente no App Runner para evitar reciclagens desnecessárias.

## 4. Próximos Passos
- Configurar fluxo OAuth 2.0 do Mercado Livre (Callback URL).
- Implementar Job de Refresh Token.
