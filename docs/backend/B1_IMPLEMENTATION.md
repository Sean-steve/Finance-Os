# Finance OS — Phase B1: Authentication, Accounts, Transactions & Financial Ledger

**Scope:** A database-backed local development slice built on B0's audited PostgreSQL 17 schema and TypeScript/Fastify service.

## Operational boundary and certification truth

B1 is **LOCAL/TEST ONLY**. Password registration/login is blocked at process startup whenever NODE_ENV=production. It is not a production-ready authentication solution: no email ownership verification, OIDC provider, MFA or managed password recovery exists yet. Do not deploy B1 auth to an Internet-accessible environment, connect real providers or use authentic personal financial records. GitHub Pages remains the read-only 60-screen visual prototype by default.

### Working B1 API endpoints

| Domain | Routes |
| --- | --- |
| Authentication | \`POST /v1/auth/register\`, \`POST /v1/auth/login\`, \`POST /v1/auth/refresh\`, \`POST /v1/auth/logout\`, \`GET /v1/me\` |
| Workspace membership | \`GET/POST /v1/workspaces\` |
| Financial accounts | \`GET/POST /v1/workspaces/:workspaceId/accounts\` |
| Category classification | \`GET/POST /v1/workspaces/:workspaceId/categories\` |
| Manual transactions | \`GET/POST /v1/workspaces/:workspaceId/transactions\`, \`POST /v1/workspaces/:workspaceId/transactions/:transactionId/reverse\` |
| Ledger | \`GET /v1/workspaces/:workspaceId/ledger/journal-entries\`, \`GET /v1/workspaces/:workspaceId/ledger/summary\` |
| Reconciliation | \`POST /v1/workspaces/:workspaceId/statement-imports\`, \`GET /v1/workspaces/:workspaceId/reconciliation\`, \`POST /v1/workspaces/:workspaceId/reconciliation/matches\` |

The OpenAPI document is \`backend/openapi/finance-os.v1.json\`. Legacy B0 planned paths stay marked PLANNED; new B1 routes are tagged IMPLEMENTED_B1_LOCAL.

## Security guarantees implemented in B1

- Password verifier: **salted scrypt** with N=32768, r=8, p=1, randomly generated 128-bit salts; no plaintext password persistence. Constant-time comparison.
- Session: 256-bit random opaque bearer token, SHA-256 digest persisted in private \`app.sessions\`; 8-hour expiry; logout revocation; single-use rotation on refresh. Browser opt-in adapter keeps tokens **in memory only**, not localStorage.
- Role separation: \`finance_auth\` has identity/session authority but **no ledger privileges**; \`finance_app\` has workspace-scoped financial data privileges, but **no password credential access**; \`finance_migrator\` is never used by request handlers.
- Every financial endpoint calls an authenticated session lookup, verifies ACTIVE workspace membership, enforces read-only VIEWER restrictions, then enters a database transaction with actor + workspace \`SET LOCAL\`. Financial table RLS checks active membership and workspace; no cross-tenant FK references.
- Every balance is calculated from **POSTED journal lines** only; financial records are never imported from the prototype's illustrative figures. Positive integers in minor units (KES cents) are used for postings; draft/posted transaction is atomic and immutable.
- Account/category/transaction/import/reconciliation writes require an \`Idempotency-Key\`; same key+payload replays existing result, different payload gives 409. Frontend amounts are validated and cannot supply journal/ledger account IDs.
- Imports are **staged unverified evidence**. A manual reconciliation match requires the same workspace, financial account, currency and signed amount, and links to the original journal entry **without double-posting**.
- Local login attempts are throttled in memory; **distributed limits, MFA, email verification and production OIDC remain required before deployment**.

## Intentionally not built in B1

Live bank connections, M-Pesa/Paybill, statement-provider webhooks, payouts, real money transfers, bill autopay, complete onboarding, multi-currency FX, card safeguards, production account recovery, MFA, web-accessible account access and automated financial projections.

Journal-backed manual Income/Expense and transaction reversals are implemented. Transfers are deferred until balanced multi-account transfer controls are certified. Non-KES manual category ledger postings are rejected by B1; the underlying schema retains 3-letter currency codes for later multi-currency support.

## Database changes

\`004_b1_identity_ledger.sql\` introduces separate password/session tables, immutable manual transactions, reconciliation matches, explicit ACTIVE member policies and separate write permissions. The additive \`005_b1_reversals.sql\` migration enforces one-to-one reversal entries and records original-to-reversal relationships. B0 migrations 001–003 remain untouched.

Apply using an isolated migrator after backing up the database. Never run integration tests against a shared/production database. The CI environment uses throwaway PostgreSQL 17 with separate \`finance_app\` and \`finance_auth\` roles and detects migration checksum drift.

## Local setup

From repository root:
\`\`\`bash
export FINANCE_DB_MIGRATOR_PASSWORD='your-local-migrator-secret'
docker compose -f backend/compose.yaml up -d
cd backend
npm ci
export MIGRATION_DATABASE_URL='postgresql://finance_migrator:<MIGRATOR_PASSWORD>@127.0.0.1:5544/finance_os'
npm run migrate
export FINANCE_APP_PASSWORD='different-local-app-password'
export FINANCE_AUTH_PASSWORD='different-local-auth-password'
PGPASSWORD="$FINANCE_DB_MIGRATOR_PASSWORD" psql \
  -h 127.0.0.1 -p 5544 -U finance_migrator -d finance_os \
  -v app_password="$FINANCE_APP_PASSWORD" -v auth_password="$FINANCE_AUTH_PASSWORD" \
  -f scripts/provision-app-role.sql
export DATABASE_URL='postgresql://finance_app:<APP_PASSWORD>@127.0.0.1:5544/finance_os'
export AUTH_DATABASE_URL='postgresql://finance_auth:<AUTH_PASSWORD>@127.0.0.1:5544/finance_os'
export NODE_ENV=development LOCAL_AUTH_ENABLED=true
export CORS_ALLOWED_ORIGINS='http://127.0.0.1:8080,http://localhost:8080'
npm run dev
\`\`\`
Use URL-encoded real values (never literal placeholders) and do not commit secrets. B0's separate role separation remains mandatory. For integration tests use isolated TEST_APP_DATABASE_URL, TEST_AUTH_DATABASE_URL and MIGRATION_DATABASE_URL on **disposable databases only**.

To use the optional frontend adapter, serve the existing static repo locally with \`python3 -m http.server 8080\` and open:

\`http://127.0.0.1:8080/rebuild.html?b1=local#screen/1\`

The B1 panel appears only for this local opt-in, with dedicated server-backed forms for Screen 01, Screen 07 Accounts, Screen 10 Transactions, and Screen 15 Reconciliation. Default \`rebuild.html\` remains demo and its full 60-screen visual experience stays unchanged.

## B1 acceptance tests

\`npm run test:b1\` runs actual local authentication, tenant access denial, data persistence, two-line balanced posted journals, no double-post replay, mismatched idempotency rejection, idempotent statement staging, reconciliation consistency, read-only VIEWER denial, immutable posted financial records, token refresh rotation and logout.

**Next implementation path:** B1.1 hardening (MFA/OIDC, email verification and recovery, production-grade rate limits, runtime DB privileges), then B2 (budget/spending/guardrails with authoritative accounts). Frontend full UI replacement from demo records must follow domain API certification rather than bypass it.
