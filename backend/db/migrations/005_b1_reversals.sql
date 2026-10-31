-- B1 005: append-only correction path for manual financial transactions.
-- No historical row is mutated. Reversals are one-to-one, balanced new journals.
ALTER TABLE manual_transactions
 ADD COLUMN reverses_transaction_id UUID,
 ADD CONSTRAINT manual_transactions_reversed_fk
 FOREIGN KEY(workspace_id,reverses_transaction_id)
 REFERENCES manual_transactions(workspace_id,id) ON DELETE RESTRICT;
ALTER TABLE manual_transactions DROP CONSTRAINT manual_transactions_kind_check;
ALTER TABLE manual_transactions ADD CONSTRAINT manual_transactions_kind_check
 CHECK(kind IN ('INCOME','EXPENSE','TRANSFER','REVERSAL'));
CREATE UNIQUE INDEX manual_transaction_reversal_unique
 ON manual_transactions(workspace_id,reverses_transaction_id)
 WHERE reverses_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX journal_entry_reversal_unique
 ON journal_entries(workspace_id,reverses_entry_id)
 WHERE reverses_entry_id IS NOT NULL;
