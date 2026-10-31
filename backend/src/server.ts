import { loadConfig } from './config.js';
import { createPool } from './db/client.js';
import { buildApp } from './app.js';

const config = loadConfig();
const pool = createPool(config);
const app = await buildApp({ config, database: pool });
async function close() { await app.close(); await pool.end(); }
process.once('SIGTERM', () => { void close().finally(() => process.exit(0)); });
process.once('SIGINT', () => { void close().finally(() => process.exit(0)); });
try { await app.listen({ port: config.port, host: config.host }); }
catch (error) { app.log.error(error); await close(); process.exitCode = 1; }
