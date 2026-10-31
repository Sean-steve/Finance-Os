import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';

export async function buildApp(options = {}) {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: false, disableRequestLogging: true, requestIdHeader: false });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Cache-Control', 'no-store');
    // B0 deliberately does not enable cross-origin access to private resources.
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ type: 'https://finance-os.local/problems/not-found', title: 'Not Found', status: 404, detail: 'Resource not found', requestId: request.id }));
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
    request.log.error({ error, requestId: request.id }, 'request failed');
    reply.code(status).type('application/problem+json').send({ type: 'https://finance-os.local/problems/' + (status === 500 ? 'internal-error' : 'invalid-request'), title: status === 500 ? 'Internal Server Error' : 'Invalid request', status, requestId: request.id });
  });
  app.get('/health/live', { schema: { response: { 200: { type: 'object', required: ['status', 'service'], properties: { status: { type: 'string' }, service: { type: 'string' } } } } } }, async () => ({ status: 'ok', service: 'finance-os-api' }));
  // Versioned health response; /ready performs a DB query only when provided a pool.
  app.get('/health/ready', async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ status: 'unavailable', reason: 'database-not-configured' });
    try { await options.pool.query('SELECT 1'); return { status: 'ok', service: 'finance-os-api' }; }
    catch { return reply.code(503).send({ status: 'unavailable', reason: 'database-unavailable' }); }
  });
  app.get('/v1', async () => ({
    service: 'finance-os-api', apiVersion: 'v1', stage: 'B0', status: 'contracts-only',
    note: 'Authenticated financial endpoints are reserved until B1. No real financial data is served.'
  }));
  return app;
}
