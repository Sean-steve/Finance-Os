import pg from 'pg';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error('MIGRATION_DATABASE_URL is required (do not run migrations as the app role)');
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../db/migrations');
const files = readdirSync(dir).filter(name => /^\d{3}_[\w-]+\.sql$/.test(name)).sort();
if (files.length === 0) throw new Error('No SQL migrations found');
const client = new pg.Client({ connectionString: url, application_name: 'finance-os-migrations' });
let locked = false;
try {
  await client.connect();
  await client.query('SELECT pg_advisory_lock($1)', [742006]);
  locked = true;
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  for (const file of files) {
    const sql = readFileSync(resolve(dir, file), 'utf8');
    const sha256 = createHash('sha256').update(sql).digest('hex');
    const applied = await client.query<{sha256:string}>('SELECT sha256 FROM schema_migrations WHERE version=$1', [file]);
    if (applied.rows.length) {
      if (applied.rows[0]?.sha256 !== sha256) throw new Error(`Migration drift: ${file} changed after application`);
      console.log('SKIP', file);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version, sha256) VALUES($1,$2)', [file, sha256]);
      await client.query('COMMIT');
      console.log('APPLIED', file);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
} finally {
  if (locked) await client.query('SELECT pg_advisory_unlock($1)', [742006]).catch(() => undefined);
  await client.end().catch(() => undefined);
}
