import { FastifyPluginCallback } from 'fastify';
import { PrismaClient, Marketplace, ConnectionStatus } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';
import { getShopeeCredentials } from '../lib/secrets';

const prisma = new PrismaClient();

const SHOPEE_API_BASE = 'https://partner.shopeemobile.com';
const REDIRECT_URI = process.env.SHOPEE_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/shopee/callback';

interface RequestWithAuth {
  userId?: string;
  tenantId?: string;
}

function generateShopeeSignature(path: string, timestamp: number, clientSecret: string): string {
  const baseString = `${path}|${timestamp}`;
  return crypto.createHmac('sha256', clientSecret).update(baseString).digest('hex');
}

export const shopeeRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/auth/shopee/authorize', async (req, reply) => {
    try {
      const { userId, tenantId } = req as RequestWithAuth;

      if (!userId || !tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const credentials = await getShopeeCredentials();
      const state = crypto.randomBytes(16).toString('hex');

      const stateData = JSON.stringify({ tenantId, userId, nonce: state });
      const encodedState = Buffer.from(stateData).toString('base64');

      const authUrl = new URL(`${SHOPEE_API_BASE}/api/v2/shop/auth_partner`);
      authUrl.searchParams.append('partner_id', credentials.clientId);
      authUrl.searchParams.append('redirect', REDIRECT_URI);
      authUrl.searchParams.append('state', encodedState);

      return reply.send({ authUrl: authUrl.toString() });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to initiate Shopee authorization' });
    }
  });

  app.get('/auth/shopee/callback', async (req, reply) => {
    try {
      const { code, shop_id, state } = req.query as {
        code?: string;
        shop_id?: string;
        state?: string;
      };

      if (!code || !shop_id || !state) {
        return reply.status(400).send({ error: 'Missing required parameters' });
      }

      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const { tenantId, userId } = stateData;

      if (!tenantId || !userId) {
        return reply.status(400).send({ error: 'Invalid state parameter' });
      }

      const credentials = await getShopeeCredentials();
      const timestamp = Math.floor(Date.now() / 1000);
      const path = '/api/v2/auth/token/get';
      const signature = generateShopeeSignature(path, timestamp, credentials.clientSecret);

      const tokenResponse = await axios.post(
        `${SHOPEE_API_BASE}${path}`,
        {
          code,
          shop_id: parseInt(shop_id),
          partner_id: parseInt(credentials.clientId),
        },
        {
          params: {
            partner_id: credentials.clientId,
            timestamp,
            sign: signature,
          },
        }
      );

      const { access_token, refresh_token, expire_in } = tokenResponse.data;

      const expiresAt = new Date(Date.now() + expire_in * 1000);

      // Usar shop_id como provider_account_id (identificador único da loja na Shopee)
      const providerAccountId = shop_id;

      const existingConnection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: Marketplace.shopee,
          provider_account_id: providerAccountId,
        },
      });

      if (existingConnection) {
        await prisma.marketplaceConnection.update({
          where: {
            id: existingConnection.id,
          },
          data: {
            access_token: access_token,
            refresh_token: refresh_token,
            expires_at: expiresAt,
            status: ConnectionStatus.active,
          },
        });
      } else {
        await prisma.marketplaceConnection.create({
          data: {
            tenant_id: tenantId,
            type: Marketplace.shopee,
            provider_account_id: providerAccountId,
            access_token: access_token,
            refresh_token: refresh_token,
            expires_at: expiresAt,
            status: ConnectionStatus.active,
          },
        });
      }

      return reply.redirect(`${process.env.CORS_ORIGIN}/overview?shopee=connected`);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to complete Shopee authorization' });
    }
  });

  app.get('/shopee/sync', async (req, reply) => {
    try {
      const { userId, tenantId } = req as RequestWithAuth;

      if (!userId || !tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const connection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: Marketplace.shopee,
          status: ConnectionStatus.active,
        },
      });

      if (!connection) {
        return reply.status(404).send({ error: 'Shopee connection not found' });
      }

      if (connection.expires_at && connection.expires_at < new Date()) {
        return reply.status(401).send({ error: 'Token expired, please reconnect' });
      }

      const credentials = await getShopeeCredentials();
      const timestamp = Math.floor(Date.now() / 1000);
      const path = '/api/v2/product/get_item_list';
      const signature = generateShopeeSignature(path, timestamp, credentials.clientSecret);

      const listingsResponse = await axios.get(`${SHOPEE_API_BASE}${path}`, {
        params: {
          partner_id: credentials.clientId,
          timestamp,
          sign: signature,
          access_token: connection.access_token,
          page_size: 100,
          offset: 0,
        },
      });

      const { item_list } = listingsResponse.data.response;

      const syncedListings = [];
      for (const item of item_list || []) {
        const listing = await prisma.listing.upsert({
          where: {
            tenant_id_marketplace_listing_id_ext: {
              tenant_id: tenantId,
              marketplace: Marketplace.shopee,
              listing_id_ext: item.item_id.toString(),
            },
          },
          update: {
            title: item.item_name,
            price: item.price || 0,
            stock: item.stock || 0,
            status: item.item_status === 'NORMAL' ? 'active' : 'paused',
          },
          create: {
            tenant_id: tenantId,
            marketplace: Marketplace.shopee,
            listing_id_ext: item.item_id.toString(),
            title: item.item_name,
            price: item.price || 0,
            stock: item.stock || 0,
            status: item.item_status === 'NORMAL' ? 'active' : 'paused',
            category: item.category_id?.toString(),
          },
        });

        syncedListings.push(listing);
      }

      return reply.send({
        success: true,
        synced: syncedListings.length,
        listings: syncedListings,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to sync Shopee listings' });
    }
  });

  done();
};
