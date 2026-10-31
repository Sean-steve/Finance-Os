import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const files = (await readdir(directory)).filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
if (new Set(files.map(name => name.slice(0, 4))).size !== files.length) throw new Error('Migration sequence numbers must be unique');
const checkOnly = process.argv.includes('--check');
if (process.argv.some(arg => arg.startsWith('--') && arg !== '--check')) throw new Error('Unknown migration argument');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required; refusing to apply migrations to an unspecified database');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL_MODE === 'require' ? { rejectUnauthorized: true } : undefined });
await client.connect();
try {
 await client.query('BEGIN');
 // Transaction-scoped advisory lock serializes concurrent migration runners.
 await client.query('SELECT pg_advisory_xact_lock(712904, 20261031)');
 await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
   version varchar(4) PRIMARY KEY, filename text NOT NULL, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
 )`);
 const applied = await client.query('SELECT version, sha256, filename FROM public.schema_migrations');
 const seen = new Map(applied.rows.map(row => [row.version, row]));
 if (seen.size > files.length) throw new Error('Database has migrations not present in this codebase');
 let pending = 0;
 for (const name of files) {
   const version = name.slice(0, 4);
   const sql = await readFile(resolve(directory, name), 'utf8');
   const sha256 = createHash('sha256').update(sql).digest('hex');
   const previous = seen.get(version);
   if (previous) {
     if (previous.sha256 !== sha256 || previous.filename !== name) throw new Error('Previously applied migration changed: ' + name);
     continue;
   }
   pending++;
   if (checkOnly) continue;
   await client.query(sql);
   await client.query('INSERT INTO public.schema_migrations(version, filename, sha256) VALUES($1, $2, $3)', [version, name, sha256]);
   console.log('Applied migration', name);
 }
 if (checkOnly && pending) throw new Error(pending + ' unapplied migration(s); run npm run db:migrate');
 await client.query('COMMIT');
 console.log(checkOnly ? 'Migration checksum and application state OK' : 'Migrations up to date');
} catch (error) {
 await client.query('ROLLBACK');
 console.error(error.message);
 process.exitCode = 1;
} finally { await client.end(); }
