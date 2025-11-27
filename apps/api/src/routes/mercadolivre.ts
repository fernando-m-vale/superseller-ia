import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';
import { getMercadoLivreCredentials } from '../lib/secrets';
import { authGuard } from '../plugins/auth';

const prisma = new PrismaClient();

const ML_API_BASE = 'https://api.mercadolibre.com';

interface RequestWithAuth extends FastifyRequest {
  userId?: string;
  tenantId?: string;
}

export const mercadolivreRoutes: FastifyPluginCallback = (app, _, done) => {
  app.get('/auth/mercadolivre/authorize', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, tenantId } = req as RequestWithAuth;

    if (!userId || !tenantId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const credentials = await getMercadoLivreCredentials();
    const state = crypto.randomBytes(16).toString('hex');

    const stateData = JSON.stringify({ tenantId, userId, nonce: state });
    const encodedState = Buffer.from(stateData).toString('base64');

    const authUrl = new URL(`${ML_API_BASE}/authorization`);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', credentials.clientId);
    authUrl.searchParams.append('redirect_uri', credentials.redirectUri);
    authUrl.searchParams.append('state', encodedState);

    return reply.send({ authUrl: authUrl.toString() });
  } catch (error) {
    app.log.error(error);
    return reply
      .status(500)
      .send({ error: 'Failed to initiate Mercado Livre authorization' });
  }
});


    app.get('/auth/mercadolivre/callback', async (req, reply) => {
    try {
      const { code, state } = req.query as {
        code?: string;
        state?: string;
      };

      if (!code || !state) {
        return reply.status(400).send({ error: 'Missing required parameters' });
      }

      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const { tenantId, userId } = stateData;

      if (!tenantId || !userId) {
        return reply.status(400).send({ error: 'Invalid state parameter' });
      }

      const credentials = await getMercadoLivreCredentials();

      const tokenResponse = await axios.post(
        `${ML_API_BASE}/oauth/token`,
        {
          grant_type: 'authorization_code',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          code,
          redirect_uri: credentials.redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );



      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      const expiresAt = new Date(Date.now() + expires_in * 1000);

      const existingConnection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: 'mercadolivre',
        },
      });

      if (existingConnection) {
        await prisma.marketplaceConnection.update({
          where: {
            id: existingConnection.id,
          },
          data: {
            access_token,
            refresh_token,
            expires_at: expiresAt,
            status: 'active',
            updated_at: new Date(),
          },
        });
      } else {
        await prisma.marketplaceConnection.create({
          data: {
            tenant_id: tenantId,
            type: 'mercadolivre',
            access_token,
            refresh_token,
            expires_at: expiresAt,
            status: 'active',
          },
        });
      }

      return reply.redirect(`${process.env.CORS_ORIGIN}/overview?mercadolivre=connected`);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to complete Mercado Livre authorization' });
    }
  });

  app.get('/mercadolivre/sync', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, tenantId } = req as RequestWithAuth;

      if (!userId || !tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const connection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: 'mercadolivre',
          status: 'active',
        },
      });

      if (!connection) {
        return reply.status(404).send({ error: 'Mercado Livre connection not found' });
      }

      if (connection.expires_at && connection.expires_at < new Date()) {
        const credentials = await getMercadoLivreCredentials();
        
        try {
          const refreshResponse = await axios.post(
            `${ML_API_BASE}/oauth/token`,
            {
              grant_type: 'refresh_token',
              client_id: credentials.clientId,
              client_secret: credentials.clientSecret,
              refresh_token: connection.refresh_token,
            },
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          );

          const { access_token, refresh_token, expires_in } = refreshResponse.data;
          const newExpiresAt = new Date(Date.now() + expires_in * 1000);

          await prisma.marketplaceConnection.update({
            where: {
              id: connection.id,
            },
            data: {
              access_token,
              refresh_token,
              expires_at: newExpiresAt,
              updated_at: new Date(),
            },
          });

          connection.access_token = access_token;
        } catch (refreshError) {
          app.log.error(refreshError);
          return reply.status(401).send({ error: 'Token expired and refresh failed, please reconnect' });
        }
      }

      const userResponse = await axios.get(`${ML_API_BASE}/users/me`, {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      });

      const sellerId = userResponse.data.id;

      const listingsResponse = await axios.get(
        `${ML_API_BASE}/users/${sellerId}/items/search`,
        {
          headers: {
            Authorization: `Bearer ${connection.access_token}`,
          },
          params: {
            limit: 50,
            offset: 0,
          },
        }
      );

      const itemIds = listingsResponse.data.results;

      const syncedListings = [];
      for (const itemId of itemIds || []) {
        const itemResponse = await axios.get(`${ML_API_BASE}/items/${itemId}`, {
          headers: {
            Authorization: `Bearer ${connection.access_token}`,
          },
        });

        const item = itemResponse.data;

        const listing = await prisma.listing.upsert({
          where: {
            tenant_id_marketplace_listing_id_ext: {
              tenant_id: tenantId,
              marketplace: 'mercadolivre',
              listing_id_ext: item.id,
            },
          },
          update: {
            title: item.title,
            price: item.price || 0,
            stock: item.available_quantity || 0,
            status: item.status === 'active' ? 'active' : 'paused',
            updated_at: new Date(),
          },
          create: {
            tenant_id: tenantId,
            marketplace: 'mercadolivre',
            listing_id_ext: item.id,
            title: item.title,
            price: item.price || 0,
            stock: item.available_quantity || 0,
            status: item.status === 'active' ? 'active' : 'paused',
            category: item.category_id,
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
      return reply.status(500).send({ error: 'Failed to sync Mercado Livre listings' });
    }
  });

    app.get('/mercadolivre/health', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, tenantId } = req as RequestWithAuth;

      if (!userId || !tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const connection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: 'mercadolivre',
          status: 'active',
        },
      });

      if (!connection) {
        return reply
          .status(404)
          .send({ error: 'Mercado Livre connection not found' });
      }

      let accessToken = connection.access_token;

      // Se token expirou, tenta renovar (mesma lógica do /mercadolivre/sync)
      if (connection.expires_at && connection.expires_at < new Date()) {
        const credentials = await getMercadoLivreCredentials();

        try {
          const refreshResponse = await axios.post(
            `${ML_API_BASE}/oauth/token`,
            {
              grant_type: 'refresh_token',
              client_id: credentials.clientId,
              client_secret: credentials.clientSecret,
              refresh_token: connection.refresh_token,
            },
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            },
          );

          const { access_token, refresh_token, expires_in } =
            refreshResponse.data;
          const newExpiresAt = new Date(Date.now() + expires_in * 1000);

          await prisma.marketplaceConnection.update({
            where: {
              id: connection.id,
            },
            data: {
              access_token,
              refresh_token,
              expires_at: newExpiresAt,
              updated_at: new Date(),
            },
          });

          accessToken = access_token;
        } catch (refreshError) {
          app.log.error(refreshError);
          return reply.status(401).send({
            error:
              'Token expired and refresh failed, please reconnect Mercado Livre',
          });
        }
      }

      // Chama /users/me para validar credenciais e permissão
      const userResponse = await axios.get(`${ML_API_BASE}/users/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const { id, nickname, site_id, country_id, tags } = userResponse.data;

      return reply.send({
        ok: true,
        sellerId: id,
        nickname,
        siteId: site_id,
        countryId: country_id,
        tags,
      });
    } catch (error) {
      app.log.error(error);
      return reply
        .status(500)
        .send({ error: 'Failed to call Mercado Livre API (health)' });
    }
  });

    app.get('/mercadolivre/orders/:orderId', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, tenantId } = req as RequestWithAuth;

      if (!userId || !tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { orderId } = req.params as { orderId: string };

      const connection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: 'mercadolivre',
          status: 'active',
        },
      });

      if (!connection) {
        return reply
          .status(404)
          .send({ error: 'Mercado Livre connection not found' });
      }

      let accessToken = connection.access_token;

      if (connection.expires_at && connection.expires_at < new Date()) {
        const credentials = await getMercadoLivreCredentials();

        try {
          const refreshResponse = await axios.post(
            `${ML_API_BASE}/oauth/token`,
            {
              grant_type: 'refresh_token',
              client_id: credentials.clientId,
              client_secret: credentials.clientSecret,
              refresh_token: connection.refresh_token,
            },
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            },
          );

          const { access_token, refresh_token, expires_in } =
            refreshResponse.data;
          const newExpiresAt = new Date(Date.now() + expires_in * 1000);

          await prisma.marketplaceConnection.update({
            where: {
              id: connection.id,
            },
            data: {
              access_token,
              refresh_token,
              expires_at: newExpiresAt,
              updated_at: new Date(),
            },
          });

          accessToken = access_token;
        } catch (refreshError) {
          app.log.error(refreshError);
          return reply.status(401).send({
            error:
              'Token expired and refresh failed, please reconnect Mercado Livre',
          });
        }
      }

      const orderResponse = await axios.get(
        `${ML_API_BASE}/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return reply.send({
        ok: true,
        order: orderResponse.data,
      });
    } catch (error) {
      app.log.error(error);
      return reply
        .status(500)
        .send({ error: 'Failed to fetch Mercado Livre order' });
    }
  });

  app.get('/mercadolivre/items/:itemId', { preHandler: authGuard }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, tenantId } = req as RequestWithAuth;

      if (!userId || !tenantId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { itemId } = req.params as { itemId: string };

      const connection = await prisma.marketplaceConnection.findFirst({
        where: {
          tenant_id: tenantId,
          type: 'mercadolivre',
          status: 'active',
        },
      });

      if (!connection) {
        return reply
          .status(404)
          .send({ error: 'Mercado Livre connection not found' });
      }

      let accessToken = connection.access_token;

      if (connection.expires_at && connection.expires_at < new Date()) {
        const credentials = await getMercadoLivreCredentials();

        try {
          const refreshResponse = await axios.post(
            `${ML_API_BASE}/oauth/token`,
            {
              grant_type: 'refresh_token',
              client_id: credentials.clientId,
              client_secret: credentials.clientSecret,
              refresh_token: connection.refresh_token,
            },
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            },
          );

          const { access_token, refresh_token, expires_in } =
            refreshResponse.data;
          const newExpiresAt = new Date(Date.now() + expires_in * 1000);

          await prisma.marketplaceConnection.update({
            where: {
              id: connection.id,
            },
            data: {
              access_token,
              refresh_token,
              expires_at: newExpiresAt,
              updated_at: new Date(),
            },
          });

          accessToken = access_token;
        } catch (refreshError) {
          app.log.error(refreshError);
          return reply.status(401).send({
            error:
              'Token expired and refresh failed, please reconnect Mercado Livre',
          });
        }
      }

      const itemResponse = await axios.get(
        `${ML_API_BASE}/items/${itemId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return reply.send({
        ok: true,
        item: itemResponse.data,
      });
    } catch (error) {
      app.log.error(error);
      return reply
        .status(500)
        .send({ error: 'Failed to fetch Mercado Livre item' });
    }
  });


  done();
};
