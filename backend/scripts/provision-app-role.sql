-- Execute ONLY as a trusted database provisioner with:
-- psql -v ON_ERROR_STOP=1 -v app_password="$FINANCE_APP_PASSWORD" -f scripts/provision-app-role.sql
-- Keep app password separate from migration password; app role never owns schema.
\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='finance_app') THEN
    CREATE ROLE finance_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
ALTER ROLE finance_app PASSWORD :'app_password';
SELECT format('GRANT CONNECT ON DATABASE %I TO finance_app;',current_database()) \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public, app TO finance_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO finance_app;
-- B0 deliberately does not grant INSERT/UPDATE/DELETE to API role.
-- Add narrow resource grants in B1/B2 after auth, domain services, and audit enforcement.
