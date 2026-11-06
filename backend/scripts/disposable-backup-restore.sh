#!/usr/bin/env sh
# B8 disposable-only disaster recovery rehearsal. NEVER run on real/staging databases.
set -eu
if [ "${NODE_ENV:-}" != 'test' ] || [ "${B8_DISPOSABLE_RESTORE_CI:-}" != '1' ]; then
 echo 'REFUSED: backup/restore rehearsal is strictly disposable test-only' >&2
 exit 2
fi
: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL required}"
: "${PGPASSWORD:?PGPASSWORD required}"
# PostgreSQL 17 client in PostgreSQL 17 image avoids runner client/server version mismatch.
# The DB is explicitly test-named and must not preexist; no production DB is dropped.
docker run --rm --network host \
 -e MIGRATION_DATABASE_URL -e PGPASSWORD \
 postgres:17-alpine sh -ceu '
 src="$MIGRATION_DATABASE_URL"
 case "$src" in *"? "*|*\?*) echo "Disallowed complex test DB URL" >&2; exit 2;; esac
 name="finance_os_b8_disposable_restore"
 target="${src%/*}/$name"
 exists=$(psql -X -A -t -d "$src" -c "SELECT count(*) FROM pg_database WHERE datname=\x27$name\x27")
 if [ "$exists" != "0" ]; then echo "Restore test DB already exists: refusing" >&2; exit 2; fi
 created=0
 cleanup(){
  if [ "$created" -eq 1 ]; then dropdb --if-exists --maintenance-db="$src" "$name" >/dev/null 2>&1 || true; fi
  rm -f /tmp/finance-os-b8-disposable.pgdump
 }
 trap cleanup EXIT
 # No secrets or raw financial rows are emitted in stdout.
 pg_dump -Fc --no-owner --no-acl --dbname="$src" -f /tmp/finance-os-b8-disposable.pgdump
 createdb --maintenance-db="$src" "$name"
 created=1
 pg_restore --exit-on-error --no-owner --no-acl --dbname="$target" /tmp/finance-os-b8-disposable.pgdump >/dev/null
 query="SELECT
  (SELECT count(*) FROM schema_migrations)::text||\x27|\x27||
  (SELECT count(*) FROM journal_entries)::text||\x27|\x27||
  (SELECT count(*) FROM manual_transactions)::text||\x27|\x27||
  (SELECT count(*) FROM journal_lines)::text||\x27|\x27||
  (SELECT count(*) FROM b7_privacy_requests)::text||\x27|\x27||
  (SELECT coalesce(sum(debit_minor),0) FROM journal_lines)::text||\x27|\x27||
  (SELECT coalesce(sum(credit_minor),0) FROM journal_lines)::text||\x27|\x27||
  (SELECT md5(string_agg(version||sha256,\x27,\x27 ORDER BY version)) FROM schema_migrations)::text"
 original=$(psql -X -A -t -d "$src" -c "$query")
 restored=$(psql -X -A -t -d "$target" -c "$query")
 if [ "$original" != "$restored" ]; then
  echo "FAIL: restored migrations or journal/transaction/privacy facts differ" >&2
  exit 1
 fi
 echo "PASS: disposable PostgreSQL 17 backup/restore checksum, journals, identity records and privacy count match"
'
