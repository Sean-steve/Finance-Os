-- B4: planning-only envelopes, goals and scenarios. No transfer/payment/journal writes.
CREATE TABLE money_buckets(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 150),
 purpose TEXT NOT NULL CHECK(purpose IN ('ESSENTIALS','SAVINGS','EMERGENCY','INVESTMENT','DISCRETIONARY','OTHER')),
 priority INTEGER NOT NULL DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ARCHIVED')),
 archived_at TIMESTAMPTZ,
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 CHECK((status='ACTIVE' AND archived_at IS NULL) OR (status='ARCHIVED' AND archived_at IS NOT NULL))
);
CREATE INDEX b4_buckets_ws ON money_buckets(workspace_id,status,priority);
CREATE TABLE savings_goals(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 150),
 kind TEXT NOT NULL CHECK(kind IN ('SAVINGS','EMERGENCY')),
 target_minor BIGINT NOT NULL CHECK(target_minor BETWEEN 1 AND 1000000000000),
 monthly_essential_minor BIGINT,
 due_on DATE,
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ARCHIVED')),
 archived_at TIMESTAMPTZ,
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 CHECK(monthly_essential_minor IS NULL OR monthly_essential_minor BETWEEN 1 AND 1000000000000),
 CHECK((kind='EMERGENCY' AND monthly_essential_minor IS NOT NULL) OR
       (kind='SAVINGS' AND monthly_essential_minor IS NULL)),
 CHECK((status='ACTIVE' AND archived_at IS NULL) OR (status='ARCHIVED' AND archived_at IS NOT NULL))
);
CREATE INDEX b4_goals_ws ON savings_goals(workspace_id,status,kind);
CREATE TABLE capital_funding_requests(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 target_kind TEXT NOT NULL CHECK(target_kind IN ('BUCKET','GOAL')),
 bucket_id UUID,
 goal_id UUID,
 amount_minor BIGINT NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000),
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 3 AND 500),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 requested_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 decided_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
 decided_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,bucket_id) REFERENCES money_buckets(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,goal_id) REFERENCES savings_goals(workspace_id,id) ON DELETE RESTRICT,
 CHECK((target_kind='BUCKET' AND bucket_id IS NOT NULL AND goal_id IS NULL) OR
       (target_kind='GOAL' AND goal_id IS NOT NULL AND bucket_id IS NULL)),
 CHECK((status='PENDING' AND decided_by IS NULL AND decided_at IS NULL) OR
       (status<>'PENDING' AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE INDEX b4_funding_requests_ws ON capital_funding_requests(workspace_id,status,created_at DESC);
CREATE TABLE capital_allocations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 target_kind TEXT NOT NULL CHECK(target_kind IN ('BUCKET','GOAL')),
 bucket_id UUID,
 goal_id UUID,
 amount_minor BIGINT NOT NULL CHECK(amount_minor BETWEEN -1000000000000 AND 1000000000000 AND amount_minor<>0),
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 note TEXT NOT NULL CHECK(length(trim(note)) BETWEEN 3 AND 500),
 approval_request_id UUID,
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,bucket_id) REFERENCES money_buckets(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,goal_id) REFERENCES savings_goals(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,approval_request_id) REFERENCES capital_funding_requests(workspace_id,id) ON DELETE RESTRICT,
 CHECK((target_kind='BUCKET' AND bucket_id IS NOT NULL AND goal_id IS NULL) OR
       (target_kind='GOAL' AND goal_id IS NOT NULL AND bucket_id IS NULL)),
 CHECK(amount_minor>0 OR approval_request_id IS NULL)
);
CREATE UNIQUE INDEX b4_approval_consumed_once ON capital_allocations(workspace_id,approval_request_id)
 WHERE approval_request_id IS NOT NULL;
CREATE INDEX b4_allocations_ws ON capital_allocations(workspace_id,created_at DESC);

-- Source B0 financial_scenarios carries immutable, deliberately user-supplied assumptions.
ALTER TABLE financial_scenarios
 ADD COLUMN created_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
 ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 ADD CONSTRAINT b4_scenario_version CHECK(model_version='B4_DETERMINISTIC_V1' OR model_version IS NULL);

CREATE OR REPLACE FUNCTION app.b4_append_only() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b4append$
BEGIN RAISE EXCEPTION 'Planning events and scenarios are append-only' USING ERRCODE='23514'; END $b4append$;
CREATE TRIGGER b4_allocation_immutable BEFORE UPDATE OR DELETE ON capital_allocations
 FOR EACH ROW EXECUTE FUNCTION app.b4_append_only();
CREATE TRIGGER b4_scenario_immutable BEFORE UPDATE OR DELETE ON financial_scenarios
 FOR EACH ROW EXECUTE FUNCTION app.b4_append_only();

