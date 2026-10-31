-- B3 forward-only: honest scheduled income, manual bill obligations and journal-linked settlement evidence.
-- Never infer provider payment confirmation or mutate POSTED B1 journals.
ALTER TABLE income_sources
 ADD COLUMN first_expected_on DATE NOT NULL DEFAULT CURRENT_DATE,
 ADD COLUMN last_expected_on DATE,
 ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 ADD COLUMN disabled_at TIMESTAMPTZ,
 ADD COLUMN created_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
 ADD CONSTRAINT b3_income_schedule CHECK(last_expected_on IS NULL OR last_expected_on>=first_expected_on),
 ADD CONSTRAINT b3_income_disabled CHECK ((enabled AND disabled_at IS NULL) OR (NOT enabled AND disabled_at IS NOT NULL));

CREATE OR REPLACE FUNCTION app.b3_income_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b3income$
BEGIN
 IF OLD.enabled IS DISTINCT FROM true OR NEW.enabled IS DISTINCT FROM false OR
    NEW.disabled_at IS NULL OR OLD.disabled_at IS NOT NULL OR NEW.version<>OLD.version+1 OR
    NEW.id<>OLD.id OR NEW.workspace_id<>OLD.workspace_id OR NEW.name<>OLD.name OR
    NEW.category_id IS DISTINCT FROM OLD.category_id OR NEW.cadence<>OLD.cadence OR
    NEW.expected_minor<>OLD.expected_minor OR NEW.currency<>OLD.currency OR
    NEW.evidence<>OLD.evidence OR NEW.first_expected_on<>OLD.first_expected_on OR
    NEW.last_expected_on IS DISTINCT FROM OLD.last_expected_on OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at<>OLD.created_at THEN
  RAISE EXCEPTION 'Income forecast template is immutable except one-time disable'
   USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $b3income$;
CREATE TRIGGER b3_income_lifecycle BEFORE UPDATE ON income_sources
 FOR EACH ROW EXECUTE FUNCTION app.b3_income_lifecycle();

CREATE TABLE bills (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 150),
 payee_label TEXT CHECK(payee_label IS NULL OR length(trim(payee_label)) BETWEEN 2 AND 150),
 category_id UUID NOT NULL,
 amount_minor BIGINT NOT NULL CHECK(amount_minor>0 AND amount_minor<=1000000000000),
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 cadence TEXT NOT NULL CHECK(cadence IN ('ONCE','WEEKLY','MONTHLY','QUARTERLY','YEARLY')),
 first_due_on DATE NOT NULL,
 last_due_on DATE,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','CANCELLED')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 cancelled_at TIMESTAMPTZ,
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,category_id) REFERENCES financial_categories(workspace_id,id) ON DELETE RESTRICT,
 CHECK(last_due_on IS NULL OR last_due_on>=first_due_on),
 CHECK((status='ACTIVE' AND cancelled_at IS NULL) OR (status='CANCELLED' AND cancelled_at IS NOT NULL))
);
CREATE INDEX b3_bills_workspace_idx ON bills(workspace_id,status,first_due_on);

CREATE OR REPLACE FUNCTION app.b3_bill_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b3bill$
BEGIN
 IF OLD.status<>'ACTIVE' OR NEW.status<>'CANCELLED' OR
    NEW.cancelled_at IS NULL OR OLD.cancelled_at IS NOT NULL OR NEW.version<>OLD.version+1 OR
    NEW.id<>OLD.id OR NEW.workspace_id<>OLD.workspace_id OR NEW.name<>OLD.name OR
    NEW.payee_label IS DISTINCT FROM OLD.payee_label OR NEW.category_id<>OLD.category_id OR
    NEW.amount_minor<>OLD.amount_minor OR NEW.currency<>OLD.currency OR
    NEW.cadence<>OLD.cadence OR NEW.first_due_on<>OLD.first_due_on OR
    NEW.last_due_on IS DISTINCT FROM OLD.last_due_on OR NEW.created_at<>OLD.created_at OR
    NEW.created_by<>OLD.created_by THEN
  RAISE EXCEPTION 'Bill terms are immutable except one-time cancellation'
   USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $b3bill$;
CREATE TRIGGER b3_bill_lifecycle BEFORE UPDATE ON bills
 FOR EACH ROW EXECUTE FUNCTION app.b3_bill_lifecycle();

