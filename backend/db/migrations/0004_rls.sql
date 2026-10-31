-- B0 0004. Defense in depth: row-level access denies by default if session context is absent.
-- B1 MUST use a dedicated non-owner NO-BYPASSRLS DB role and set context with SET LOCAL
-- after authentication + workspace membership authorization (transaction-scoped only).
-- Administrative migration role is distinct and must never handle user requests.
CREATE FUNCTION finance_session_subject() RETURNS uuid
 LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('finance_os.subject_id', true),'')::uuid
 $$;
CREATE FUNCTION finance_session_workspace() RETURNS uuid
 LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('finance_os.workspace_id', true),'')::uuid
 $$;

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY subjects_self_read ON subjects FOR SELECT
 USING (id = finance_session_subject());

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_member_read ON workspaces FOR SELECT
 USING (id = finance_session_workspace() AND EXISTS (
  SELECT 1 FROM workspace_memberships m WHERE m.workspace_id = workspaces.id
   AND m.subject_id = finance_session_subject() AND m.state='ACTIVE'
 ));

ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY membership_self_read ON workspace_memberships FOR SELECT
 USING (subject_id = finance_session_subject() AND workspace_id = finance_session_workspace() AND state='ACTIVE');

-- All resource tables require BOTH a matching workspace scope and active membership.
-- DO NOT grant INSERT/UPDATE/DELETE to the future read-only app role by default.
DO $$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY[
 'audit_events','idempotency_records','financial_accounts','ledger_accounts',
 'journals','journal_lines','imported_transactions','categories','budgets',
 'budget_allocations','guardrail_rules','purchase_decisions','income_sources',
 'debt_accounts','planning_scenarios'
 ] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tab);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR SELECT USING (workspace_id = finance_session_workspace() AND EXISTS (SELECT 1 FROM workspace_memberships m WHERE m.workspace_id = finance_session_workspace() AND m.subject_id = finance_session_subject() AND m.state = %L))',
    tab || '_member_read', tab, 'ACTIVE'
  );
 END LOOP;
END $$;

-- REVOKE defaults. A dedicated runtime role will be created in a protected
-- provisioning workflow in B1, not here with a hard-coded password.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