CREATE OR REPLACE FUNCTION app.b4_archive_only() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b4archive$
BEGIN
 IF OLD.status<>'ACTIVE' OR NEW.status<>'ARCHIVED' OR NEW.archived_at IS NULL OR
    OLD.archived_at IS NOT NULL OR NEW.id<>OLD.id OR NEW.workspace_id<>OLD.workspace_id OR
    NEW.name<>OLD.name OR NEW.currency<>OLD.currency OR NEW.created_at<>OLD.created_at OR
    NEW.created_by<>OLD.created_by THEN
  RAISE EXCEPTION 'Planning record economics are immutable' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='money_buckets' THEN
  IF NEW.purpose<>OLD.purpose OR NEW.priority<>OLD.priority THEN
   RAISE EXCEPTION 'Bucket definition immutable' USING ERRCODE='23514';
  END IF;
 ELSE
  IF NEW.kind<>OLD.kind OR NEW.target_minor<>OLD.target_minor OR
   NEW.monthly_essential_minor IS DISTINCT FROM OLD.monthly_essential_minor OR
   NEW.due_on IS DISTINCT FROM OLD.due_on THEN
   RAISE EXCEPTION 'Goal definition immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_TABLE_NAME='money_buckets' THEN
   IF (SELECT COALESCE(SUM(amount_minor),0) FROM capital_allocations
     WHERE workspace_id=OLD.workspace_id AND bucket_id=OLD.id)<>0 THEN
     RAISE EXCEPTION 'Release virtual bucket allocation before archival' USING ERRCODE='23514';
   END IF;
 ELSE
   IF (SELECT COALESCE(SUM(amount_minor),0) FROM capital_allocations
     WHERE workspace_id=OLD.workspace_id AND goal_id=OLD.id)<>0 THEN
     RAISE EXCEPTION 'Release virtual goal allocation before archival' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $b4archive$;
CREATE TRIGGER b4_bucket_archive BEFORE UPDATE ON money_buckets
 FOR EACH ROW EXECUTE FUNCTION app.b4_archive_only();
CREATE TRIGGER b4_goal_archive BEFORE UPDATE ON savings_goals
 FOR EACH ROW EXECUTE FUNCTION app.b4_archive_only();

CREATE OR REPLACE FUNCTION app.b4_independent_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b4decision$
BEGIN
 IF OLD.status<>'PENDING' OR NEW.status NOT IN ('APPROVED','REJECTED') OR
    NEW.decided_by IS NULL OR NEW.decided_by=OLD.requested_by OR NEW.decided_at IS NULL OR
    OLD.decided_at IS NOT NULL OR NEW.id<>OLD.id OR NEW.workspace_id<>OLD.workspace_id OR
    NEW.target_kind<>OLD.target_kind OR NEW.bucket_id IS DISTINCT FROM OLD.bucket_id OR
    NEW.goal_id IS DISTINCT FROM OLD.goal_id OR NEW.amount_minor<>OLD.amount_minor OR
    NEW.currency<>OLD.currency OR NEW.rationale<>OLD.rationale OR
    NEW.requested_by<>OLD.requested_by OR NEW.created_at<>OLD.created_at THEN
  RAISE EXCEPTION 'Funding decision must be a one-time independent approval' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $b4decision$;
CREATE TRIGGER b4_funding_decision BEFORE UPDATE ON capital_funding_requests
 FOR EACH ROW EXECUTE FUNCTION app.b4_independent_decision();

