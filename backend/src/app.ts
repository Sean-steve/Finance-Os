import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { Config } from './config.js';
import type { Queryable } from './db/client.js';

export const API_CONTRACT = 'finance-os.v1';
export type Dependencies = { config: Config; database: Queryable };
export async function buildApp({ config, database }: Dependencies) {
  const app = Fastify({
    logger: { level: config.logLevel, redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie', 'req.body.password', 'req.body.token'] },
    trustProxy: false,
    bodyLimit: 256 * 1024,
    requestIdHeader: false,
  });
  await app.register(helmet);
  await app.register(cors, {
    credentials: false,
    origin(origin, callback) {
      callback(null, !origin || config.corsAllowedOrigins.includes(origin));
    },
  });
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Cache-Control', 'no-store');
    return payload;
  });
  app.get('/health/live', async () => ({ status: 'live', service: 'finance-os-api' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      const result = await database.query('SELECT version FROM schema_migrations ORDER BY version');
      const versions = new Set(result.rows.map(row => (row as {version:string}).version));
      const required = ['001_identity_workspaces.sql', '002_financial_domains.sql', '003_integrity_rls.sql'];
      if (!required.every(version => versions.has(version))) throw new Error('Migrations not applied');
      return { status: 'ready', migrationTracking: true };
    } catch {
      reply.code(503);
      return { status: 'unavailable', migrationTracking: false };
    }
  });
  app.get('/v1/meta', async () => ({
    api: API_CONTRACT,
    stage: 'B0',
    implementation: 'foundation-only',
    financialEndpointsAvailable: false,
    authenticationAvailable: false,
    reference: 'openapi/finance-os.v1.json',
  }));
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: { code: 'ROUTE_NOT_IMPLEMENTED', message: 'Route not available in backend Phase B0' } });
  });
  app.setErrorHandler((_error, _request, reply) => {
    reply.code(500).send({ error: { code: 'INTERNAL', message: 'An unexpected server error occurred' } });
  });
  return app;
}
