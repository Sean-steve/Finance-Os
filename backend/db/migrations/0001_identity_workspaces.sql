-- B0 0001. Identity and workspace foundations. PostgreSQL 16+.
-- Database server timezone is UTC; user-facing dates use workspace time zone.
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_identity_subject text UNIQUE,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  kind text NOT NULL CHECK (kind IN ('PERSONAL','HOUSEHOLD','BUSINESS')),
  base_currency char(3) NOT NULL DEFAULT 'KES' CHECK (base_currency ~ '^[A-Z]{3}$'),
  time_zone text NOT NULL DEFAULT 'Africa/Nairobi',
  created_by uuid NOT NULL REFERENCES subjects(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id),
  role text NOT NULL CHECK (role IN ('OWNER','ADMIN','EDITOR','VIEWER')),
  state text NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('INVITED','ACTIVE','REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (workspace_id, subject_id)
);
CREATE INDEX idx_workspace_memberships_subject ON workspace_memberships(subject_id, workspace_id)
 WHERE state = 'ACTIVE';

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  actor_subject_id uuid REFERENCES subjects(id),
  action text NOT NULL CHECK (length(action) BETWEEN 3 AND 100),
  entity_type text NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 80),
  entity_id uuid,
  request_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX idx_audit_workspace_time ON audit_events(workspace_id, occurred_at DESC);

CREATE TABLE idempotency_records (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 10 AND 160),
  request_fingerprint char(64) NOT NULL,
  http_status integer NOT NULL CHECK (http_status BETWEEN 200 AND 599),
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key),
  CHECK (expires_at > created_at)
);
CREATE INDEX idx_idempotency_expiry ON idempotency_records(expires_at);
