import { buildApp } from './app.mjs';
import pg from 'pg';
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');
const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new pg.Pool({
  connectionString, max: 8, idleTimeoutMillis: 30_000,
  ssl: process.env.DATABASE_SSL_MODE === 'require' ? { rejectUnauthorized: true } : undefined
}) : null;
const app = await buildApp({ logger: { level: process.env.LOG_LEVEL || 'info' }, pool });
try { await app.listen({ port, host }); } catch (error) { app.log.error(error); process.exit(1); }
const shutdown = async () => { await app.close(); if (pool) await pool.end(); process.exit(0); };
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
