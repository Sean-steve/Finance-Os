-- RLS and ledger-posting invariants. APP ROLE MUST NOT OWN TABLES OR HAVE BYPASSRLS.
CREATE SCHEMA IF NOT EXISTS app;
CREATE OR REPLACE FUNCTION app.current_workspace_id() RETURNS UUID
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.workspace_id',true),'')::uuid $$;
CREATE OR REPLACE FUNCTION app.current_actor_id() RETURNS UUID
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.actor_id',true),'')::uuid $$;

-- A posted entry is append-only. Reversals create a NEW, balanced entry.
CREATE OR REPLACE FUNCTION app.protect_posted_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.status='POSTED' THEN
   RAISE EXCEPTION 'Posted journal entries are immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_posted_entry BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION app.protect_posted_entry();

CREATE OR REPLACE FUNCTION app.protect_posted_lines() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE current_status TEXT;
BEGIN
 IF TG_OP <> 'INSERT' THEN
   SELECT status INTO current_status FROM journal_entries WHERE id=OLD.entry_id;
   IF current_status='POSTED' THEN RAISE EXCEPTION 'Posted journal lines are immutable' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP <> 'DELETE' THEN
   SELECT status INTO current_status FROM journal_entries WHERE id=NEW.entry_id;
   IF current_status='POSTED' THEN RAISE EXCEPTION 'Cannot append or move a line into a posted journal' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_posted_lines BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION app.protect_posted_lines();

CREATE OR REPLACE FUNCTION app.assert_posted_balanced() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 target UUID;
 posted BOOLEAN;
 entry_currency CHAR(3);
 line_count BIGINT;
 sum_debit NUMERIC;
 sum_credit NUMERIC;
 currency_mismatch BOOLEAN;
BEGIN
 IF TG_TABLE_NAME='journal_entries' THEN
   target=NEW.id;
 ELSIF TG_OP='DELETE' THEN
   target=OLD.entry_id;
 ELSE
   target=NEW.entry_id;
 END IF;
 SELECT status='POSTED', currency INTO posted, entry_currency FROM journal_entries WHERE id=target;
 IF NOT FOUND OR NOT posted THEN RETURN NULL; END IF;
 SELECT count(*),coalesce(sum(debit_minor),0),coalesce(sum(credit_minor),0)
   INTO line_count,sum_debit,sum_credit FROM journal_lines WHERE entry_id=target;
 SELECT EXISTS(
   SELECT 1 FROM journal_lines l JOIN ledger_accounts a ON a.id=l.ledger_account_id
   WHERE l.entry_id=target AND a.currency<>entry_currency
 ) INTO currency_mismatch;
 IF line_count<2 OR sum_debit<>sum_credit OR sum_debit<=0 OR currency_mismatch THEN
   RAISE EXCEPTION 'Posted journal must contain at least two balanced lines in one currency' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER journal_balanced_on_entry
 AFTER INSERT OR UPDATE ON journal_entries DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION app.assert_posted_balanced();
CREATE CONSTRAINT TRIGGER journal_balanced_on_lines
 AFTER INSERT OR UPDATE OR DELETE ON journal_lines DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION app.assert_posted_balanced();

CREATE OR REPLACE FUNCTION app.lock_audit_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only' USING ERRCODE='23514'; END $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION app.lock_audit_events();

-- Workspace-local RLS, fail-closed when app.workspace_id was not SET LOCAL.
DO $$
DECLARE tbl TEXT;
BEGIN
 FOR tbl IN
   SELECT table_name FROM information_schema.columns
   WHERE table_schema='public' AND column_name='workspace_id'
 LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
   EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',tbl);
   EXECUTE format(
     'CREATE POLICY workspace_scope ON public.%I USING(workspace_id=app.current_workspace_id()) WITH CHECK(workspace_id=app.current_workspace_id())',
     tbl
   );
 END LOOP;
END $$;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON workspaces
  USING (id=app.current_workspace_id()) WITH CHECK (id=app.current_workspace_id());
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users FORCE ROW LEVEL SECURITY;
CREATE POLICY actor_self ON app_users
  USING (id=app.current_actor_id()) WITH CHECK (id=app.current_actor_id());

COMMENT ON FUNCTION app.current_workspace_id() IS
 'Session scope only; B1 must validate authenticated actor membership server-side before setting these variables.';
