-- B0 data contract tables. No real provider integrations or live money operations.
-- Amounts are signed/unsigned BIGINT minor units (KES cents), never floating point.
CREATE TABLE financial_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 display_name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('CASH','BANK','MOBILE_MONEY','CARD','SACCO','INVESTMENT','OTHER')),
 currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 provider_status TEXT NOT NULL DEFAULT 'MANUAL' CHECK(provider_status IN ('MANUAL','PENDING','VERIFIED','DISCONNECTED')),
 external_ref_digest TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 archived_at TIMESTAMPTZ,
 UNIQUE(workspace_id,id)
);
CREATE INDEX financial_accounts_ws_idx ON financial_accounts(workspace_id, archived_at);

CREATE TABLE financial_categories (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('INCOME','EXPENSE','TRANSFER')),
 parent_id UUID,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,parent_id) REFERENCES financial_categories(workspace_id,id) ON DELETE RESTRICT
);
CREATE INDEX financial_categories_ws_idx ON financial_categories(workspace_id,kind);

CREATE TABLE ledger_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 class TEXT NOT NULL CHECK(class IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
 currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 financial_account_id UUID,
 active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 UNIQUE(workspace_id,code),
 FOREIGN KEY(workspace_id,financial_account_id) REFERENCES financial_accounts(workspace_id,id) ON DELETE RESTRICT
);

CREATE TABLE journal_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 effective_on DATE NOT NULL,
 source_type TEXT NOT NULL,
 source_ref TEXT,
 memo TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED')),
 idempotency_key TEXT,
 created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 posted_at TIMESTAMPTZ,
 reverses_entry_id UUID,
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,reverses_entry_id) REFERENCES journal_entries(workspace_id,id) ON DELETE RESTRICT,
 CONSTRAINT posted_at_required CHECK ((status='POSTED' AND posted_at IS NOT NULL) OR (status='DRAFT' AND posted_at IS NULL))
);
CREATE UNIQUE INDEX journal_idempotency_idx ON journal_entries(workspace_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX journal_workspace_date_idx ON journal_entries(workspace_id,effective_on DESC,id);

CREATE TABLE journal_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 entry_id UUID NOT NULL,
 line_number INTEGER NOT NULL CHECK(line_number > 0),
 ledger_account_id UUID NOT NULL,
 debit_minor BIGINT NOT NULL DEFAULT 0 CHECK(debit_minor >= 0),
 credit_minor BIGINT NOT NULL DEFAULT 0 CHECK(credit_minor >= 0),
 description TEXT NOT NULL DEFAULT '',
 UNIQUE(workspace_id,id),
 UNIQUE(entry_id,line_number),
 CHECK ((debit_minor > 0 AND credit_minor = 0) OR (credit_minor > 0 AND debit_minor = 0)),
 FOREIGN KEY(workspace_id,entry_id) REFERENCES journal_entries(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,ledger_account_id) REFERENCES ledger_accounts(workspace_id,id) ON DELETE RESTRICT
);
CREATE INDEX journal_lines_account_idx ON journal_lines(workspace_id,ledger_account_id,entry_id);

