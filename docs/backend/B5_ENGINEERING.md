# Finance OS — Phase B5: Debt, Tax, Insurance, Retirement & Estate Planning

## Delivery: protected, manual-data-only backend

Migration: `009_b5_protection_lifecycle.sql` extends 001–008 without modifying historical migrations.
Runtime: `backend/src/b5.ts`; Fastify routes under `/v1/workspaces/:workspaceId`.
OpenAPI: all B5 endpoints explicitly tagged `IMPLEMENTED_B5`.

| Area | Backend truth | Deliberate boundary |
| --- | --- | --- |
| Debt | Immutable loan baseline, APR/minimum user assumptions, projected payoff and uniquely linked POSTED manual principal expense | Not a lender statement, interest accrual service or actual payment |
| Tax | Immutable user estimate, due date, year, and one-time manual expense links | Not a KRA submission, tax calculation engine, return status or receipt |
| Insurance | Immutable user-reported coverage description, provider label, premium, limit and policy dates | No policy number storage, insurer verification, claims or automatic renewal |
| Retirement | Immutable nominal monthly BigInt simulation with explicit return assumption and target | Not a brokerage balance, inflation-adjusted advice, transaction or guaranteed yield |
| Estate | Owner-only, append-only checklist snapshots with five booleans and review date | No beneficiary identities, wills, files, legally binding instrument or distribution |

### Security and correctness

- All requests require authenticated workspace membership. Writes require OWNER/ADMIN/EDITOR; viewers are read-only.
- Estate records are additionally **workspace-owner-only** at API and PostgreSQL RLS boundaries, including reads.
- PostgreSQL table RLS is FORCE-enabled, explicitly checks the authenticated actor and workspace through `SET LOCAL`, and forbids mutation/deletion through append-only triggers.
- All POSTs require `Idempotency-Key`; request replays return 200, new records return 201. All financially meaningful values are integer KES minor units with strict payload schemas.
- Debt/tax allocations reference existing B1 `manual_transactions` with `kind='EXPENSE'`; both the service and a deferred SQL trigger enforce positive amount, one-use expense, no reversal and no over-allocation. SQL advisory transaction locks serialize allocations without UPDATE access on immutable records.
- When a linked manual expense is subsequently reversed, derived debt/tax estimated remaining amounts **stop** treating it as an effective principal/tax reduction; historical links remain auditable.
- Linking does **not** create any journal entry, transfer, bank/provider payment, tax filing or payment confirmation. B1 remains sole POSTED money authority.
- Logs, schemas and B5 payloads intentionally omit tax PINs, account numbers, beneficiary names/IDs, policy numbers, will contents and document attachments.

### API surface

```text
GET  /v1/workspaces/{workspaceId}/debts
POST /v1/workspaces/{workspaceId}/debts
POST /v1/workspaces/{workspaceId}/debts/{debtId}/payments
GET  /v1/workspaces/{workspaceId}/tax/obligations
POST /v1/workspaces/{workspaceId}/tax/obligations
POST /v1/workspaces/{workspaceId}/tax/obligations/{obligationId}/payments
GET  /v1/workspaces/{workspaceId}/insurance/policies
POST /v1/workspaces/{workspaceId}/insurance/policies
GET  /v1/workspaces/{workspaceId}/retirement/scenarios
POST /v1/workspaces/{workspaceId}/retirement/scenarios
GET  /v1/workspaces/{workspaceId}/estate/checklists
POST /v1/workspaces/{workspaceId}/estate/checklists
```

### Run and certify locally

Use **disposable** PostgreSQL 17 and separate restricted `finance_app`/`finance_auth` roles. From `backend/`:

```bash
npm ci
npm run check && npm run contract:check && npm test
npm run migrate
# As the migrator, re-run scripts/provision-app-role.sql with app_password and auth_password.
npm run test:b5
```

See `.github/workflows/backend-b5.yml` for provisioned PostgreSQL integration testing using disposable credentials. Migrations are checksummed, additive and never edited after application.

### Production gates

B5 is **not** declared production-ready until provider identity/MFA, migration/role provisioning, live multi-tenant RLS certification, backup/recovery, privacy review, current Kenya tax/insurance/legal compliance, audit retention and operational monitoring are independently validated. User estimates are never presented as KRA/insurer/lender-certified balances or legal advice.

B5.1 should introduce governed integrations only after explicit per-provider verification contracts and user consent; no sensitive document or third-party personal identity collection should be silently enabled.
