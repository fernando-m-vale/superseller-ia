# Frontend Guidelines — Superseller IA

## Persistência client-side (localStorage)

Para evitar erros de hidratação (SSR/CSR mismatch) em apps Next.js:

1. Ler `localStorage` **somente dentro de `useEffect`**
2. Usar um estado `mounted` para controlar renderização condicional
3. Exibir skeleton até a montagem completa do client

### Exemplo
```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);

if (!mounted) return <Skeleton />;
```
