-- B0 0003. Planning entities keep forecasts separate from authoritative postings.
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 100),
  kind text NOT NULL CHECK (kind IN ('INCOME','EXPENSE','TRANSFER')),
  archived_at timestamptz,
  UNIQUE (workspace_id,id),
  UNIQUE (workspace_id,label,kind)
);

CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (workspace_id,id)
);
CREATE TABLE budget_allocations (
  workspace_id uuid NOT NULL,
  budget_id uuid NOT NULL,
  category_id uuid NOT NULL,
  limit_minor bigint NOT NULL CHECK (limit_minor >= 0),
  PRIMARY KEY (workspace_id,budget_id,category_id),
  FOREIGN KEY (workspace_id,budget_id) REFERENCES budgets(workspace_id,id),
  FOREIGN KEY (workspace_id,category_id) REFERENCES categories(workspace_id,id)
);

CREATE TABLE guardrail_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('AMOUNT','CATEGORY','MERCHANT','LOCATION','TIME','RECURRING')),
  decision text NOT NULL CHECK (decision IN ('WARN','REQUIRE_APPROVAL','DENY')),
  config jsonb NOT NULL CHECK (jsonb_typeof(config) = 'object'),
  enabled boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id)
);

CREATE TABLE purchase_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  merchant text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('ALLOW','WARN','REQUIRE_APPROVAL','DENY')),
  rule_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rule_snapshot) = 'array'),
  reviewed_by uuid REFERENCES subjects(id),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id)
);

CREATE TABLE income_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  expected_amount_minor bigint NOT NULL CHECK (expected_amount_minor >= 0),
  frequency text NOT NULL CHECK (frequency IN ('WEEKLY','MONTHLY','QUARTERLY','ANNUAL','VARIABLE')),
  starts_on date,
  ends_on date,
  is_confirmed boolean NOT NULL DEFAULT false,
  UNIQUE (workspace_id,id),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE debt_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  financial_account_id uuid,
  creditor_label text NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  principal_minor bigint NOT NULL CHECK (principal_minor >= 0),
  nominal_annual_rate_bps integer NOT NULL CHECK (nominal_annual_rate_bps BETWEEN 0 AND 100000),
  installment_minor bigint CHECK (installment_minor >= 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','PAID_OFF','CLOSED')),
  UNIQUE (workspace_id,id),
  FOREIGN KEY (workspace_id,financial_account_id) REFERENCES financial_accounts(workspace_id,id)
);

CREATE TABLE planning_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  scenario_type text NOT NULL CHECK (scenario_type IN ('BASE','OPTIMISTIC','CONSERVATIVE','STRESS','CUSTOM')),
  model_version text NOT NULL,
  assumptions jsonb NOT NULL CHECK (jsonb_typeof(assumptions) = 'object'),
  source_snapshot_at timestamptz NOT NULL,
  results jsonb CHECK (results IS NULL OR jsonb_typeof(results) = 'object'),
  created_by uuid NOT NULL REFERENCES subjects(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id)
);
