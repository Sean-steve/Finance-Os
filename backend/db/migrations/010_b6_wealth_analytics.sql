-- Finance OS B6: estimated wealth records only; no provider positions or trading.
-- Numeric amounts are integer KES minor units. Current values are user-reported, not verified.
CREATE TABLE b6_assets(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 150),
 asset_kind TEXT NOT NULL CHECK(asset_kind IN ('PROPERTY','LAND','VEHICLE','BUSINESS','EQUIPMENT','OTHER')),
 initial_value_minor BIGINT NOT NULL CHECK(initial_value_minor BETWEEN 0 AND 1000000000000),
 acquired_on DATE,
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 evidence TEXT NOT NULL DEFAULT 'USER_ESTIMATE' CHECK(evidence='USER_ESTIMATE'),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE INDEX b6_assets_ws ON b6_assets(workspace_id,asset_kind,created_at DESC);
CREATE TABLE b6_investments(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 150),
 investment_kind TEXT NOT NULL CHECK(investment_kind IN ('EQUITY','BOND','FUND','SACCO','OTHER')),
 quantity_micros BIGINT NOT NULL CHECK(quantity_micros BETWEEN 1 AND 1000000000000),
 cost_basis_minor BIGINT NOT NULL CHECK(cost_basis_minor BETWEEN 0 AND 1000000000000),
 initial_value_minor BIGINT NOT NULL CHECK(initial_value_minor BETWEEN 0 AND 1000000000000),
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 evidence TEXT NOT NULL DEFAULT 'USER_ESTIMATE' CHECK(evidence='USER_ESTIMATE'),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE INDEX b6_investments_ws ON b6_investments(workspace_id,investment_kind,created_at DESC);
-- These are non-loan liabilities. Loan debt must be recorded in B5 and never duplicated here.
CREATE TABLE b6_liabilities(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 150),
 liability_kind TEXT NOT NULL CHECK(liability_kind IN ('UNPAID_OBLIGATION','OTHER')),
 initial_value_minor BIGINT NOT NULL CHECK(initial_value_minor BETWEEN 1 AND 1000000000000),
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 evidence TEXT NOT NULL DEFAULT 'USER_ESTIMATE' CHECK(evidence='USER_ESTIMATE'),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE INDEX b6_liabilities_ws ON b6_liabilities(workspace_id,created_at DESC);
CREATE TABLE b6_valuations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 target_kind TEXT NOT NULL CHECK(target_kind IN ('ASSET','INVESTMENT','LIABILITY')),
 asset_id UUID,
 investment_id UUID,
 liability_id UUID,
 value_minor BIGINT NOT NULL CHECK(value_minor BETWEEN 0 AND 1000000000000),
 currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(currency='KES'),
 note TEXT NOT NULL CHECK(length(trim(note)) BETWEEN 3 AND 500),
 evidence TEXT NOT NULL DEFAULT 'USER_ESTIMATE' CHECK(evidence='USER_ESTIMATE'),
 recorded_on DATE NOT NULL,
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,asset_id) REFERENCES b6_assets(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,investment_id) REFERENCES b6_investments(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,liability_id) REFERENCES b6_liabilities(workspace_id,id) ON DELETE RESTRICT,
 CHECK ((target_kind='ASSET' AND asset_id IS NOT NULL AND investment_id IS NULL AND liability_id IS NULL)
 OR (target_kind='INVESTMENT' AND asset_id IS NULL AND investment_id IS NOT NULL AND liability_id IS NULL)
 OR (target_kind='LIABILITY' AND asset_id IS NULL AND investment_id IS NULL AND liability_id IS NOT NULL))
);
CREATE INDEX b6_valuations_assets ON b6_valuations(workspace_id,asset_id,recorded_on DESC,created_at DESC,id DESC);
CREATE INDEX b6_valuations_investments ON b6_valuations(workspace_id,investment_id,recorded_on DESC,created_at DESC,id DESC);
CREATE INDEX b6_valuations_liabilities ON b6_valuations(workspace_id,liability_id,recorded_on DESC,created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION app.b6_immutable() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b6immutable$
BEGIN RAISE EXCEPTION 'B6 wealth records are append-only' USING ERRCODE='23514'; END $b6immutable$;
DO $b6triggers$
DECLARE tbl TEXT;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['b6_assets','b6_investments','b6_liabilities','b6_valuations'] LOOP
  EXECUTE format('CREATE TRIGGER b6_append_only BEFORE UPDATE OR DELETE ON %I
    FOR EACH ROW EXECUTE FUNCTION app.b6_immutable()',tbl);
 END LOOP;
END $b6triggers$;
-- Effective valuation date cannot be after the record creation or in the future.
CREATE OR REPLACE FUNCTION app.b6_valuation_date() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b6date$
BEGIN
 IF NEW.recorded_on>CURRENT_DATE THEN
  RAISE EXCEPTION 'Future or unobserved valuation is not allowed' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $b6date$;
CREATE TRIGGER b6_val_date BEFORE INSERT ON b6_valuations
 FOR EACH ROW EXECUTE FUNCTION app.b6_valuation_date();
-- Membership enforced in the DB, not just in Fastify; no UPDATE or DELETE grants.
DO $b6rls$
DECLARE tbl TEXT;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['b6_assets','b6_investments','b6_liabilities','b6_valuations'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('CREATE POLICY b6_select ON %I FOR SELECT USING (
   workspace_id=app.current_workspace_id() AND EXISTS(
    SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
     AND m.user_id=app.current_actor_id() AND m.status=''ACTIVE''))',tbl);
  EXECUTE format('CREATE POLICY b6_insert ON %I FOR INSERT WITH CHECK (
   workspace_id=app.current_workspace_id() AND created_by=app.current_actor_id() AND EXISTS(
    SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
     AND m.user_id=app.current_actor_id() AND m.status=''ACTIVE''
     AND m.role IN (''OWNER'',''ADMIN'',''EDITOR'')))',tbl);
 END LOOP;
END $b6rls$;
