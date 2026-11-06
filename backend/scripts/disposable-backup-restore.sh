#!/usr/bin/env sh
# B8 disposable-only PostgreSQL 17 backup/restore drill. NEVER run against personal, staging or production DBs.
set -eu
if [ "${NODE_ENV:-}" != test ] || [ "${B8_DISPOSABLE_RESTORE_CI:-}" != 1 ]; then
 echo 'REFUSED: requires NODE_ENV=test and B8_DISPOSABLE_RESTORE_CI=1' >&2; exit 2
fi
: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL required}"
: "${PGPASSWORD:?PGPASSWORD required}"
docker run --rm --network host -e MIGRATION_DATABASE_URL -e PGPASSWORD postgres:17-alpine sh -ceu '
 src="$MIGRATION_DATABASE_URL"
 case "$src" in *\?*) echo "Query parameters are not supported in disposable CI URL" >&2; exit 2;; esac
 name=finance_os_b8_disposable_restore
 target="${src%/*}/$name"
 if psql -X -A -t -d "$src" -c "SELECT datname FROM pg_database" | grep -Fx "$name" >/dev/null; then
  echo "Restore target already exists, refusing to modify" >&2; exit 2
 fi
 created=0
 cleanup(){
  if [ "$created" -eq 1 ]; then dropdb --if-exists --maintenance-db="$src" "$name" >/dev/null 2>&1 || true; fi
  rm -f /tmp/finance-os-b8-disposable.pgdump
 }
 trap cleanup EXIT
 pg_dump -Fc --no-owner --no-acl --dbname="$src" -f /tmp/finance-os-b8-disposable.pgdump
 createdb --maintenance-db="$src" "$name"
 created=1
 pg_restore --exit-on-error --no-owner --no-acl --dbname="$target" /tmp/finance-os-b8-disposable.pgdump >/dev/null
 query="SELECT concat(
  (SELECT count(*) FROM schema_migrations),chr(124),
  (SELECT count(*) FROM journal_entries),chr(124),
  (SELECT count(*) FROM manual_transactions),chr(124),
  (SELECT count(*) FROM journal_lines),chr(124),
  (SELECT count(*) FROM b7_privacy_requests),chr(124),
  (SELECT coalesce(sum(debit_minor),0) FROM journal_lines),chr(124),
  (SELECT coalesce(sum(credit_minor),0) FROM journal_lines),chr(124),
  (SELECT md5(string_agg(version||sha256,chr(44) ORDER BY version)) FROM schema_migrations))"
 original=$(psql -X -A -t -d "$src" -c "$query")
 restored=$(psql -X -A -t -d "$target" -c "$query")
 if [ "$original" != "$restored" ]; then
  echo "FAIL: restored schema, postings or privacy counts differ" >&2; exit 1
 fi
 echo "PASS: disposable PostgreSQL 17 dump/restore matches migrations, journals, transactions and privacy counts"
'
