# Finance OS — Phase B0 Architecture & Backend Handoff

**Status:** executable backend skeleton, PostgreSQL schema and versioned API contract. **Not:** real authentication, live financial data or production banking.

## 1. Deployment and ownership boundaries
- \`index.html\` and \`rebuild.html\` remain **public static GitHub Pages UI prototypes**. Never embed secrets or attach prototype localStorage directly to the API.
- \`backend/\` is an independent Node.js 22+/Fastify 5 API and PostgreSQL 16 persistence foundation. CI runs its database and contract tests. Production backend must be hosted privately via HTTPS with separate secrets, database runtime credentials and backup infrastructure.
- **Phase B0 routes exposed:** \`GET /health/live\`, \`GET /health/ready\`, \`GET /v1\` only. Financial paths in OpenAPI are future B1+ contracts, not deceptive stubs claiming to operate.
- Start with modular monolith bounded contexts: Identity & Workspace, Financial Accounts, Ledger & Reconciliation, Spending & Budgets, Guardrails & Approvals, Income & Obligations, Forecasts & Scenarios, Debt & Wealth, Audit & Integration Events. External interfaces are contracts with explicit idempotency and authorization. Add queues/adapters later as needed.

## 2. Data sources and financial truth
- PostgreSQL is canonical; an immutable **double-entry journal** is the ledger of verified financial movements. Ledger accounts classify assets/liabilities/equity/income/expenses. All journal line values are signed by DEBIT/CREDIT indicator and **positive bigint minor units**. No floating-point currency or spreadsheet-derived balances.
- Currency is ISO-style uppercase 3-letter code and a hard line-level currency equality check. A posted journal has at least two lines and must balance **per currency** in a deferred transaction constraint. Posted journals/lines cannot be edited or deleted, and revisions must be explicit reversal journals.
- Imported provider transactions are **staging evidence** with independent deduplication per workspace and financial account. They become reconciled only when associated with verified ledger posts; a provider statement and a model forecast are different evidence classes.
- Budgets, income sources, debt metadata and scenario runs are **projections/plans**, not ledger postings. Forecast results include snapshot timestamp and model version. Never mutate ledger values when running Screen 29/42 simulation.
- All resource tables are scoped to a workspace; cross-workspace foreign keys use compound keys to avoid accidental reference leaks. Audit events and idempotency records are per workspace.

## 3. Identity / authorization / tenancy
- A \`subject\` is a platform user; a workspace is PERSONAL, HOUSEHOLD or BUSINESS. Membership has OWNER/ADMIN/EDITOR/VIEWER and active/invited/revoked states.
- **B1 requirement:** provider-verified identity, real sessions/token validation, MFA as appropriate, deny-by-default role policy and resource-level capability checks; session membership must be revalidated before serving workspace data.
- B0 tables enable PostgreSQL RLS, restricting reads to \`finance_os.subject_id\` and \`finance_os.workspace_id\` plus ACTIVE membership. These values must be set as **SET LOCAL only inside an authorized request transaction** by a dedicated database runtime role, not the elevated migration account. Do not trust client-supplied workspace/subject claims.
- Mutating DB permissions are intentionally unprovisioned. B1 will add role-targeted least-privilege grants plus audited SECURITY DEFINER write functions or a privileged service route with explicit checks, as appropriate. Migration role must never process HTTP traffic.
- Workspace separation must protect family/business data; no automatic personal/business blending without scoped and logged consent.

## 4. API and error semantics
- Contract file \`backend/contracts/openapi.json\` (OpenAPI 3.1). Every financial endpoint requires bearer identity and explicit \`workspaceId\`; write operations require \`Idempotency-Key\`. Journal posting also requires \`If-Match\` to prevent competing updates.
- Future request/response validation must use OpenAPI-compatible schemas with 400/401/403/404/409/422/429 and application/problem+json errors, opaque request ID and no sensitive stack traces.
- Shared pagination is cursor-based with a hard limit (maximum 100 for accounts). POST create returns 201, import job returns 202, decisions return 200 after committed persistence. Retries with the same key+fingerprint return previous response; mismatched fingerprints return 409.
- Source fields must distinguish \`recordedAt\`, \`occurredAt\`, \`date\`, \`sourceSnapshotAt\`; store timestamps in UTC, render using workspace TZ (Africa/Nairobi by default). Financial period boundaries are explicit dates.

## 5. Domain-to-screen mapping (B1+)
| Screens | Domain backend contract |
| --- | --- |
| 01–03 | identity, sessions, onboarding, memberships, workspace configuration |
| 04–15 | accounts, transaction evidence, canonical journal, imports/reconciliation |
| 16–26, incl 24 | spending, budgets, guardrail evaluation, approval decisions and policy audit |
| 27–34, incl 29 | income source planning, obligation data and cash-flow forecast projections |
| 35–42, incl 42 | capital plans, goal budgets, scenario inputs and versioned model output |
| 43–49, incl 43 | debt accounts, payment schedules, liabilities, tax/insurance metadata |
| 50–60 | net-worth projections, reports, audited insights, consent-based integrations, preferences |

## 6. Engineering readiness / security gates
- No user credentials, provider tokens, tax documents or actual statements on public GitHub Pages or in committed sources.
- Use environment-scoped secrets, managed PostgreSQL backup/PITR, restricted network access, TLS verification, encrypted storage for sensitive documents, rate limits, MFA, auditing, threat modeling and vulnerability review **before** production.
- No M-Pesa/bank transactions, subscriptions, loan disbursement or provider-enforced purchase blocks are possible in B0.
- B0 gate: schema migration checksums and transactional application; constrained source, tenancy and double-entry consistency; integration tests; contract lint tests; health endpoint tests; frontend CI unchanged.
- B1 gate: replace simulated auth securely; instantiate per-workspace authorization and write services; certification against real PostgreSQL records.
- B2+: statement imports/reconciliation, guardrails, income/debt data and models.
- B3+: consented provider integrations, reconciliation/webhooks, delayed retries, operational incident and recovery drills.

## 7. Local run instructions
\`\`\`bash
cd backend
export FINANCE_OS_DB_PASSWORD='choose-local-random-password'
docker compose up -d postgres
cp .env.example .env
# Edit the local .env DATABASE_URL to match FINANCE_OS_DB_PASSWORD
set -a; . ./.env; set +a
npm install
npm run db:migrate
npm run db:check
B0_INTEGRATION_TEST=1 npm test
npm start
\`\`\`
Database binds only to 127.0.0.1:5432. The API binds 127.0.0.1:3001 by default. Access \`http://127.0.0.1:3001/health/live\` and \`/health/ready\`.

**Production readiness:** Not certified; do not use real finance records or secrets until identity/RLS runtime role, infrastructure and security acceptance are completed.