-- A bill settlement is merely a user-linked, manually POSTED expense; not bank proof.
-- One expense may settle only one obligation; reverted settlements remain in the historical record.
CREATE TABLE bill_settlements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 bill_id UUID NOT NULL,
 due_on DATE NOT NULL,
 manual_transaction_id UUID NOT NULL,
 status TEXT NOT NULL DEFAULT 'RECORDED' CHECK(status IN ('RECORDED','REVERSED')),
 reversed_at TIMESTAMPTZ,
 linked_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 UNIQUE(workspace_id,manual_transaction_id),
 FOREIGN KEY(workspace_id,bill_id) REFERENCES bills(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,manual_transaction_id) REFERENCES manual_transactions(workspace_id,id) ON DELETE RESTRICT,
 CHECK((status='RECORDED' AND reversed_at IS NULL) OR (status='REVERSED' AND reversed_at IS NOT NULL))
);
-- Reversed expense linkage frees the same due occurrence for a replacement POSTED expense.
CREATE UNIQUE INDEX b3_one_active_bill_settlement
 ON bill_settlements(workspace_id,bill_id,due_on) WHERE status='RECORDED';
CREATE INDEX b3_bill_settlements_lookup ON bill_settlements(workspace_id,bill_id,due_on);

CREATE OR REPLACE FUNCTION app.b3_settlement_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b3settlement$
BEGIN
 IF OLD.status<>'RECORDED' OR NEW.status<>'REVERSED' OR
    OLD.reversed_at IS NOT NULL OR NEW.reversed_at IS NULL OR
    OLD.id<>NEW.id OR OLD.workspace_id<>NEW.workspace_id OR OLD.bill_id<>NEW.bill_id OR
    OLD.due_on<>NEW.due_on OR OLD.manual_transaction_id<>NEW.manual_transaction_id OR
    OLD.linked_at<>NEW.linked_at OR OLD.linked_by<>NEW.linked_by OR
    NOT EXISTS(SELECT 1 FROM manual_transactions t
     JOIN journal_entries j ON j.workspace_id=t.workspace_id AND j.id=t.entry_id AND j.status='POSTED'
     WHERE t.workspace_id=OLD.workspace_id AND t.kind='REVERSAL'
      AND t.reverses_transaction_id=OLD.manual_transaction_id) THEN
   RAISE EXCEPTION 'Settlement can only be reversed after authoritative posted journal reversal'
     USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $b3settlement$;
CREATE TRIGGER b3_settlement_lifecycle BEFORE UPDATE ON bill_settlements
 FOR EACH ROW EXECUTE FUNCTION app.b3_settlement_lifecycle();

-- New tables enforce tenant membership at the database perimeter, not just SET LOCAL.
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills FORCE ROW LEVEL SECURITY;
CREATE POLICY b3_bills_select ON bills FOR SELECT
 USING(workspace_id=app.current_workspace_id() AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE'));
CREATE POLICY b3_bills_insert ON bills FOR INSERT
 WITH CHECK(workspace_id=app.current_workspace_id() AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')));
CREATE POLICY b3_bills_cancel ON bills FOR UPDATE
 USING(workspace_id=app.current_workspace_id() AND status='ACTIVE' AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')))
 WITH CHECK(workspace_id=app.current_workspace_id() AND status='CANCELLED' AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')));

ALTER TABLE bill_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_settlements FORCE ROW LEVEL SECURITY;
CREATE POLICY b3_settlement_select ON bill_settlements FOR SELECT
 USING(workspace_id=app.current_workspace_id() AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE'));
CREATE POLICY b3_settlement_insert ON bill_settlements FOR INSERT
 WITH CHECK(workspace_id=app.current_workspace_id() AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')));
CREATE POLICY b3_settlement_reversal ON bill_settlements FOR UPDATE
 USING(workspace_id=app.current_workspace_id() AND status='RECORDED' AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')))
 WITH CHECK(workspace_id=app.current_workspace_id() AND status='REVERSED' AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')));

-- Existing income_sources were created with permissive session-only workspace_scope in B0.
-- Replace it with the membership-enforcing policy family for the new B3 capabilities.
DROP POLICY IF EXISTS workspace_scope ON income_sources;
CREATE POLICY b3_income_select ON income_sources FOR SELECT
 USING(workspace_id=app.current_workspace_id() AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE'));
CREATE POLICY b3_income_insert ON income_sources FOR INSERT
 WITH CHECK(workspace_id=app.current_workspace_id() AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')));
CREATE POLICY b3_income_disable ON income_sources FOR UPDATE
 USING(workspace_id=app.current_workspace_id() AND enabled=true AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')))
 WITH CHECK(workspace_id=app.current_workspace_id() AND enabled=false AND EXISTS(
   SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')));
