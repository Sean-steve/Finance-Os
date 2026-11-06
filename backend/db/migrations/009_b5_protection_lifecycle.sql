-- B5: append-only, user-reported financial planning records.
-- No bank payments, tax filings, provider verification, or legal instruments.
ALTER TABLE debts
  ADD COLUMN created_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
  ADD COLUMN record_status TEXT NOT NULL DEFAULT 'OPEN' CHECK(record_status='OPEN');
CREATE INDEX b5_debts_ws ON debts(workspace_id,created_at DESC);
DROP POLICY IF EXISTS workspace_scope ON debts;

CREATE TABLE b5_debt_payments(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 debt_id UUID NOT NULL,
 manual_transaction_id UUID NOT NULL,
 principal_minor BIGINT NOT NULL CHECK(principal_minor BETWEEN 1 AND 1000000000000),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 UNIQUE(workspace_id,manual_transaction_id),
 FOREIGN KEY(workspace_id,debt_id) REFERENCES debts(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,manual_transaction_id) REFERENCES manual_transactions(workspace_id,id) ON DELETE RESTRICT
);
CREATE INDEX b5_debt_payments_ws ON b5_debt_payments(workspace_id,debt_id);

CREATE TABLE b5_tax_obligations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 3 AND 150),
 tax_kind TEXT NOT NULL CHECK(tax_kind IN ('INCOME_TAX','VAT','TURNOVER_TAX','OTHER')),
 tax_year INTEGER NOT NULL CHECK(tax_year BETWEEN 2000 AND 2100),
 estimated_minor BIGINT NOT NULL CHECK(estimated_minor BETWEEN 0 AND 1000000000000),
 due_on DATE NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 evidence TEXT NOT NULL DEFAULT 'USER_ESTIMATE' CHECK(evidence='USER_ESTIMATE'),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE INDEX b5_tax_ws ON b5_tax_obligations(workspace_id,due_on,id);

CREATE TABLE b5_tax_payments(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 obligation_id UUID NOT NULL,
 manual_transaction_id UUID NOT NULL,
 amount_minor BIGINT NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 UNIQUE(workspace_id,manual_transaction_id),
 FOREIGN KEY(workspace_id,obligation_id) REFERENCES b5_tax_obligations(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,manual_transaction_id) REFERENCES manual_transactions(workspace_id,id) ON DELETE RESTRICT
);
CREATE INDEX b5_tax_payments_ws ON b5_tax_payments(workspace_id,obligation_id);

CREATE TABLE b5_insurance_policies(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 150),
 insurer_label TEXT NOT NULL CHECK(length(trim(insurer_label)) BETWEEN 2 AND 150),
 coverage_kind TEXT NOT NULL CHECK(coverage_kind IN ('HEALTH','LIFE','MOTOR','PROPERTY','DISABILITY','OTHER')),
 start_on DATE NOT NULL,
 expires_on DATE NOT NULL,
 premium_minor BIGINT NOT NULL CHECK(premium_minor BETWEEN 0 AND 1000000000000),
 coverage_limit_minor BIGINT NOT NULL CHECK(coverage_limit_minor BETWEEN 0 AND 1000000000000),
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 evidence TEXT NOT NULL DEFAULT 'USER_REPORTED' CHECK(evidence='USER_REPORTED'),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 CHECK(expires_on>=start_on)
);
CREATE INDEX b5_insurance_ws ON b5_insurance_policies(workspace_id,expires_on,id);

CREATE TABLE b5_retirement_scenarios(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 150),
 current_minor BIGINT NOT NULL CHECK(current_minor BETWEEN 0 AND 1000000000000),
 monthly_contribution_minor BIGINT NOT NULL CHECK(monthly_contribution_minor BETWEEN 0 AND 1000000000000),
 target_minor BIGINT NOT NULL CHECK(target_minor BETWEEN 1 AND 1000000000000),
 horizon_months INTEGER NOT NULL CHECK(horizon_months BETWEEN 1 AND 600),
 annual_return_bps INTEGER NOT NULL CHECK(annual_return_bps BETWEEN 0 AND 1500),
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 model_version TEXT NOT NULL DEFAULT 'B5_NOMINAL_ILLUSTRATION_V1' CHECK(model_version='B5_NOMINAL_ILLUSTRATION_V1'),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE INDEX b5_retirement_ws ON b5_retirement_scenarios(workspace_id,created_at DESC);

