# Finance OS Backend — Phase B0

**Status: backend foundation only; no live financial API or authentication.** The 60-screen UI remains independently published as a demonstration on GitHub Pages.

## What exists

- Strict TypeScript Fastify API server with process liveness, PostgreSQL migration readiness and `/v1/meta` status.
- Versioned **OpenAPI 3.0.3** contract (`openapi/finance-os.v1.json`) declaring *future* B1–B3 endpoints, money units, validation/errors, workspace scope and idempotency requirements.
- PostgreSQL migration runner with checksum verification, serialization using advisory locks, and rollback on migration failure.
- Workspace/user/access model and structural tables for accounts, categories, postings, imports, budgets, guardrails, approvals, income, scenarios, debts, audit and outbox.
- RLS isolation for workspace-scoped tables and immutability + deferred balance checks for posted journals.
- Separate, minimally privileged `finance_app` role provisioner (B0 SELECT only; never migration-owner or superuser).
- Unit, contract and real-PostgreSQL integration tests in GitHub Actions.

**Not built in B0:** password login, OIDC, JWT validation, bank links, M-Pesa, payouts, loan repayments, financial CRUD routes, transaction reconciliation service, rules engine, projections, background jobs, real notifications, provider webhooks, admin users or hosting. Do not enter genuine credentials or financial data in the prototype.

## Local development

Requirements: Node 22+, PostgreSQL 17+ (compose optional), psql, two separate strong database passwords. Commands from the repository root:

```bash
export FINANCE_DB_MIGRATOR_PASSWORD='<your-local-strong-secret>'
docker compose -f backend/compose.yaml up -d
cd backend
npm ci
npm run check
npm run contract:check
npm test

export MIGRATION_DATABASE_URL='postgresql://finance_migrator:<MIGRATOR_PASSWORD>@127.0.0.1:5544/finance_os'
npm run migrate
```

For local provisioning, substitute your **separate** API-role password. Prefer `PGPASSWORD` supplied securely by your shell or a secret manager and never log it:

```bash
export FINANCE_APP_PASSWORD='<separate-strong-secret>'
PGPASSWORD="$FINANCE_DB_MIGRATOR_PASSWORD" psql \
  -h 127.0.0.1 -p 5544 -U finance_migrator -d finance_os \
  -v app_password="$FINANCE_APP_PASSWORD" \
  -f scripts/provision-app-role.sql

export DATABASE_URL='postgresql://finance_app:<APP_PASSWORD>@127.0.0.1:5544/finance_os'
export CORS_ALLOWED_ORIGINS='http://localhost:8080'
npm run dev
# GET http://127.0.0.1:3101/health/live
# GET http://127.0.0.1:3101/health/ready
# GET http://127.0.0.1:3101/v1/meta
```

The placeholder URLs above are examples only; **replace placeholders** (URL-encode special characters) and never commit an `.env` containing passwords. Actual secrets are intentionally not supplied.

To run PostgreSQL invariant tests against a fresh disposable database, set `TEST_APP_DATABASE_URL` to the separate restricted `finance_app` connection string and run `npm run test:db`. Database tests create disposable fixture records, so do not run them against a real or shared database.

## Database design choices

Every financial row has an unambiguous workspace ID and composite workspace-local FK references. A real authenticated server (implemented **in B1**) must validate actor membership and role **before** invoking `withWorkspace`; merely setting `X-Workspace-Id` is never sufficient. Scoped sessions use `SET LOCAL` inside one transaction, avoiding cross-request leakage.

Money: `BIGINT` **minor units**, three-character ISO currency codes; no floating point for journal postings. Posted journal entries are immutable and balanced; corrections must be **new compensating/reversal entries**. Budget, forecasts and debts are projections/plans unless independently reconciled to verified ledger data. Manual, estimated and provider-verified records are never presented as equivalent.

## Important gates before B1

Review `docs/backend/B0_ARCHITECTURE.md`, `B0_ACCEPTANCE.md` and `SCREEN_API_MAPPING.md`. Certify GitHub Actions Backend B0 workflow; validate RLS using restricted credentials, checksum drift, financial posting invariants. Implement OIDC, MFA and user/workspace membership verification before any protected route or frontend integration.

**Deployment boundary:** GitHub Pages only hosts the public UI. Do not expose this backend until secrets, TLS, auth, logging/privacy, backups and production readiness are certified.