CREATE TABLE import_batches (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 financial_account_id UUID NOT NULL,
 source_sha256 CHAR(64) NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 status TEXT NOT NULL DEFAULT 'STAGED' CHECK(status IN ('STAGED','REVIEWED','IMPORTED','REJECTED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 UNIQUE(workspace_id,financial_account_id,source_sha256),
 FOREIGN KEY(workspace_id,financial_account_id) REFERENCES financial_accounts(workspace_id,id) ON DELETE RESTRICT
);
CREATE TABLE import_rows (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 batch_id UUID NOT NULL,
 row_fingerprint CHAR(64) NOT NULL CHECK(row_fingerprint ~ '^[0-9a-f]{64}$'),
 transaction_on DATE NOT NULL,
 description TEXT NOT NULL,
 amount_minor BIGINT NOT NULL,
 currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 disposition TEXT NOT NULL DEFAULT 'PENDING' CHECK(disposition IN ('PENDING','SKIPPED','POSTED')),
 entry_id UUID,
 UNIQUE(workspace_id,id),
 UNIQUE(batch_id,row_fingerprint),
 FOREIGN KEY(workspace_id,batch_id) REFERENCES import_batches(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,entry_id) REFERENCES journal_entries(workspace_id,id) ON DELETE RESTRICT
);

CREATE TABLE budgets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL,
 currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 starts_on DATE NOT NULL,
 ends_on DATE NOT NULL,
 amount_minor BIGINT NOT NULL CHECK(amount_minor >= 0),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','ARCHIVED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 CHECK(ends_on >= starts_on)
);
CREATE INDEX budgets_workspace_period_idx ON budgets(workspace_id,starts_on,ends_on);
CREATE TABLE budget_allocations (
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 budget_id UUID NOT NULL,
 category_id UUID NOT NULL,
 limit_minor BIGINT NOT NULL CHECK(limit_minor >= 0),
 rollover BOOLEAN NOT NULL DEFAULT false,
 PRIMARY KEY(budget_id,category_id),
 FOREIGN KEY(workspace_id,budget_id) REFERENCES budgets(workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(workspace_id,category_id) REFERENCES financial_categories(workspace_id,id) ON DELETE RESTRICT
);

CREATE TABLE spending_guardrails (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('AMOUNT','CATEGORY','MERCHANT','LOCATION','TIME','RECURRING')),
 conditions JSONB NOT NULL CHECK(jsonb_typeof(conditions)='object'),
 action TEXT NOT NULL CHECK(action IN ('WARN','REQUIRE_APPROVAL','BLOCK')),
 active BOOLEAN NOT NULL DEFAULT true,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE TABLE approval_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 guardrail_id UUID,
 requested_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
 decided_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
 reference TEXT NOT NULL,
 amount_minor BIGINT NOT NULL CHECK(amount_minor > 0),
 currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
 decided_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,guardrail_id) REFERENCES spending_guardrails(workspace_id,id) ON DELETE RESTRICT,
 CHECK ((status='PENDING' AND decided_at IS NULL) OR status <> 'PENDING')
);

CREATE TABLE income_sources (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL,
 category_id UUID,
 cadence TEXT NOT NULL CHECK(cadence IN ('MONTHLY','WEEKLY','QUARTERLY','YEARLY','VARIABLE')),
 expected_minor BIGINT NOT NULL CHECK(expected_minor >= 0),
 currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 evidence TEXT NOT NULL DEFAULT 'USER_ESTIMATE' CHECK(evidence IN ('USER_ESTIMATE','MANUAL_RECORD','PROVIDER_VERIFIED')),
 enabled BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,category_id) REFERENCES financial_categories(workspace_id,id) ON DELETE RESTRICT
);
CREATE TABLE financial_scenarios (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL,
 horizon_months INTEGER NOT NULL CHECK(horizon_months BETWEEN 1 AND 600),
 assumptions JSONB NOT NULL CHECK(jsonb_typeof(assumptions)='object'),
 base_snapshot_at TIMESTAMPTZ NOT NULL,
 model_version TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE TABLE debts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 name TEXT NOT NULL,
 lender_name TEXT NOT NULL,
 currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 original_minor BIGINT NOT NULL CHECK(original_minor >= 0),
 outstanding_minor BIGINT NOT NULL CHECK(outstanding_minor >= 0),
 apr_basis_points INTEGER NOT NULL CHECK(apr_basis_points BETWEEN 0 AND 100000),
 minimum_payment_minor BIGINT NOT NULL CHECK(minimum_payment_minor >= 0),
 next_due_on DATE,
 evidence TEXT NOT NULL DEFAULT 'USER_REPORTED' CHECK(evidence IN ('USER_REPORTED','STATEMENT_IMPORTED','PROVIDER_VERIFIED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 CHECK(original_minor >= outstanding_minor)
);
