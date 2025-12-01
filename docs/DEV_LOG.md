# Developer Log - SuperSeller IA

## [2025-12-01] Transição de Partner e Diagnóstico Inicial
**Partner:** Gemini
**Foco:** Estabilização do MVP e Onboarding.

### Diagnóstico
- Recebido report executivo indicando 70% de conclusão do MVP.
- Identificado bloqueio total nos testes de integração devido a falhas na camada de dados (Prisma/DB Connection).
- O Frontend (Web) está saudável (`/health` OK), mas a API apresenta instabilidade (`/health` 404 e `/register` 500).

### Ações Planejadas
1.  **Correção de Infra:** Ajustar `DATABASE_URL` na AWS para formato `postgresql://user:pass@host:port/db`.
2.  **Correção de Roteamento:** Investigar por que o Fastify não está expondo `/api/v1/health` corretamente (provável problema no `register` do plugin de rotas).
3.  **Expansão de Escopo:** Definido que o projeto incluirá Engenharia Reversa de Algoritmos de Marketplace e Gestão de Ads.

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


## [2025-12-01] Migração para App Runner e Estabilização de Infra
**Status:** Concluído com Sucesso

### Ações Realizadas
1.  **Banco de Dados:**
    - Identificado que o banco lógico `superseller` não existia.
    - Banco criado manualmente e validado via DBeaver.
2.  **Infraestrutura (Pivot):**
    - Terraform refatorado para remover ECS Fargate e ALB.
    - Implementado **AWS App Runner** para API e WEB (Redução de custo e complexidade).
    - Criado **VPC Connector** para permitir acesso do App Runner ao RDS Privado.
3.  **CI/CD:**
    - Pipelines do GitHub Actions atualizados para deploy no App Runner.
    - Permissões de IAM (Roles) limpas e ajustadas.
4.  **Resultados:**
    - Deploy automatizado funcionando (Green Build).
    - API Health Check respondendo 200 OK.
    - Domínios personalizados configurados e em propagação.

## [2025-12-01] Refatoração de Infra e Diagnóstico de DB
**Partner:** Gemini | **Status:** Em Andamento

## [2025-12-01] Resolução de Conectividade App Runner <-> RDS
**Status:** Resolvido

### Problema
Erro `P1001: Can't reach database server` e `Timed out fetching connection` ao tentar registrar usuário, mesmo com a senha correta.

### Causa Raiz
Bloqueio de **Security Group**. O RDS estava aceitando conexões apenas do Bastion Host e de si mesmo, mas bloqueava o tráfego vindo do novo serviço App Runner.

### Solução Aplicada
1.  Identificado o ID do Security Group do App Runner.
2.  Adicionada regra de entrada (Inbound Rule) no Security Group do RDS permitindo tráfego TCP/5432 vindo do SG do App Runner.
3.  Conexão estabelecida com sucesso. Registro de usuário validado em produção.