-- Private owner-only high-level estate readiness snapshots. No names, wills, beneficiary IDs or documents.
CREATE TABLE b5_estate_checklists(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 will_prepared BOOLEAN NOT NULL,
 beneficiaries_reviewed BOOLEAN NOT NULL,
 executor_nominated BOOLEAN NOT NULL,
 dependants_considered BOOLEAN NOT NULL,
 records_secured BOOLEAN NOT NULL,
 reviewed_on DATE NOT NULL,
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE INDEX b5_estate_ws ON b5_estate_checklists(workspace_id,created_at DESC);

CREATE OR REPLACE FUNCTION app.b5_append_only() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b5immutable$
BEGIN RAISE EXCEPTION 'B5 records are append-only' USING ERRCODE='23514'; END $b5immutable$;
DO $b5triggers$
DECLARE tbl TEXT;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['debts','b5_debt_payments','b5_tax_obligations','b5_tax_payments',
  'b5_insurance_policies','b5_retirement_scenarios','b5_estate_checklists'] LOOP
  EXECUTE format('CREATE TRIGGER b5_immutable BEFORE UPDATE OR DELETE ON %I
    FOR EACH ROW EXECUTE FUNCTION app.b5_append_only()',tbl);
 END LOOP;
END $b5triggers$;

-- Validate payment allocations at commit, including cross-domain double assignment and eventual reversal.
-- A manual expense only proves a POSTED manual ledger expense, not lender/KRA receipt.
CREATE OR REPLACE FUNCTION app.b5_validate_payment() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b5payment$
DECLARE tx RECORD; allocated NUMERIC; maximum NUMERIC; applied NUMERIC; target UUID;
BEGIN
 SELECT kind,amount_minor,reverses_transaction_id INTO tx FROM manual_transactions
 WHERE workspace_id=NEW.workspace_id AND id=NEW.manual_transaction_id;
 IF NOT FOUND OR tx.kind<>'EXPENSE' OR tx.amount_minor>=0 OR tx.reverses_transaction_id IS NOT NULL
    OR EXISTS(SELECT 1 FROM manual_transactions reversal
      WHERE reversal.workspace_id=NEW.workspace_id AND reversal.reverses_transaction_id=NEW.manual_transaction_id) THEN
  RAISE EXCEPTION 'Only unreversed POSTED manual expense may evidence a B5 allocation' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='b5_debt_payments' THEN
  applied=NEW.principal_minor; target=NEW.debt_id;
  SELECT outstanding_minor INTO maximum FROM debts
    WHERE workspace_id=NEW.workspace_id AND id=target;
  SELECT COALESCE(SUM(p.principal_minor),0) INTO allocated FROM b5_debt_payments p
    WHERE p.workspace_id=NEW.workspace_id AND p.debt_id=target AND p.id<>NEW.id
    AND NOT EXISTS(SELECT 1 FROM manual_transactions r
      WHERE r.workspace_id=p.workspace_id AND r.reverses_transaction_id=p.manual_transaction_id);
  IF EXISTS(SELECT 1 FROM b5_tax_payments p
       WHERE p.workspace_id=NEW.workspace_id AND p.manual_transaction_id=NEW.manual_transaction_id) THEN
   RAISE EXCEPTION 'Expense already allocated to tax' USING ERRCODE='23514';
  END IF;
 ELSE
  applied=NEW.amount_minor; target=NEW.obligation_id;
  SELECT estimated_minor INTO maximum FROM b5_tax_obligations
    WHERE workspace_id=NEW.workspace_id AND id=target;
  SELECT COALESCE(SUM(p.amount_minor),0) INTO allocated FROM b5_tax_payments p
    WHERE p.workspace_id=NEW.workspace_id AND p.obligation_id=target AND p.id<>NEW.id
    AND NOT EXISTS(SELECT 1 FROM manual_transactions r
      WHERE r.workspace_id=p.workspace_id AND r.reverses_transaction_id=p.manual_transaction_id);
  IF EXISTS(SELECT 1 FROM b5_debt_payments p
       WHERE p.workspace_id=NEW.workspace_id AND p.manual_transaction_id=NEW.manual_transaction_id) THEN
   RAISE EXCEPTION 'Expense already allocated to debt' USING ERRCODE='23514';
  END IF;
 END IF;
 IF maximum IS NULL OR applied>abs(tx.amount_minor) OR allocated+applied>maximum THEN
  RAISE EXCEPTION 'B5 allocated amount exceeds expense or initial obligation' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $b5payment$;
CREATE CONSTRAINT TRIGGER b5_debt_payment_verify AFTER INSERT ON b5_debt_payments
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.b5_validate_payment();
CREATE CONSTRAINT TRIGGER b5_tax_payment_verify AFTER INSERT ON b5_tax_payments
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.b5_validate_payment();

-- Membership-enforced database RLS; no direct update/delete policies.
DO $b5rls$
DECLARE tbl TEXT;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['debts','b5_debt_payments','b5_tax_obligations','b5_tax_payments',
  'b5_insurance_policies','b5_retirement_scenarios'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('CREATE POLICY b5_select ON %I FOR SELECT USING (
    workspace_id=app.current_workspace_id() AND EXISTS(SELECT 1 FROM workspace_members m
    WHERE m.workspace_id=app.current_workspace_id() AND m.user_id=app.current_actor_id()
    AND m.status=''ACTIVE''))',tbl);
  EXECUTE format('CREATE POLICY b5_insert ON %I FOR INSERT WITH CHECK (
    workspace_id=app.current_workspace_id() AND created_by=app.current_actor_id()
    AND EXISTS(SELECT 1 FROM workspace_members m
    WHERE m.workspace_id=app.current_workspace_id() AND m.user_id=app.current_actor_id()
    AND m.status=''ACTIVE'' AND m.role IN (''OWNER'',''ADMIN'',''EDITOR'')))',tbl);
 END LOOP;
END $b5rls$;
ALTER TABLE b5_estate_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE b5_estate_checklists FORCE ROW LEVEL SECURITY;
CREATE POLICY b5_estate_owner_select ON b5_estate_checklists FOR SELECT USING (
 workspace_id=app.current_workspace_id() AND EXISTS(SELECT 1 FROM workspaces w
 WHERE w.id=workspace_id AND w.owner_user_id=app.current_actor_id()) AND EXISTS(
 SELECT 1 FROM workspace_members m WHERE m.workspace_id=workspace_id
 AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role='OWNER'));
CREATE POLICY b5_estate_owner_insert ON b5_estate_checklists FOR INSERT WITH CHECK (
 workspace_id=app.current_workspace_id() AND created_by=app.current_actor_id()
 AND EXISTS(SELECT 1 FROM workspaces w WHERE w.id=workspace_id AND w.owner_user_id=app.current_actor_id())
 AND EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=workspace_id
 AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role='OWNER'));
