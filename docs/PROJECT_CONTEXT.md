# PROJECT CONTEXT — SuperSeller IA (Estado Atual)

## Visão do Produto
SuperSeller IA é uma plataforma de inteligência para sellers de marketplaces,
focada em **confiança nos dados**, **clareza de ação** e **execução orientada a resultado**.

O produto não “chuta” métricas nem mascara limitações de API.
Quando o dado não existe, isso é comunicado claramente ao usuário.

## Pilar Central (confirmado)
> Dados confiáveis → Score explicável → Ação priorizada → Execução assistida

## Estado Atual da Arquitetura
- Ingestão ML:
  - Listings via discovery + fallback orders
  - Métricas diárias em `listing_metrics_daily`
  - Visits sempre NULL quando API não retorna (sem estimativas)
- IA:
  - Score determinístico por regras
  - LLM usado apenas para:
    - linguagem
    - sugestões
  - Cache por fingerprint (SHA256 determinístico)
- UX:
  - Nunca mistura dados entre anúncios
  - Cache visível e controlável pelo usuário
  - Performance indisponível não penaliza score

## Decisões importantes consolidadas
- has_video = null ≠ ausência → linguagem condicional obrigatória
- Nenhuma dimensão é penalizada sem dado confiável
- “Melhorar agora” deve sempre levar a um contexto real de ação
- Agentes:
  - Devin → arquitetura, regras, épicas grandes
  - Cursor → UX, semântica, correções finas

## Próximo Marco
Encerrar IA Score V2 com Onda 3.1 e iniciar:
- Automações assistidas (Onda 4)
- Inteligência competitiva
- Estratégia de pricing