-- Each allocation is a planning-only reserved share of POSTED MANUAL KES liquidity,
-- not bank-segregated money. Validate within the SQL transaction after INSERT.
-- Serialise allocation inserts to the same workspace before calculating reserves.
CREATE OR REPLACE FUNCTION app.b4_assert_allocation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b4alloc$
DECLARE
 target_total NUMERIC; all_total NUMERIC; manual_balance NUMERIC; ceiling NUMERIC;
 target_state TEXT; request_rec RECORD;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('finance-b4:'||NEW.workspace_id::text));
 SELECT COALESCE(SUM(amount_minor),0) INTO target_total FROM capital_allocations
  WHERE workspace_id=NEW.workspace_id AND target_kind=NEW.target_kind
   AND ((NEW.target_kind='BUCKET' AND bucket_id=NEW.bucket_id) OR
        (NEW.target_kind='GOAL' AND goal_id=NEW.goal_id));
 IF target_total<0 THEN RAISE EXCEPTION 'Virtual allocation cannot become negative' USING ERRCODE='23514'; END IF;
 IF NEW.target_kind='BUCKET' THEN
  SELECT status INTO target_state FROM money_buckets
   WHERE workspace_id=NEW.workspace_id AND id=NEW.bucket_id;
 ELSE
  SELECT status,target_minor INTO target_state,ceiling FROM savings_goals
   WHERE workspace_id=NEW.workspace_id AND id=NEW.goal_id;
  IF target_total>ceiling THEN
   RAISE EXCEPTION 'Goal funding cannot exceed target' USING ERRCODE='23514';
  END IF;
 END IF;
 IF target_state<>'ACTIVE' THEN RAISE EXCEPTION 'Target is not active' USING ERRCODE='23514'; END IF;
 SELECT COALESCE(SUM(amount_minor),0) INTO all_total
 FROM capital_allocations WHERE workspace_id=NEW.workspace_id;
 SELECT COALESCE(SUM(CASE WHEN j.status='POSTED' AND j.effective_on<=CURRENT_DATE
       THEN l.debit_minor-l.credit_minor ELSE 0 END),0) INTO manual_balance
 FROM financial_accounts a JOIN ledger_accounts la ON la.workspace_id=a.workspace_id
  AND la.financial_account_id=a.id AND la.class='ASSET' AND la.currency='KES'
 JOIN journal_lines l ON l.workspace_id=la.workspace_id AND l.ledger_account_id=la.id
 JOIN journal_entries j ON j.workspace_id=l.workspace_id AND j.id=l.entry_id
 WHERE a.workspace_id=NEW.workspace_id AND a.currency='KES'
  AND a.archived_at IS NULL AND a.provider_status='MANUAL'
  AND a.kind IN ('CASH','BANK','MOBILE_MONEY');
 IF all_total<0 OR (NEW.amount_minor>0 AND all_total>GREATEST(manual_balance,0)) THEN
  RAISE EXCEPTION 'Planning allocations exceed posted manual funds' USING ERRCODE='23514';
 END IF;
 IF NEW.approval_request_id IS NOT NULL THEN
  SELECT * INTO request_rec FROM capital_funding_requests
  WHERE workspace_id=NEW.workspace_id AND id=NEW.approval_request_id;
  IF NOT FOUND OR request_rec.status<>'APPROVED' OR
     request_rec.requested_by<>NEW.created_by OR request_rec.amount_minor<>NEW.amount_minor OR
     request_rec.target_kind<>NEW.target_kind OR
     request_rec.bucket_id IS DISTINCT FROM NEW.bucket_id OR
     request_rec.goal_id IS DISTINCT FROM NEW.goal_id THEN
   RAISE EXCEPTION 'Independent funding approval does not match allocation' USING ERRCODE='23514';
  END IF;
 ELSIF NEW.amount_minor>0 AND target_total>10000000 THEN
  RAISE EXCEPTION 'Target funding above KES 100,000 needs independent approval' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $b4alloc$;
CREATE CONSTRAINT TRIGGER b4_allocation_verify AFTER INSERT ON capital_allocations
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.b4_assert_allocation();

-- Explicit actor-scoped RLS. All B4 tables default-deny outside verified SET LOCAL.
DO $b4policies$
DECLARE tbl TEXT;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['money_buckets','savings_goals','capital_allocations'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('CREATE POLICY b4_read ON %I FOR SELECT USING
    (workspace_id=app.current_workspace_id() AND EXISTS(SELECT 1 FROM workspace_members m
    WHERE m.workspace_id=app.current_workspace_id() AND m.user_id=app.current_actor_id()
     AND m.status=''ACTIVE''))',tbl);
  EXECUTE format('CREATE POLICY b4_write ON %I FOR INSERT WITH CHECK
    (workspace_id=app.current_workspace_id() AND created_by=app.current_actor_id() AND
    EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
     AND m.user_id=app.current_actor_id() AND m.status=''ACTIVE'' AND
      m.role IN (''OWNER'',''ADMIN'',''EDITOR'')))',tbl);
 END LOOP;
END $b4policies$;
-- Funding requests use requested_by (not created_by) for INSERT identity.
ALTER TABLE capital_funding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_funding_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY b4_request_read ON capital_funding_requests FOR SELECT USING
 (workspace_id=app.current_workspace_id() AND EXISTS(SELECT 1 FROM workspace_members m
 WHERE m.workspace_id=app.current_workspace_id() AND m.user_id=app.current_actor_id() AND m.status='ACTIVE'));
CREATE POLICY b4_request_create ON capital_funding_requests FOR INSERT WITH CHECK
 (workspace_id=app.current_workspace_id() AND requested_by=app.current_actor_id() AND EXISTS(
 SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
 AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')));
CREATE POLICY b4_request_decision ON capital_funding_requests FOR UPDATE USING
 (workspace_id=app.current_workspace_id() AND status='PENDING'
  AND requested_by<>app.current_actor_id() AND EXISTS(
 SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
 AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN')))
 WITH CHECK(workspace_id=app.current_workspace_id() AND decided_by=app.current_actor_id());
CREATE POLICY b4_bucket_archive ON money_buckets FOR UPDATE USING
 (workspace_id=app.current_workspace_id() AND status='ACTIVE' AND EXISTS(
 SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
 AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')))
 WITH CHECK(workspace_id=app.current_workspace_id() AND status='ARCHIVED');
CREATE POLICY b4_goal_archive ON savings_goals FOR UPDATE USING
 (workspace_id=app.current_workspace_id() AND status='ACTIVE' AND EXISTS(
 SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
 AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')))
 WITH CHECK(workspace_id=app.current_workspace_id() AND status='ARCHIVED');
CREATE POLICY b4_scenario_create ON financial_scenarios FOR INSERT WITH CHECK
 (workspace_id=app.current_workspace_id() AND created_by=app.current_actor_id() AND EXISTS(
 SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
 AND m.user_id=app.current_actor_id() AND m.status='ACTIVE' AND m.role IN ('OWNER','ADMIN','EDITOR')));
