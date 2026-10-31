-- B2: category budget lifecycle and human-approved, non-payment guardrails.
-- Forward-only; preserve B0/B1 ledger and authorization authority.
CREATE OR REPLACE FUNCTION app.b2_budget_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.workspace_id<>OLD.workspace_id OR NEW.id<>OLD.id OR
    NEW.name<>OLD.name OR NEW.currency<>OLD.currency OR
    NEW.starts_on<>OLD.starts_on OR NEW.ends_on<>OLD.ends_on OR
    NEW.amount_minor<>OLD.amount_minor OR NEW.created_at<>OLD.created_at THEN
  RAISE EXCEPTION 'Budget financial definition is immutable; create a new version' USING ERRCODE='23514';
 END IF;
 IF NOT ((OLD.status='DRAFT' AND NEW.status='ACTIVE') OR
         (OLD.status='ACTIVE' AND NEW.status='ARCHIVED')) THEN
  RAISE EXCEPTION 'Invalid budget transition' USING ERRCODE='23514';
 END IF;
 IF NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Budget status transitions require version increment' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2_budget_lifecycle BEFORE UPDATE ON budgets
FOR EACH ROW EXECUTE FUNCTION app.b2_budget_lifecycle();

CREATE OR REPLACE FUNCTION app.b2_validate_budget() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 target UUID; wid UUID; rec RECORD; allocation_sum NUMERIC; allocation_count BIGINT; invalid_cat BOOLEAN; conflicting BOOLEAN;
BEGIN
 IF TG_TABLE_NAME='budgets' THEN target:=NEW.id;wid:=NEW.workspace_id;
 ELSE target:=NEW.budget_id;wid:=NEW.workspace_id; END IF;
 SELECT * INTO rec FROM budgets WHERE id=target AND workspace_id=wid;
 IF NOT FOUND OR rec.status<>'ACTIVE' THEN RETURN NULL; END IF;
 SELECT COALESCE(sum(a.limit_minor),0),count(*),
   bool_or(c.kind<>'EXPENSE') INTO allocation_sum,allocation_count,invalid_cat
 FROM budget_allocations a JOIN financial_categories c
 ON c.workspace_id=a.workspace_id AND c.id=a.category_id
 WHERE a.workspace_id=wid AND a.budget_id=target;
 IF allocation_count<1 OR allocation_sum>rec.amount_minor OR coalesce(invalid_cat,false) THEN
  RAISE EXCEPTION 'Active budget needs expense categories with total allocations <= budget amount'
   USING ERRCODE='23514';
 END IF;
 SELECT EXISTS (
  SELECT 1 FROM budgets other JOIN budget_allocations existing_alloc
   ON existing_alloc.workspace_id=other.workspace_id AND existing_alloc.budget_id=other.id
  JOIN budget_allocations current_alloc
   ON current_alloc.workspace_id=existing_alloc.workspace_id AND current_alloc.category_id=existing_alloc.category_id
  WHERE other.workspace_id=wid AND other.id<>target AND other.status='ACTIVE'
   AND other.currency=rec.currency AND other.starts_on<=rec.ends_on
   AND other.ends_on>=rec.starts_on AND current_alloc.budget_id=target
 ) INTO conflicting;
 IF conflicting THEN RAISE EXCEPTION 'Active budgets cannot overlap for the same category' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER b2_budget_validate_status
AFTER INSERT OR UPDATE ON budgets DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app.b2_validate_budget();
CREATE CONSTRAINT TRIGGER b2_budget_validate_allocations
AFTER INSERT OR UPDATE ON budget_allocations DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app.b2_validate_budget();

