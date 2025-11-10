import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-2',
});

interface ShopeeCredentials {
  clientId: string;
  clientSecret: string;
}

interface MercadoLivreCredentials {
  clientId: string;
  clientSecret: string;
}

const secretCache = new Map<string, Record<string, string>>();

async function getSecret(secretName: string): Promise<Record<string, string>> {
  if (secretCache.has(secretName)) {
    const cached = secretCache.get(secretName);
    if (cached) {
      return cached;
    }
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    
    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString);
      secretCache.set(secretName, secret);
      return secret;
    }
    
    throw new Error('Secret not found');
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error);
    throw error;
  }
}

export async function getShopeeCredentials(): Promise<ShopeeCredentials> {
  if (process.env.NODE_ENV === 'development' || !process.env.AWS_REGION) {
    return {
      clientId: process.env.SHOPEE_CLIENT_ID || 'dev-client-id',
      clientSecret: process.env.SHOPEE_CLIENT_SECRET || 'dev-client-secret',
    };
  }

  const secret = await getSecret('superseller/shopee/credentials');
  return {
    clientId: secret.clientId,
    clientSecret: secret.clientSecret,
  };
}

export async function getMercadoLivreCredentials(): Promise<MercadoLivreCredentials> {
  if (process.env.NODE_ENV === 'development' || !process.env.AWS_REGION) {
    return {
      clientId: process.env.MERCADOLIVRE_CLIENT_ID || 'dev-client-id',
      clientSecret: process.env.MERCADOLIVRE_CLIENT_SECRET || 'dev-client-secret',
    };
  }

  const secret = await getSecret('superseller/mercadolivre/credentials');
  return {
    clientId: secret.clientId,
    clientSecret: secret.clientSecret,
  };
}
