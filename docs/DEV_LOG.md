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

[2025-12-02] Ajustes de Roteamento e Tipagem ML

Partner: Gemini | Status: Em Debug

Ocorrências

Erro de URL ML ("Resource not found"):

Diagnóstico: A API estava gerando links de login apontando para api.mercadolibre.com (incorreto) em vez de auth.mercadolivre.com.br.

Correção: Código ajustado para usar a URL de Auth correta.

Erro de Prefixo de Rota (404):

Diagnóstico: Frontend chamava /auth/mercadolivre/connect, mas Backend expunha /mercadolivre/connect.

Correção: Ajustado server.ts para incluir prefixo /auth.

Erro de Build TypeScript (Atual):

Problema: Falha no pnpm build ao tentar salvar a conexão no banco.

Erro: Object literal may only specify known properties, and 'tenantId' does not exist.

Causa Raiz: Divergência de nomenclatura. O Schema do Prisma define colunas em snake_case (tenant_id, access_token), mas o código TypeScript estava passando camelCase.

Ação Necessária: Refatorar a chamada do Prisma para usar os nomes exatos do banco.

Infraestrutura

Confirmado funcionamento do AWS App Runner com variáveis de ambiente carregadas via env.ts (criado hoje).



[2025-12-02] Infraestrutura, Banco e Tipagem

Partner: Gemini & Devin | Status: Pausado em Debug

Conquistas do Dia

Infraestrutura: Pivot completo de ECS para AWS App Runner. Redução de complexidade e custo.

Banco de Dados: Conexão RDS estabelecida, migrations aplicadas, erro 500 de Auth resolvido.

Refatoração Backend: Ajuste massivo de tipagem no arquivo mercadolivre.ts para respeitar o padrão snake_case do banco e Enums do Prisma.

Correção de URL: Backend ajustado para usar auth.mercadolivre.com.br (Auth) vs api.mercadolibre.com (Dados).

Ocorrência Final (Debug)

Cenário: Após merge do PR #57 (que corrigiu a rota do Frontend para /connect e renomeou a rota do Backend), o erro 404 Not Found persiste ao clicar no botão.

Suspeita: O App Runner pode não ter atualizado a imagem corretamente ou existe um desencontro silencioso nos prefixos de rota do Fastify (server.ts).

Ação: Debug pausado para retomada no dia seguinte com verificação de logs em tempo real.



[2025-12-04] Resolução Crítica do Roteamento (404) e Novo Bloco (400 ML)

Status: 404 Resolvido / 400 Novo Bloqueio

Conquistas do Dia

CI/CD: Pipeline corrigido (erros de YAML e pnpm resolvidos pelo Devin/Cursor).

Roteamento Fastify (404): Corrigida a sintaxe dos prefixos de rota no server.ts (adicionando a barra /), eliminando o erro 404 Not Found. A rota /connect está acessível.

Progresso: O fluxo de conexão atinge a página de autorização do Mercado Livre.

Ocorrência Atual (400 Bad Request)

Cenário: O Mercado Livre rejeita a requisição de login.

Causa Raiz: O ML devolve 400 Bad Request por erro de validação de parâmetro (provavelmente redirect_uri ou client_id).

Ação: O próximo passo é rodar o teste manual da URL para obter a mensagem de erro exata do ML.

[2025-12-05] Resolução de Conectividade Externa (Erro 502)

Partner: Gemini & Cursor | Status: Em Implementação

Ocorrência (Erro 502 Bad Gateway)

Sintoma: Ao retornar do login no Mercado Livre, a aplicação ficava "pensando" e retornava erro 502 na rota de callback.

Diagnóstico: Logs do App Runner não mostravam crash, mas sim timeouts e reinicializações. Identificado que o App Runner, por estar conectado à VPC Privada (para acessar o RDS), perdeu o acesso à internet pública.

Causa Raiz: Ausência de NAT Gateway na infraestrutura. O App Runner não conseguia chamar api.mercadolibre.com para trocar o code pelo token.

Solução Arquitetural

Implementação de NAT Gateway via Terraform.

Configuração de rota: Subnets Privadas -> NAT Gateway -> Internet Gateway.

Isso permite que o App Runner acesse simultaneamente o banco de dados (interno) e APIs de terceiros (externo).

Economia de Custos: Implementada variável enable_nat_gateway no Terraform para desligar o recurso em ambientes de desenvolvimento quando não utilizado.

Próximos Passos

Executar terraform apply para provisionar a nova rede.

Validar fluxo de OAuth completo.

[2025-12-05] Resolução de Conectividade Externa (Erro 502)

Partner: Gemini & Cursor | Status: Em Implementação

Ocorrência (Erro 502 Bad Gateway)

Sintoma: Ao retornar do login no Mercado Livre, a aplicação ficava "pensando" e retornava erro 502 na rota de callback.

Diagnóstico: Logs do App Runner não mostravam crash, mas sim timeouts e reinicializações frequentes. Identificado que o App Runner, por estar conectado à VPC Privada (para acessar o RDS), perdeu o acesso à internet pública (necessário para chamar a API do Mercado Livre).

Causa Raiz: Ausência de NAT Gateway na infraestrutura. O App Runner não conseguia chamar api.mercadolibre.com para trocar o code pelo token.

Solução Arquitetural

Implementação de NAT Gateway: Adicionado via Terraform para rotear tráfego de saída das subnets privadas para a internet.

Configuração de Rota: Subnets Privadas -> NAT Gateway -> Internet Gateway.

Economia de Custos: Criada variável enable_nat_gateway no Terraform. Isso permite desligar o recurso caro (~$32/mês) em ambientes de desenvolvimento quando não estiver em uso ativo.

Próximos Passos

Executar terraform apply para provisionar a nova rede.

Validar fluxo de OAuth completo (troca de token e redirecionamento).