// Declarações mínimas para os pacotes internos do monorepo
// Só para o TypeScript parar de reclamar no build da API.

declare module '@superseller/core' {
  // A API só precisa chamar essa função. Tipagem frouxa por enquanto.
  export function healthScore(...args: any[]): any;
}

declare module '@superseller/ai' {
  // Mesma ideia aqui: só precisamos chamar recommendActions.
  export function recommendActions(...args: any[]): any;
}
