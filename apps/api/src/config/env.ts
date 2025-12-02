import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  PORT: z.coerce.number().default(3001),
  
  // Banco de Dados e Auth
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string(),

  // Mercado Livre
  ML_APP_ID: z.string(),
  ML_APP_SECRET: z.string(),
  ML_REDIRECT_URI: z.string().url(),

  // Shopee (Opcionais por enquanto)
  SHOPEE_CLIENT_ID: z.string().optional(),
  SHOPEE_CLIENT_SECRET: z.string().optional(),
  SHOPEE_REDIRECT_URI: z.string().optional(),
});

// Validação segura
const _env = envSchema.safeParse(process.env);

if (_env.success === false) {
  console.error('❌ Variáveis de ambiente inválidas:', _env.error.format());
  throw new Error('Variáveis de ambiente inválidas.');
}

export const env = _env.data;