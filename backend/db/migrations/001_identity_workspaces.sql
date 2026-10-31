-- Finance OS B0 (PostgreSQL 16+). Run as restricted migrator, never the API role.
-- No passwords, bank tokens or real financial data belong in the repository.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject TEXT UNIQUE,
  email_normalized TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  preferred_currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK (preferred_currency ~ '^[A-Z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ,
  CONSTRAINT email_normalized_lowercase CHECK (email_normalized = lower(email_normalized))
);
COMMENT ON COLUMN app_users.auth_subject IS 'Future verified identity-provider subject; not a browser-supplied username.';

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('PERSONAL', 'BUSINESS', 'HOUSEHOLD')),
  base_currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK (base_currency ~ '^[A-Z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX workspaces_owner_idx ON workspaces(owner_user_id);

CREATE TABLE workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON workspace_members(user_id, status);

CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL,
  request_key TEXT NOT NULL,
  request_sha256 CHAR(64) NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  result_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace_id, operation, request_key),
  UNIQUE (workspace_id, id),
  CHECK (expires_at > created_at)
);
CREATE INDEX idempotency_expiry_idx ON idempotency_records(expires_at);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  correlation_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE INDEX audit_events_workspace_time_idx ON audit_events(workspace_id, occurred_at DESC, id);

CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','DELIVERED','FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE INDEX outbox_due_idx ON outbox_events(status, available_at) WHERE status IN ('PENDING','FAILED');
