-- Finance OS Phase B1: local-development identity, immutable manual postings and reconciliation.
-- 004 is forward-only and must be applied by a dedicated migrator. Never rewrite B0 migrations.
CREATE TABLE app.password_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.app_users(id) ON DELETE RESTRICT,
  password_verifier TEXT NOT NULL CHECK (length(password_verifier) BETWEEN 60 AND 400),
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ
);
CREATE TABLE app.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_digest CHAR(64) NOT NULL UNIQUE CHECK(token_digest ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);
CREATE INDEX auth_sessions_user_idx ON app.sessions(user_id,expires_at DESC);
CREATE INDEX auth_sessions_expire_idx ON app.sessions(expires_at) WHERE revoked_at IS NULL;

-- Defense in depth: public schema cannot be read under the unauthenticated auth role
-- except identity bootstrap tables and their explicitly granted operations.
ALTER TABLE app.password_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.password_credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_only_credentials ON app.password_credentials FOR ALL
 USING (current_user = 'finance_auth') WITH CHECK (current_user = 'finance_auth');
ALTER TABLE app.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_only_sessions ON app.sessions FOR ALL
 USING (current_user = 'finance_auth') WITH CHECK (current_user = 'finance_auth');

-- Registration requires a separate finance_auth connection, never finance_app.
-- Auth role can only INSERT identities, personal workspaces and membership via narrow grants.
CREATE POLICY auth_identity_bootstrap ON app_users FOR ALL
 USING (current_user = 'finance_auth') WITH CHECK (current_user = 'finance_auth');
CREATE POLICY auth_workspace_bootstrap ON workspaces FOR ALL
 USING (current_user = 'finance_auth') WITH CHECK (current_user = 'finance_auth');
CREATE POLICY auth_membership_bootstrap ON workspace_members FOR ALL
 USING (current_user = 'finance_auth') WITH CHECK (current_user = 'finance_auth');

CREATE TABLE manual_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL,
  category_id UUID,
  entry_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('INCOME','EXPENSE','TRANSFER')),
  amount_minor BIGINT NOT NULL CHECK(amount_minor <> 0),
  currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 500),
  occurred_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  origin TEXT NOT NULL DEFAULT 'USER_ENTERED' CHECK(origin IN ('USER_ENTERED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  UNIQUE (workspace_id,entry_id),
  FOREIGN KEY(workspace_id,financial_account_id) REFERENCES financial_accounts(workspace_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(workspace_id,category_id) REFERENCES financial_categories(workspace_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(workspace_id,entry_id) REFERENCES journal_entries(workspace_id,id) ON DELETE RESTRICT
);
CREATE INDEX manual_transactions_ws_date_idx ON manual_transactions(workspace_id,occurred_at DESC,id);
CREATE INDEX manual_transactions_account_idx ON manual_transactions(workspace_id,financial_account_id,occurred_at DESC);
CREATE FUNCTION app.manual_transaction_append_only() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Posted manual transactions are immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER manual_transactions_lock BEFORE UPDATE OR DELETE ON manual_transactions
 FOR EACH ROW EXECUTE FUNCTION app.manual_transaction_append_only();

CREATE TABLE reconciliation_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  import_row_id UUID NOT NULL,
  manual_transaction_id UUID NOT NULL,
  matched_by UUID NOT NULL REFERENCES app_users(id),
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,import_row_id),
  UNIQUE(workspace_id,manual_transaction_id),
  FOREIGN KEY(workspace_id,import_row_id) REFERENCES import_rows(workspace_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(workspace_id,manual_transaction_id) REFERENCES manual_transactions(workspace_id,id) ON DELETE RESTRICT
);
CREATE INDEX reconciliation_matches_ws_idx ON reconciliation_matches(workspace_id,matched_at DESC);

-- Existing workspace-only RLS must also authenticate a currently active member.
-- The membership table itself remains workspace-scoped so policies do not recurse.
DO $$
DECLARE tbl TEXT;
BEGIN
 FOREACH tbl IN ARRAY ARRAY[
 'financial_accounts','financial_categories','ledger_accounts','journal_entries','journal_lines',
 'import_batches','import_rows','budgets','budget_allocations','spending_guardrails',
 'approval_requests','income_sources','financial_scenarios','debts','idempotency_records',
 'audit_events','outbox_events'
 ] LOOP
  EXECUTE format('DROP POLICY IF EXISTS workspace_scope ON public.%I',tbl);
  EXECUTE format(
    'CREATE POLICY member_read ON public.%I FOR SELECT USING (workspace_id=app.current_workspace_id() AND EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=app.current_workspace_id() AND m.user_id=app.current_actor_id() AND m.status=%L))',
    tbl,'ACTIVE'
  );
  EXECUTE format(
    'CREATE POLICY member_write ON public.%I FOR INSERT WITH CHECK (workspace_id=app.current_workspace_id() AND EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=app.current_workspace_id() AND m.user_id=app.current_actor_id() AND m.status=%L AND m.role IN (%L,%L,%L)))',
    tbl,'ACTIVE','OWNER','ADMIN','EDITOR'
  );
 END LOOP;
END $$;

-- Security-sensitive posts are not mutable via financial role; only line insert/draft -> post.
-- Adding a separate post UPDATE policy will be B1's narrow journal transition.
CREATE POLICY member_update_journals ON journal_entries FOR UPDATE
 USING (workspace_id=app.current_workspace_id() AND status='DRAFT'
  AND EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
   AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')))
 WITH CHECK (workspace_id=app.current_workspace_id());
CREATE POLICY member_update_import_rows ON import_rows FOR UPDATE
 USING (workspace_id=app.current_workspace_id()
  AND EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
   AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')))
 WITH CHECK (workspace_id=app.current_workspace_id());
CREATE POLICY member_update_idempotency ON idempotency_records FOR UPDATE
 USING (workspace_id=app.current_workspace_id()
  AND EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
   AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')))
 WITH CHECK(workspace_id=app.current_workspace_id());

-- New B1 resources inherit the same fail-closed, forced RLS and active membership policies.
DO $$
DECLARE tbl TEXT;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['manual_transactions','reconciliation_matches'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format(
   'CREATE POLICY member_read ON public.%I FOR SELECT USING (workspace_id=app.current_workspace_id() AND EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=app.current_workspace_id() AND m.user_id=app.current_actor_id() AND m.status=%L))',
   tbl,'ACTIVE'
  );
  EXECUTE format(
   'CREATE POLICY member_write ON public.%I FOR INSERT WITH CHECK (workspace_id=app.current_workspace_id() AND EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=app.current_workspace_id() AND m.user_id=app.current_actor_id() AND m.status=%L AND m.role IN (%L,%L,%L)))',
   tbl,'ACTIVE','OWNER','ADMIN','EDITOR'
  );
 END LOOP;
END $$;

-- IDENTITY, SESSION and application data role grants are applied after migrations by
-- provision-app-role.sql, with separate local secrets and DB roles.
