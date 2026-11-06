-- Phase B7: owner-governed preferences, privacy requests and integration-interest records.
-- No live bank integrations, off-platform AI, automatic exports or destructive erasures.
-- Owner decisions are immutable; last snapshot determines the effective setting.
CREATE TABLE b7_settings_snapshots(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 advisor_enabled BOOLEAN NOT NULL DEFAULT false,
 analytics_sharing_enabled BOOLEAN NOT NULL DEFAULT false,
 monthly_review_day INTEGER NOT NULL CHECK(monthly_review_day BETWEEN 1 AND 28),
 period_months INTEGER NOT NULL CHECK(period_months BETWEEN 1 AND 12),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE INDEX b7_settings_workspace ON b7_settings_snapshots(workspace_id,created_at DESC,id DESC);

CREATE TABLE b7_privacy_requests(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 request_kind TEXT NOT NULL CHECK(request_kind IN ('EXPORT_REVIEW','ERASURE_REVIEW','ACCESS_REVIEW')),
 state TEXT NOT NULL DEFAULT 'REQUESTED' CHECK(state='REQUESTED'),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE INDEX b7_privacy_workspace ON b7_privacy_requests(workspace_id,created_at DESC,id DESC);

CREATE TABLE b7_integration_intents(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 provider_kind TEXT NOT NULL CHECK(provider_kind IN ('BANK','MOBILE_MONEY','BROKER','TAX','OTHER')),
 intent_kind TEXT NOT NULL CHECK(intent_kind='REQUEST_INFORMATION'),
 connection_state TEXT NOT NULL DEFAULT 'NOT_CONNECTED' CHECK(connection_state='NOT_CONNECTED'),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE INDEX b7_integrations_workspace ON b7_integration_intents(workspace_id,created_at DESC,id DESC);

CREATE OR REPLACE FUNCTION app.b7_append_only() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $b7immutable$
BEGIN RAISE EXCEPTION 'B7 governance records are append-only' USING ERRCODE='23514'; END $b7immutable$;

DO $b7secure$
DECLARE tbl TEXT;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['b7_settings_snapshots','b7_privacy_requests','b7_integration_intents'] LOOP
  EXECUTE format('CREATE TRIGGER b7_lock BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.b7_append_only()',tbl);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('CREATE POLICY b7_owner_read ON public.%I FOR SELECT USING (
   workspace_id=app.current_workspace_id() AND EXISTS (
    SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status=''ACTIVE'' AND m.role=''OWNER''))',tbl);
  EXECUTE format('CREATE POLICY b7_owner_write ON public.%I FOR INSERT WITH CHECK (
   workspace_id=app.current_workspace_id() AND created_by=app.current_actor_id() AND EXISTS (
    SELECT 1 FROM workspace_members m WHERE m.workspace_id=app.current_workspace_id()
    AND m.user_id=app.current_actor_id() AND m.status=''ACTIVE'' AND m.role=''OWNER''))',tbl);
 END LOOP;
END $b7secure$;
