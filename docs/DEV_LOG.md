# Developer Log - SuperSeller IA

## [2025-12-01] Refatoração de Infra e Diagnóstico de DB
**Partner:** Gemini | **Status:** Em Andamento

### Ocorrências e Decisões
1.  **Diagnóstico do Erro 500 (Auth):**
    - Identificado que a instância RDS `superseller-prod-db` está operacional, mas o banco de dados lógico não foi criado ("DB Name: -").
    - **Solução:** Criar database manualmente e corrigir Connection String.

2.  **Pivot de Infraestrutura (Custo/Complexidade):**
    - **Problema:** Arquitetura atual (ECS Fargate + ALB) tem custo fixo elevado (~$80/mês) e complexidade desnecessária para o estágio atual.
    - **Decisão:** Migrar computação para **AWS App Runner**.
    - **Benefício:** Redução drástica de custo (escala a zero), SSL nativo, deploy simplificado.

3.  **Expansão de Arquitetura (Novos Requisitos):**
    - **Filas:** Adoção oficial do **AWS SQS** para lidar com latência de IA e Rate Limits do Mercado Livre.
    - **Módulo de IA:** Reforçado requisito de ser agnóstico ao modelo (Interface `GenAIProvider`).
    - **Segurança:** Tokens de acesso (ML/Shopee) serão criptografados no banco.

4.  **Ferramentas:**
    - Adoção do **Cursor (IDE)** para desenvolvimento assistido, substituindo uso genérico de LLMs externos para código.
