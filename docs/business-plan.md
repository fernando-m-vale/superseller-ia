# Super Seller IA — Business Plan v0.1 (Draft)

> **Elevator Pitch (1–2 linhas)**  
> O Super Seller IA é uma plataforma SaaS que conecta-se às contas Shopee, Mercado Livre, Amazon e Magalu para **diagnosticar diariamente** a saúde dos anúncios, **priorizar ações prescritivas** (o que fazer, onde e por quê) e **executar automações aprovadas** pelo lojista, elevando **ranqueamento, visitas e conversão**.

---

## 1) Visão Geral
- **Problema**: Vendedores multi-marketplace carecem de tempo, conhecimento e ferramentas prescritivas para transformar dados em ações que geram faturamento.
- **Solução**: Copiloto de IA + automação, combinando dados oficiais das APIs com modelos que entendem **regras e algoritmos** das plataformas, para **priorizar e executar** melhorias em anúncios e campanhas.
- **Para quem**: Lojas com 50–5.000 SKUs que operam Shopee/Mercado Livre/Amazon/Magalu e buscam escalar com eficiência.
- **Resultados esperados**: +20–40% nas visitas úteis, +10–25% na taxa de conversão em 90 dias (meta inicial), redução de 30–60% do tempo gasto em análise operacional.

---

## 2) Dores do Mercado (resumo)
1. **Tempo**: Operação diária impede análises profundas e contínuas.  
2. **Know-how**: Falta método para conectar dados, diagnosticar causas e mapear ações assertivas.  
3. **Ferramentas**: Dashboards existem, mas **não dizem o que fazer**; faltam recomendações acionáveis e automações com “human-in-the-loop”.

---

## 3) Proposta de Valor
- **Análise diária automática** com *Health Score* por anúncio e por loja.  
- **Fila de Ações Prioritárias** (Impacto x Esforço) com justificativa e previsão de ganho.  
- **Automação assistida**: o usuário aprova; a IA executa (títulos, imagens, descrição, preços, bids, campanhas, atributos, variações).  
- **Aprendizado contínuo**: modelos calibram com histórico da loja e da categoria, incorporando mudanças de algoritmo.

---

## 4) Diferenciais Competitivos
1. **Prescritivo e não só descritivo**: vai além do dashboard.  
2. **Execução ponta a ponta** (sugerir → aprovar → executar → medir).  
3. **Especialista na “regra do jogo”** (regras/heurísticas por marketplace + experimentos A/B).  
4. **Biblioteca de Playbooks** (SEO interno, imagem capa, variações, frete, preço, anúncios patrocinados, reputação, NPS/reviews).  
5. **Multiplataforma nativo** (Shopee, Mercado Livre primeiro; depois Amazon/Magalu).  
6. **Medição de impacto** por cada ação (uplift, attribution simples)

---

## 5) Produto (MVP → V1)
### MVP (0–90 dias)
- **Conectores**: Shopee e Mercado Livre (OAuth, coleta diária).  
- **Métricas-base**: impressões, CTR, visitas, conversão, GMV, ticket médio, cancelamento, frete, SLA, Buy Box/Posição (quando disponível), *search terms* internos.  
- **Health Score** por anúncio e por loja.  
- **Action Queue** com 20+ recomendações:  
  - Título e **SEO interno** (termos obrigatórios, densidade, ordem, limites).  
  - **Imagem de capa** (checagem de diretrizes e geração assistida).  
  - **Atributos obrigatórios** e variações faltantes.  
  - **Preço** (regra com base em elasticidade simplificada, taxas e concorrência observável).  
  - **Ads** (CPC sugerido, negativos, realocação de budget entre campanhas).  
  - **Estoque** (ruptura iminente, recomendação de reposição).  
- **Execução assistida** (com aprovação) para: título/descrição, imagens, atributos, campanhas básicas.  
- **Relatório diário** por e‑mail/WhatsApp: top 10 ações e ganhos estimados.

### V1 (90–180 dias)
- Conector **Amazon** e **Magalu**.  
- **Playbooks por categoria** (Moda, Eletrônicos, Casa & Decor, Infantil).  
- **Testes A/B** nativos (título/capa/benefícios).  
- **Otimização de lances** com *guardrails* (ROAS/ACOS).  
- **Reputation & Reviews Mining** (temas de elogio/rejeição → ações).  
- **Pricing dinâmico** com regras avançadas (custos, taxa, frete, concorrência, margem-alvo).  
- **API pública** para integrações (ERP/WMS/PIM).

---

