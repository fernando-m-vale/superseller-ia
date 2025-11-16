import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

interface JWTPayload {
  userId: string;
  tenantId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    tenantId?: string;
  }
}

export const authGuard = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized - No token provided' });
    }

    const token = authorization.substring(7);

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return reply.status(401).send({ error: 'Unauthorized - Invalid token' });
    }
    throw error;
  }
};

export const authPlugin: FastifyPluginCallback = (app, _, done) => {
  app.decorate('authGuard', authGuard);
  done();
};
