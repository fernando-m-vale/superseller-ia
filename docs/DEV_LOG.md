[2025-12-05] Integração Mercado Livre e Dashboard

Partner: Gemini & Cursor | Status: Sucesso

Conquistas Principais

Infraestrutura de Rede (NAT Gateway):

Resolvido erro 502 no callback do Mercado Livre implementando NAT Gateway para permitir saída de internet do App Runner.

Configurado Terraform para controle de custo (enable_nat_gateway).

Evolução do Banco de Dados:

Schema alterado para suportar Multi-contas (adição de provider_account_id e constraint composta).

Migration aplicada com sucesso em produção via túnel SSH.

Fluxo OAuth Completo:

Autenticação no Mercado Livre funcional.

Tokens persistidos corretamente no RDS.

Redirecionamento final ajustado para /overview?success=true.

Estabilização do Dashboard:

Resolvido erro 404 na rota de métricas (/api/v1/metrics/summary).

Implementada rota com dados mockados (zeros) para permitir a renderização da interface sem quebras.

Status Final do Dia

Sistema estável, conectado e pronto para a fase de ingestão de dados reais. NAT Gateway ativo (atenção aos custos).

[2025-12-04] Resolução Crítica do Roteamento (404) e Novo Bloco (400 ML)

Status: 404 Resolvido / 400 Novo Bloqueio

Conquistas do Dia

CI/CD: Resolvidos os erros de sintaxe YAML e de pnpm que impediam o deploy. O pipeline agora está funcional.

Roteamento Fastify (404): Corrigida a sintaxe no server.ts adicionando a barra inicial (/) nos prefixos de rota, eliminando o erro 404 Not Found.

Funcionalidade: O botão "Conectar Mercado Livre" agora redireciona corretamente para https://auth.mercadolivre.com.br/.

Ocorrência Passada (400 Bad Request)

Cenário: O Mercado Livre rejeita a requisição de login.

Causa Raiz: O ML devolve 400 Bad Request por erro de validação de parâmetro (provavelmente redirect_uri ou client_id).

Ação: O próximo passo é rodar o teste manual da URL para obter a mensagem de erro exata do ML.

[2025-12-02] Ajustes de Roteamento e Tipagem ML

Partner: Gemini | Status: Em Debug

Ocorrências

Erro de URL ML ("Resource not found"):

Diagnóstico: A API estava gerando links de login apontando para api.mercadolibre.com (incorreto) em vez de auth.mercadolivre.com.br.

Correção: Código ajustado para usar a URL de Auth correta.

Erro de Prefixo de Rota (404):

Diagnóstico: Frontend chamava /auth/mercadolivre/connect, mas Backend expunha /mercadolivre/connect.

Correção: Ajustado server.ts para incluir prefixo /auth.

Erro de Build TypeScript:

Problema: Falha no pnpm build ao tentar salvar a conexão no banco.

Causa Raiz: Divergência de nomenclatura. O Schema do Prisma define colunas em snake_case (tenant_id, access_token), mas o código TypeScript estava passando camelCase.

Ação Necessária: Refatorar a chamada do Prisma para usar os nomes exatos do banco.

[2025-12-01] Resolução de Conectividade App Runner <-> RDS

Status: Resolvido

Problema

Erro P1001: Can't reach database server e Timed out fetching connection ao tentar registrar usuário, mesmo com a senha correta.

Causa Raiz

Bloqueio de Security Group. O RDS estava aceitando conexões apenas do Bastion Host e de si mesmo, mas bloqueava o tráfego vindo do novo serviço App Runner.

Solução Aplicada

Identificado o ID do Security Group do App Runner.

Adicionada regra de entrada (Inbound Rule) no Security Group do RDS permitindo tráfego TCP/5432 vindo do SG do App Runner.

Conexão estabelecida com sucesso. Registro de usuário validado em produção.

[2025-12-01] Refatoração de Infra e Diagnóstico de DB

Partner: Gemini | Status: Em Andamento

Ocorrências e Decisões

Diagnóstico do Erro 500 (Auth):

Identificado que a instância RDS superseller-prod-db está operacional, mas o banco de dados lógico não foi criado ("DB Name: -").

Solução: Criar database manualmente e corrigir Connection String.

Pivot de Infraestrutura (Custo/Complexidade):

Problema: Arquitetura atual (ECS Fargate + ALB) tem custo fixo elevado (~$80/mês) e complexidade desnecessária para o estágio atual.

Decisão: Migrar computação para AWS App Runner.

Benefício: Redução drástica de custo (escala a zero), SSL nativo, deploy simplificado.

Expansão de Arquitetura (Novos Requisitos):

Filas: Adoção oficial do AWS SQS para lidar com latência de IA e Rate Limits do Mercado Livre.

Módulo de IA: Reforçado requisito de ser agnóstico ao modelo (Interface GenAIProvider).

Segurança: Tokens de acesso (ML/Shopee) serão criptografados no banco.

Ferramentas:

Adoção do Cursor (IDE) para desenvolvimento assistido, substituindo uso genérico de LLMs externos para código.