ALTER TABLE approval_requests ADD COLUMN category_id UUID;
ALTER TABLE approval_requests ADD CONSTRAINT b2_approval_category_workspace_fk
 FOREIGN KEY(workspace_id,category_id) REFERENCES financial_categories(workspace_id,id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION app.b2_approval_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.status<>'PENDING' OR NEW.status NOT IN ('APPROVED','REJECTED') OR
  NEW.workspace_id<>OLD.workspace_id OR NEW.id<>OLD.id OR
  NEW.amount_minor<>OLD.amount_minor OR NEW.currency<>OLD.currency OR
  NEW.reference<>OLD.reference OR NEW.guardrail_id IS DISTINCT FROM OLD.guardrail_id OR
  NEW.requested_by IS DISTINCT FROM OLD.requested_by OR NEW.category_id IS DISTINCT FROM OLD.category_id OR NEW.created_at<>OLD.created_at OR
  NEW.decided_by IS NULL OR NEW.decided_at IS NULL OR NEW.decided_by=OLD.requested_by THEN
  RAISE EXCEPTION 'Approval decisions are one-time, independent and immutable'
   USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2_approval_lifecycle BEFORE UPDATE ON approval_requests
FOR EACH ROW EXECUTE FUNCTION app.b2_approval_lifecycle();

-- Multiple independently approved guardrails may be consumed once each by one immutable expense.
CREATE TABLE spending_approval_consumptions (
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 transaction_id UUID NOT NULL,
 approval_request_id UUID NOT NULL,
 consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,approval_request_id),
 FOREIGN KEY(workspace_id,transaction_id) REFERENCES manual_transactions(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,approval_request_id) REFERENCES approval_requests(workspace_id,id) ON DELETE RESTRICT
);
CREATE INDEX b2_consumptions_transaction_idx ON spending_approval_consumptions(workspace_id,transaction_id);
ALTER TABLE spending_approval_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_approval_consumptions FORCE ROW LEVEL SECURITY;
CREATE POLICY b2_consumptions_read ON spending_approval_consumptions FOR SELECT
 USING(workspace_id=app.current_workspace_id() AND EXISTS(
 SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
 AND m.user_id=app.current_actor_id() AND m.status='ACTIVE'));
CREATE POLICY b2_consumptions_insert ON spending_approval_consumptions FOR INSERT
 WITH CHECK(workspace_id=app.current_workspace_id() AND EXISTS(
 SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
 AND m.user_id=app.current_actor_id() AND m.status='ACTIVE'
 AND m.role IN ('OWNER','ADMIN')));

-- Control policy authors must be workspace owners or administrators, not editors.
DROP POLICY IF EXISTS member_write ON spending_guardrails;
CREATE POLICY b2_guardrail_writer ON spending_guardrails FOR INSERT
 WITH CHECK(workspace_id=app.current_workspace_id() AND EXISTS(
 SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
 AND m.user_id=app.current_actor_id() AND m.status='ACTIVE'
 AND m.role IN ('OWNER','ADMIN')));

-- RLS policies: only active writer membership can transition budgets.
CREATE POLICY b2_budget_status_update ON budgets FOR UPDATE
 USING (workspace_id=app.current_workspace_id() AND EXISTS(
  SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')))
 WITH CHECK(workspace_id=app.current_workspace_id() AND EXISTS(
  SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN')));

-- Only admin or owner can decide another person's request; SQL trigger also enforces independence.
CREATE POLICY b2_approval_decision ON approval_requests FOR UPDATE
 USING (workspace_id=app.current_workspace_id() AND status='PENDING' AND requested_by IS DISTINCT FROM app.current_actor_id()
  AND EXISTS(SELECT 1 FROM workspace_members m
   WHERE m.workspace_id=app.current_workspace_id() AND m.user_id=app.current_actor_id()
    AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN')))
 WITH CHECK(workspace_id=app.current_workspace_id() AND decided_by=app.current_actor_id() AND
  EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN')));

-- Govern disabling a guardrail without mutating its past policy definition.
CREATE OR REPLACE FUNCTION app.b2_guardrail_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $
BEGIN
 IF OLD.active<>true OR NEW.active<>false OR NEW.version<>OLD.version+1 OR
    NEW.workspace_id<>OLD.workspace_id OR NEW.id<>OLD.id OR
    NEW.name<>OLD.name OR NEW.kind<>OLD.kind OR NEW.conditions<>OLD.conditions OR
    NEW.action<>OLD.action OR NEW.created_at<>OLD.created_at THEN
  RAISE EXCEPTION 'Guardrail policy is immutable except one-time deactivation'
   USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $;
CREATE TRIGGER b2_guardrail_lifecycle BEFORE UPDATE ON spending_guardrails
FOR EACH ROW EXECUTE FUNCTION app.b2_guardrail_lifecycle();
CREATE POLICY b2_guardrail_deactivate ON spending_guardrails FOR UPDATE
 USING (workspace_id=app.current_workspace_id() AND active=true AND EXISTS(
  SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
   AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN')))
 WITH CHECK(workspace_id=app.current_workspace_id() AND active=false AND EXISTS(
  SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
   AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN')));

-- Financial role never gains DELETE, ledger bypass, payment or member management privileges.