## 6) Personas & ICP
- **Loja em crescimento (PME)**: 50–300 SKUs, 200–2.000 pedidos/mês; precisa de tração e padronização.  
- **Operador profissional**: 300–2.000 SKUs, multi-time; busca automação e governança.  
- **Agências/gestores de conta**: gerenciam múltiplas lojas; necessitam escala e relatórios multi-cliente.

**Regiões**: Brasil (foco inicial). Expansão: PT/ES LatAm.  
**Canais**: vendedores com **Shopee** e **Mercado Livre** (entrada) e presença em 1–2 marketplaces adicionais.

---

## 7) Mercado (qualitativo)
- Mercado de e‑commerce brasileiro em alta penetração, com forte adoção de marketplaces.  
- Fragmentação de sellers e **ímã de valor** em soluções que poupam tempo e elevam conversão.  
- Ferramentas atuais tendem a **descrever dados**; espaço para plataforma **prescritiva + automação**.

---

## 8) Análise Competitiva (macro)
**Categorias de concorrentes**  
- **Dashboards/BI** (ex.: métricas e ranking, pouca prescrição).  
- **Suites de operação** (PIM/ERP/WMS com funções básicas de anúncio).  
- **Ferramentas de Ads** (otimizadores de campanha por canal).  
- **Point solutions** (reputação, preço, imagens).  

**Posicionamento Super Seller IA**: “**Copiloto de Crescimento**” que **prioriza e executa** ações multi-canal com avaliação de impacto.

---

## 9) Modelo de Receita (SaaS)
- **Estratégia de entrada (Founders Program)**
  - Turma inicial **30 sellers qualificados**
  - **30 dias gratuitos** com regras de ativação
  - Vaga limitada com posicionamento de exclusividade
  - Benefícios: badge Founder, desconto vitalício, grupo VIP, prioridade em features
  - Objetivo: gerar dados, feedback, casos reais e calibrar IA

- **Freemium pós‑MVP (planejado)**
  - Free: Health Score + 3 ações/semana + alertas básicos
  - Limitações → foco em conversão para planos pagos

- **Planos pagos** (mensal ou anual)
  - **Starter**: R$ 199/mês — 1 loja, até 200 SKUs, 1.000 ações/mês
  - **Pro**: R$ 499/mês — 1–3 lojas, até 1.500 SKUs, 10.000 ações/mês, A/B básico
  - **Scale**: R$ 999/mês — até 10 lojas, API, governança, A/B avançado

- **Add-ons**
  - Ads Optimizer, Dynamic Pricing, Setup, Concierge

---

## 10) Go-to-Market
- **Aquisição**:  
  - Parcerias com **agências, hubs de integração e ERPs**.  
  - Conteúdo e **webinars** (estudos de caso com ganho real).  
  - Comunidades de sellers (Shopee/Mercado Livre), influenciadores de nicho.  
  - Marketplace App Stores (quando houver).  
- **Conversão**: trial 14 dias + *guided tour*.  
- **Retenção/Expansão**: playbooks novos, modelos por categoria, upsell de add-ons.

**Métricas-chave de funil**: visita → trial → ativação (conectar contas + executar 1ª ação) → 30‑day retained → conversão paga.

---

## 11) Roadmap de Produto (12 meses)
**Q1 (0–3m)**: MVP (Shopee/ML), Health Score, Action Queue, Execução assistida, Relatórios diários, Playbooks base.  
**Q2 (4–6m)**: Amazon/Magalu, A/B nativo, Reputation Mining, Ads Optimizer v1, Pricing v1.  
**Q3 (7–9m)**: API pública, regras avançadas de preço, segmentação por coorte, governança multi-time.  
**Q4 (10–12m)**: Marketplace de playbooks, automações condicionais, *what-if simulator*, expansão LatAm.

---

## 12) Arquitetura (alto nível)
- **Ingestão**: conectores OAuth (Shopee, ML, Amazon, Magalu) → **S3 Data Lake**.  
- **Processamento**: jobs **Lambda/Glue** + **Airflow** (ETL/ELT).  
- **Armazenamento**: **RDS Postgres** (operacional) + **Redshift/Databricks** (analítico).  
- **Model Serving**: **SageMaker** ou **ECS** para APIs de recomendação/otimização.  
- **Aplicação**: **Next.js/React** + API (GraphQL/REST), *design system* próprio.  
- **Autenticação & RBAC**: Cognito/Auth0, perfis por papel e clientes multi-loja.  
- **Observabilidade**: CloudWatch + métrica de modelo.  
- **Infra**: IaC (Terraform/CDK), *zero trust* onde aplicável.

---

## 13) Segurança & LGPD
- **Bases legais**: execução de contrato e legítimo interesse; **consentimento** para funcionalidades opcionais.  
- **Minimização de dados** e **retenção** com *data retention policy*.  
- **Criptografia** em repouso (KMS) e em trânsito (TLS).  
- **Segregação por cliente** (tenant isolation).  
- **DPIA** e revisão periódica — incident response playbook.

