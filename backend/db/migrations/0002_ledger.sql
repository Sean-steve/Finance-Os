-- B0 0002. Canonical accounting records. All amounts are INTEGER minor units.
-- Ledger postings must be debit/credit balanced when a journal becomes POSTED.
-- Financial accounts and journal lines cannot cross a workspace boundary.
CREATE TABLE financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 160),
  account_type text NOT NULL CHECK (account_type IN ('CASH','BANK','MOBILE_MONEY','CREDIT','LOAN','INVESTMENT','OTHER')),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  institution_name text,
  external_ref_hash char(64),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED','PENDING_VERIFICATION')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id)
);
CREATE INDEX idx_financial_accounts_workspace ON financial_accounts(workspace_id, status);

CREATE TABLE ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  code text NOT NULL,
  title text NOT NULL,
  class text NOT NULL CHECK (class IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  financial_account_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  UNIQUE (workspace_id,code,currency),
  FOREIGN KEY (workspace_id,financial_account_id) REFERENCES financial_accounts(workspace_id,id)
);

CREATE TABLE journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  external_ref text,
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 512),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','VOID')),
  created_by uuid NOT NULL REFERENCES subjects(id),
  posted_at timestamptz,
  reversed_journal_id uuid,
  UNIQUE (workspace_id,id),
  UNIQUE (workspace_id,external_ref),
  FOREIGN KEY (workspace_id,reversed_journal_id) REFERENCES journals(workspace_id,id),
  CHECK ((status = 'POSTED' AND posted_at IS NOT NULL) OR (status <> 'POSTED' AND posted_at IS NULL))
);
CREATE INDEX idx_journals_workspace_occurred ON journals(workspace_id,occurred_at DESC,id);

CREATE TABLE journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  ledger_account_id uuid NOT NULL,
  side text NOT NULL CHECK (side IN ('DEBIT','CREDIT')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  FOREIGN KEY (workspace_id,journal_id) REFERENCES journals(workspace_id,id),
  FOREIGN KEY (workspace_id,ledger_account_id) REFERENCES ledger_accounts(workspace_id,id)
);
CREATE INDEX idx_journal_lines_journal ON journal_lines(workspace_id,journal_id);

-- Every line must carry the exact currency of its ledger account.
CREATE FUNCTION finance_check_line_currency() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE expected_currency char(3);
BEGIN
 SELECT a.currency INTO expected_currency FROM ledger_accounts a
  WHERE a.workspace_id = NEW.workspace_id AND a.id = NEW.ledger_account_id;
 IF expected_currency IS DISTINCT FROM NEW.currency THEN
  RAISE EXCEPTION 'Ledger account and posting currencies differ';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_line_currency BEFORE INSERT OR UPDATE ON journal_lines
 FOR EACH ROW EXECUTE FUNCTION finance_check_line_currency();

-- A posted journal must have 2+ lines and balance separately by currency.
-- Deferred triggers permit multi-statement insertion inside one transaction.
CREATE FUNCTION finance_assert_journal_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE jid uuid; wid uuid; current_status text; line_count bigint; imbalance bigint;
BEGIN
 IF TG_TABLE_NAME = 'journals' THEN
  jid := NEW.id; wid := NEW.workspace_id;
 ELSIF TG_OP = 'DELETE' THEN
  jid := OLD.journal_id; wid := OLD.workspace_id;
 ELSE
  jid := NEW.journal_id; wid := NEW.workspace_id;
 END IF;
 SELECT status INTO current_status FROM journals WHERE id=jid AND workspace_id=wid;
 IF current_status IS DISTINCT FROM 'POSTED' THEN RETURN NULL; END IF;
 SELECT count(*) INTO line_count FROM journal_lines WHERE workspace_id=wid AND journal_id=jid;
 IF line_count < 2 THEN RAISE EXCEPTION 'Posted journal requires at least two lines'; END IF;
 SELECT count(*) INTO imbalance FROM (
  SELECT currency FROM journal_lines
  WHERE workspace_id=wid AND journal_id=jid
  GROUP BY currency
  HAVING SUM(CASE WHEN side='DEBIT' THEN amount_minor ELSE -amount_minor END) <> 0
 ) unbalanced;
 IF imbalance > 0 THEN RAISE EXCEPTION 'Posted journal must balance by currency'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_posted_journal_balanced AFTER INSERT OR UPDATE ON journals
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_assert_journal_balanced();
CREATE CONSTRAINT TRIGGER trg_lines_balanced AFTER INSERT OR UPDATE OR DELETE ON journal_lines
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_assert_journal_balanced();

-- Posted accounting records are immutable; corrections require reversing entries.
CREATE FUNCTION finance_guard_posted_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('POSTED','VOID') THEN
  RAISE EXCEPTION 'Posted or void journals are immutable; create a reversing journal';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_posted_journal BEFORE UPDATE OR DELETE ON journals
 FOR EACH ROW EXECUTE FUNCTION finance_guard_posted_journal();

CREATE FUNCTION finance_guard_posted_lines() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
 SELECT status INTO s FROM journals WHERE workspace_id=OLD.workspace_id AND id=OLD.journal_id;
 IF s <> 'DRAFT' THEN RAISE EXCEPTION 'Cannot mutate lines of a posted journal'; END IF;
 IF TG_OP = 'UPDATE' THEN
   IF NEW.workspace_id <> OLD.workspace_id OR NEW.journal_id <> OLD.journal_id THEN
     RAISE EXCEPTION 'Cannot reparent journal lines';
   END IF;
   RETURN NEW;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER trg_guard_posted_lines BEFORE UPDATE OR DELETE ON journal_lines
 FOR EACH ROW EXECUTE FUNCTION finance_guard_posted_lines();

CREATE FUNCTION finance_guard_insert_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
 SELECT status INTO s FROM journals WHERE workspace_id=NEW.workspace_id AND id=NEW.journal_id;
 IF s IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Lines can only be inserted into draft journals'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_insert_line BEFORE INSERT ON journal_lines
 FOR EACH ROW EXECUTE FUNCTION finance_guard_insert_line();

CREATE TABLE imported_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  financial_account_id uuid NOT NULL,
  provider_transaction_id text,
  source_fingerprint char(64) NOT NULL,
  occurred_at timestamptz NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor <> 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  description text NOT NULL,
  reconciliation_status text NOT NULL DEFAULT 'UNMATCHED'
    CHECK (reconciliation_status IN ('UNMATCHED','MATCHED','EXCLUDED')),
  journal_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  UNIQUE (workspace_id,financial_account_id,source_fingerprint),
  FOREIGN KEY (workspace_id,financial_account_id) REFERENCES financial_accounts(workspace_id,id),
  FOREIGN KEY (workspace_id,journal_id) REFERENCES journals(workspace_id,id)
);
CREATE UNIQUE INDEX uniq_provider_transaction ON imported_transactions(workspace_id,financial_account_id,provider_transaction_id)
 WHERE provider_transaction_id IS NOT NULL;
