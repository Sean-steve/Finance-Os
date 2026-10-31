-- Phase B1 provisioning: apply as privileged provisioner after migrations.
-- App and auth roles receive different passwords: never put them in Git.
\set ON_ERROR_STOP on
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finance_app') THEN
  CREATE ROLE finance_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finance_auth') THEN
  CREATE ROLE finance_auth LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $$;
ALTER ROLE finance_app PASSWORD :'app_password';
-- In B0-only uses (without auth_password) the auth role stays NOLOGIN until configured.
\if :{?auth_password}
ALTER ROLE finance_auth PASSWORD :'auth_password';
\endif
SELECT format('GRANT CONNECT ON DATABASE %I TO finance_app, finance_auth;',current_database()) \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA public, app TO finance_app;
GRANT USAGE ON SCHEMA public, app TO finance_auth;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO finance_app;
GRANT INSERT ON financial_accounts,financial_categories,ledger_accounts,journal_entries,journal_lines,
 manual_transactions,import_batches,import_rows,reconciliation_matches,idempotency_records,audit_events,
 budgets,budget_allocations,spending_guardrails,approval_requests,spending_approval_consumptions
 TO finance_app;
GRANT UPDATE(status,posted_at) ON journal_entries TO finance_app;
GRANT UPDATE(result_id) ON idempotency_records TO finance_app;
GRANT UPDATE(disposition,entry_id) ON import_rows TO finance_app;
GRANT UPDATE(status,version) ON budgets TO finance_app;
GRANT UPDATE(active,version) ON spending_guardrails TO finance_app;
GRANT UPDATE(status,decided_by,decided_at) ON approval_requests TO finance_app;

-- finance_auth handles only registration and opaque sessions. It has no finance ledger privileges.
GRANT SELECT,INSERT ON app_users,workspaces,workspace_members TO finance_auth;
GRANT SELECT,INSERT ON app.password_credentials,app.sessions TO finance_auth;
GRANT UPDATE(last_used_at,revoked_at) ON app.sessions TO finance_auth;
-- No password updates, workspace owner changes or financial postings are permitted via auth role.