---

## 14) Operação & Equipe (12 meses)
- **Founders**: Produto/Go-to-market e Tech/ML.  
- **Time inicial (Q1)**: 1 Eng. Backend (conectores), 1 Eng. Data/ML, 1 Frontend, 1 PM/PO, 1 Designer, 1 Sucesso do Cliente.  
- **Q2–Q4**: + Suporte N2, + Eng. Plataforma, + Data Eng., + Marketing Growth, + Sales (parcerias).

---

## 15) Métricas & OKRs
- **Aquisição**: CAC, taxa trial→pago, tempo para “1ª ação executada”, NPS onboarding.  
- **Ativação**: % de anúncios com Health Score ≥80, nº de ações/mês executadas por loja.  
- **Resultado**: ΔCTR, ΔCVR, ΔGMV, ROAS/ACOS, tempo poupado.  
- **Financeiro**: MRR, churn logo, LTV/CAC ≥ 3, Gross Margin ≥ 80%.

---

## 16) Projeções (assunções simplificadas)
- **Preço médio (ARPA)**: R$ 399/mês (mix Starter/Pro/Scale).  
- **Churn mensal**: 3%.  
- **CAC**: R$ 400 (conteúdo + parcerias).  
- **Crescimento**: +25–35 novos clientes/mês após Q2.  
- **Margem bruta**: 80% (infra + suporte escalável).  

> **Exemplo (ilustrativo)**: ao fim de 12 meses com 300 clientes ativos → MRR ≈ R$ 119.700; LTV ≈ R$ 399/(0,03)= R$ 13.300; LTV/CAC ≈ 33.

---

## 17) Unit Economics
- **Payback**: 1–2 meses após conversão (se ARPA ≥ R$ 399 e CAC ≤ R$ 400).  
- **Sensibilidades**: churn ↑ reduz LTV; pricing e upsell aumentam margem; automação reduz COGS de suporte.

---

## 18) Riscos & Mitigações
- **Mudança de APIs/algoritmos** → contrato de manutenção de conectores; *feature flags* e *experiments*.  
- **Acurácia de recomendações** → A/B contínuo, *feedback loop* humano, *guardrails* de execução.  
- **Adoção** → onboarding guiado e “ganhos na 1ª semana”.  
- **Privacidade** → LGPD by design, auditoria e SOC 2/ISO 27001 (roadmap).  
- **Dependência de canais de aquisição** → diversificar (parcerias, conteúdo, comunidades, app stores).

---

## 19) Validação (0–6 semanas)
- **15–20 Design Partners** (mix Shopee/ML, 50–1.000 SKUs).  
- Testes com **2–3 playbooks críticos** (capa, título/SEO, preço ou ads).  
- Métricas de sucesso: +15% CTR e +10% CVR em 30–45 dias; ≥ 70% das ações aprovadas; NPS ≥ 45.

---

## 20) Próximos Passos (Cronograma de Execução)
**Semana 1**: proposta de valor final, ICP, landing page + waitlist, roteiro de entrevistas.  
**Semana 2**: discovery com 10 sellers; priorizar 10 recomendações do MVP.  
**Semana 3**: protótipo navegável (Health Score + Action Queue).  
**Semana 4**: 1º conector (Shopee) em beta; primeiros parceiros usando; iniciar medição de uplift.  
**Semana 5–6**: conector ML, execução assistida para título/descrição/imagens; relatório diário; cobrar primeiros pagamentos com desconto de *founding customers*.

---

## 21) Apêndice — Catálogo de Recomendações (v1)
- **SEO de Título**: termos obrigatórios, posição, limites por canal.  
- **Imagem Capa**: fundo, ângulo, texto, selo, diretrizes de cada marketplace.  
- **Atributos**: completos e corretos; variações essenciais.  
- **Preço**: margem-alvo, taxas, frete, concorrência observável; regras by category.  
- **Ads**: termos negativos, orçamento ótimo, ROAS/ACOS por SKU.  
- **Estoque/Logística**: ruptura iminente, rota de frete (Full/Flex), promessas de entrega.  
- **Reputação**: riscos de comentários, devoluções, satisfação; respostas sugeridas.  
- **Conteúdo**: benefícios, tabelas de medidas, provas, FAQs, políticas.

---

> **Nota**: Este draft é a base para detalhar o **Plano Financeiro** (P&L, fluxo de caixa, cenários), **Backlog funcional** (histórias, critérios de aceite) e **Arquitetura** (diagramas), que serão anexados nas próximas iterações.

