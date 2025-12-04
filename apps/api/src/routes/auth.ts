import { FastifyPluginCallback } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

// Accept either tenantName or storeName for flexibility
// The UI shows "Store Name" but the API field is tenantName
const RawRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantName: z.string().min(1).optional(),
  storeName: z.string().min(1).optional(),
}).refine((data) => data.tenantName || data.storeName, {
  message: 'tenantName or storeName is required',
  path: ['tenantName'],
});

// Transform to normalize the field name
const RegisterSchema = RawRegisterSchema.transform((data) => ({
  email: data.email,
  password: data.password,
  tenantName: data.tenantName ?? data.storeName!,
}));

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes: FastifyPluginCallback = (app, _, done) => {
  // Rota: /api/v1/auth/register (prefixo já inclui /auth)
  app.post('/register', async (req, reply) => {
    try {
      const body = RegisterSchema.parse(req.body);

      const existingUser = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (existingUser) {
        return reply.status(400).send({ error: 'User already exists' });
      }

      const passwordHash = await bcrypt.hash(body.password, 10);

      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: body.tenantName,
          },
        });

        const user = await tx.user.create({
          data: {
            email: body.email,
            password_hash: passwordHash,
            tenant_id: tenant.id,
            role: 'owner',
          },
        });

        return { tenant, user };
      });

      const accessToken = jwt.sign(
        { userId: result.user.id, tenantId: result.tenant.id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const refreshToken = jwt.sign(
        { userId: result.user.id, tenantId: result.tenant.id },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      return reply.status(201).send({
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          tenantId: result.tenant.id,
          tenantName: result.tenant.name,
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Rota: /api/v1/auth/login
  app.post('/login', async (req, reply) => {
    try {
      const body = LoginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: body.email },
        include: { tenant: true },
      });

      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(body.password, user.password_hash);

      if (!isValidPassword) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const accessToken = jwt.sign(
        { userId: user.id, tenantId: user.tenant_id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, tenantId: user.tenant_id },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant.name,
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Rota: /api/v1/auth/me
  app.get('/me', async (req, reply) => {
    try {
      const authorization = req.headers.authorization;

      if (!authorization || !authorization.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const token = authorization.substring(7);

      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        tenantId: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { tenant: true },
      });

      if (!user) {
        return reply.status(401).send({ error: 'User not found' });
      }

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant.name,
        },
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  done();
};
