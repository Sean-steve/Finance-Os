# Finance OS — B0 Backend Architecture & Security Decisions

**Scope:** Design and executable foundation for the complete 60-screen Finance OS. **No backend production deployment** and **no real financial credentials**. Frontend `rebuild.html` stays independent of a future private API.

## 1. Architectural decision record

**ADR-B0-01 — Modular monolith.** Use a single independently deployed TypeScript/Fastify API backed by PostgreSQL and isolated domain services. Avoid 60 autonomous screen-specific microservices. Add asynchronous workers only once actual idempotent jobs, retries and outbox consumers are needed.

**ADR-B0-02 — Data authority.** Single authoritative double-entry journal. UX estimates, scenario results, budgets, imported statements and debt plans do NOT replace posted ledger balances. Every manual/provider event gets `source_type`, provenance, quality, correlation and post/reversal history. Ledger postings use integer minor units, never binary floating point. Currency carried on each journal and ledger account; multi-currency requires explicit FX postings and valued conversion rules in a separate phase.

**ADR-B0-03 — Isolation.** User identities and workspace membership are separately modeled. Workspace IDs are included in all financial domain tables and composite foreign keys. RLS with `FORCE ROW LEVEL SECURITY` fails closed when `app.workspace_id` is unset. Backend must authenticate actor, verify membership and role, then set context using `SET LOCAL` in one PostgreSQL transaction. No workspace ID, role or actor claim in JSON/headers is authoritative without server verification. Migrator owns DDL; application role must be `NOSUPERUSER NOBYPASSRLS`.

**ADR-B0-04 — Identity integration deferred.** B0 only models identity subjects. B1 must provide OIDC or equivalent secure login, hashed passwords if first-party authentication, MFA, short-lived sessions, refresh/session rotation, token revocation, login throttling and external subject mapping. Public static Pages must not be an authentication authority; localStorage demo session and profile are not authoritative.

**ADR-B0-05 — Provider connectivity deferred.** Banking, M-Pesa and third-party financial sources use explicit permission, verification, signed webhook event validation, replay protection, idempotent reconciliation, credential encryption and disconnect/revocation. Do not label a preview connection `VERIFIED` without authoritative evidence.

**ADR-B0-06 — Domain capability rollout.** B1 identity, workspaces, accounts, transactions, ledger/reconciliation; B2 budgets, guardrails, approvals; B3 income forecasts, scenarios, debts; B4 provider integrations, automation and production hardening. Read endpoints must distinguish `MANUAL`, `ESTIMATED` and `VERIFIED`.

## 2. Modules and ownership

| Module | Owner of truth | Boundaries | Target phase |
|---|---|---|---|
| Identity & Workspace | authenticated subjects, members, roles | tenant provisioning; session lifecycle | B1 |
| Accounts & Source Registry | account metadata and link status | external credentials NEVER exposed | B1 |
| Ledger & Transactions | immutable balanced posted entries, reversals | double-entry, idempotency, cash conservation | B1 |
| Imports & Reconciliation | import batches, duplicate fingerprint, evidence | no provider verification without proof | B1 |
| Budgets & Spending | budget rules, limits, categories | recommendations vs actual bank restriction | B2 |
| Guardrails & Approvals | policy revisions, decisions, delegation | server-side authorization and audit | B2 |
| Income & Forecasting | expected income, as-of snapshots | model-versioned projections; never posted cash | B3 |
| Scenario Planning | scenario assumptions and model snapshots | sensitivity analysis, not advice guarantee | B3 |
| Debts & Liabilities | loan metadata, outstanding balances, schedules | repayment plan not lender action | B3 |
| Audit & Events | actor action evidence, outbox | immutable audit; retryable delivery | B1+ |

## 3. Canonical data invariants

1. Each workspace-scoped reference uses `(workspace_id, id)` foreign keys. Direct cross-tenant references are impossible at schema level.
2. Debit and credit amounts are non-negative integer BIGINT minor units; a single line is strictly debit **xor** credit. Posted entries must have >=2 lines, total debits = credits > 0 and all lines in the same journal currency.
3. Posted entries and lines are immutable. Adjustments create a **new** posting; reversal is not an update or delete. Deferred constraint triggers validate the final transaction state.
4. A journal's idempotency key is unique inside its workspace. Request keys are additionally unique by workspace and operation and bound to request hashes for future B1 idempotent replies.
5. Audit events are append-only. No secrets, card PAN, password or raw authorization tokens should enter audit details or outbox payloads.
6. Multi-user workspace roles are `OWNER / ADMIN / EDITOR / VIEWER` but no write grants are exposed in B0. B1 must enforce last-owner and role-based permissions.
7. Dates of economic events use `DATE`; instants use `TIMESTAMPTZ`, UTC at storage, Nairobi time zone rendered in UX. Future multicurrency/FX uses explicit valuation provenance.
8. Provider sync `VERIFIED` is reserved for authoritative confirmations. Income forecasts, debt simulation and scenario predictions must be marked `ESTIMATED`.

## 4. Persistence and lifecycle

- Migration files are immutable/versioned and `sha256` tracked in `schema_migrations`. Advisory locks serialize migration runners. Each version applies in a transaction or rolls back atomically.
- `finance_migrator` DDL privilege must be separate from `finance_app`; B0 app role receives only schema access and SELECT (no financial writes). Use least privilege and managed PostgreSQL secrets in production.
- `audit_events` is append-only; `outbox_events` anticipates reliable eventual jobs without falsely running a worker. Asynchronous systems/retries are B4.
- PII and financial statements need encryption at rest, limited retention, access history, legal review and explicit user deletion/export controls; **not yet production certified**.
- Do not copy unverified localStorage fixtures into a real account. Any consented migration must validate provenance and keep an auditable origin record.

## 5. API contract conventions

Contract: `backend/openapi/finance-os.v1.json` (OpenAPI 3.0.3). All operations have unique IDs, typed schemas, error status envelopes and `x-implementation-status`. Only `/health/live`, `/health/ready` and `/v1/meta` currently exist.

Planned protected routes require bearer authentication, `X-Workspace-Id` workspace selection (validated against authenticated membership), idempotency keys on POST, parameter validation and consistent errors. Pagination is cursor-based; account balances indicate `asOf` and data quality. Every money object comprises currency and `int64` minor units. In JavaScript, future services must use BigInt or lossless decimal serializers for values above `Number.MAX_SAFE_INTEGER`.

**Explicitly not certified:** JWT/OIDC, transaction endpoints, realtime bank ingestion, purchase-rule enforcement, repayment posting, webhook security, production encryption, backups, horizontal scaling. These are B1–B4 deliverables, not implied by tables or a schema.
