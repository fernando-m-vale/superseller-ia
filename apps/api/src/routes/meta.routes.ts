/**
 * Meta Routes
 * 
 * Endpoints de introspecção e metadados da API.
 * Útil para validar deploy e versão em produção.
 */

import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const metaRoutes: FastifyPluginCallback = (app, _, done) => {
  /**
   * GET /api/v1/meta
   * 
   * Retorna metadados da API: git SHA, build time, ambiente.
   * Útil para validar se produção está rodando o commit correto.
   */
  app.get('/meta', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      let gitSha = 'unknown';
      let buildTime = 'unknown';
      
      // Tentar obter git SHA
      try {
        gitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      } catch (err) {
        // Se não conseguir via git, tentar via env
        gitSha = process.env.GIT_SHA || process.env.COMMIT_SHA || 'unknown';
      }

      // Tentar obter build time
      try {
        // Verificar se existe arquivo de build info
        const buildInfoPath = join(__dirname, '../../build-info.json');
        if (existsSync(buildInfoPath)) {
          try {
            const buildInfo = JSON.parse(readFileSync(buildInfoPath, 'utf-8'));
            buildTime = buildInfo.buildTime || new Date().toISOString();
          } catch {
            // Se não conseguir ler, usar timestamp atual
            buildTime = new Date().toISOString();
          }
        } else {
          // Se não existir, usar timestamp atual
          buildTime = new Date().toISOString();
        }
      } catch (err) {
        buildTime = process.env.BUILD_TIME || new Date().toISOString();
      }

      // Obter short SHA (7 caracteres)
      const shortSha = gitSha !== 'unknown' && gitSha.length > 7 
        ? gitSha.substring(0, 7) 
        : gitSha;

      const response = {
        gitSha,
        gitShaShort: shortSha,
        buildTime,
        env: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        promptVersion: process.env.AI_PROMPT_VERSION || 'ml-expert-v22',
        timestamp: new Date().toISOString(),
      };

      return reply.status(200).send(response);
    } catch (error) {
      app.log.error({ err: error }, '[META] Erro ao gerar metadados');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Erro ao gerar metadados',
        gitSha: 'error',
        buildTime: 'error',
        env: process.env.NODE_ENV || 'unknown',
      });
    }
  });

  done();
};
