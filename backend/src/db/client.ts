import pg from 'pg';
import type { Config } from '../config.js';
const { Pool } = pg;

/** Application role only. The migration tool requires separate, privileged DATABASE_URL. */
export function createPool(config: Config): pg.Pool {
  return new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 4000,
    idleTimeoutMillis: 15000,
    application_name: 'finance-os-api',
  });
}
export interface Queryable {
  query(text: string, values?: readonly unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
}
