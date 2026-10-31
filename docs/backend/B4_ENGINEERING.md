# Finance OS B4 — Virtual Money Buckets, Savings Goals, Capital Allocation & Financial Scenarios

## Delivery boundary

B4 adds a **manual-ledger-backed virtual financial planning layer**, not transfers, escrow, bank subaccounts, a brokerage or any provider-verified reservation. The authenticated Finance OS Screens **35–42** now show actual PostgreSQL workspace records or clearly labeled simulated results. The original `rebuild.html` illustration remains a separate 60-screen demo and never contributes balances.

**Money authority:** Only B1 POSTED KES entries into non-archived manual CASH/BANK/MOBILE_MONEY asset ledger accounts contribute to the B4 starting baseline. B4 does not write or modify any POSTED journal. Earnings from B3 are not counted until manually recorded as POSTED income; B3 future bills are unverified and remain separate.

## Domain model and exact invariants

Forward-only migration `008_b4_capital_goals_scenarios.sql` extends the previous 001–007 migrations and is checksum verified by the migrator.

| Domain | Financial and security rule |
| --- | --- |
| `money_buckets` | Workspace-scoped immutable name, purpose, priority and currency; ACTIVE→ARCHIVED only after virtual allocations equal zero. |
| `savings_goals` | Workspace-scoped immutable KES target, SAVINGS/EMERGENCY kind, optional due date. Emergency coverage = virtual earmark / user-entered monthly essential costs, not confirmed accessible cash. Goal funding cannot exceed target. |
| `capital_allocations` | Signed integer KES minor units, append-only ASSIGN (+) / RELEASE (-) records, linked to exactly one bucket or goal with workspace-composite foreign keys. No deletion or editing history. An individual target can never go negative. |
| `capital_funding_requests` | Independent, irreversible OWNER/ADMIN decision; requestor cannot self-approve. Approval must match the exact user, target and positive amount. A request can be consumed once by a uniquely indexed allocation. |
| `financial_scenarios` | Existing B0 table becomes append-only for B4 simulations, saves user-supplied assumptions and a frozen manual-ledger opening snapshot; model version `B4_DETERMINISTIC_V1`. |

**Virtual liquidity ceiling:** Assignments cannot cause combined target allocations to exceed the current POSTED manual account balance. Goal amount and per-target nonnegative limits are independently enforced. The SQL deferrable constraint validates assignments at commit and B4 application code also checks within a workspace-scoped transaction and advisory lock. A future B1 expense can lower the manual balance after an assignment: the dashboard reports **overallocated**; it does **not** rewrite earlier assignments or block an external payment.

**Approval threshold:** Once a specific bucket/goal has more than **KES 100,000** in cumulative virtual assignments (10,000,000 KES minor units), each positive increment must be accompanied by a separate approved exact-amount funding request. The server and SQL trigger both enforce it. Splitting future increments after reaching the threshold does not bypass the rule. Only a different OWNER/ADMIN may approve; single-user workspaces need another independent member for large requests. Requests have no payment authority.

**RLS & identity:** All new tables have FORCE ROW LEVEL SECURITY and active workspace membership validation. B4 writes require OWNER/ADMIN/EDITOR; VIEWER is read-only. Separate `finance_app` and `finance_auth` DB roles continue to apply: auth role cannot access ledger data. Runtime `finance_app` has narrow INSERT and lifecycle column UPDATE permissions, no DELETE. Audit events record definitions, allocation changes, requests, decisions, archives and saved scenarios.

## Authenticated B4 API

Prefix: `/v1/workspaces/:workspaceId`. All routes require a valid B1.1 authenticated identity; POST mutation routes require a 10–160 character `Idempotency-Key` (read-only affordability simulation POST is nonmutating). Error responses distinguish input validation (422), policy/approval (403), and financial constraints/replays (409).

- `GET /capital/summary` — real manual balance, virtual assigned total, unassigned arithmetic, over-allocation alerts, bucket and goal inventories.
- `GET|POST /money-buckets`, `POST /money-buckets/:bucketId/archive` — virtual envelope registry, immutable closure.
- `GET|POST /savings-goals`, `POST /savings-goals/:goalId/archive` — savings/emergency targets with dated and coverage views.
- `GET|POST /capital/allocations` — positive assignment or negative release; one-time independent approvals for large cumulative amounts.
- `GET|POST /capital/requests`, `POST /capital/requests/:requestId/decision` — request and independent governance workflow.
- `POST /capital/affordability` — unverified, non-authorizing purchase simulation exposing 90-day user-reported bill exposure, estimated yet-unreceived income, and virtual unassigned manual balance. Always returns `CANNOT_CONFIRM_AFFORDABILITY`.
- `GET|POST /planning/scenarios`, `GET /planning/scenarios/:scenarioId` — deterministic 1–24-month what-if model. User inputs: monthly income, expenses, virtual savings, one-time purchase and percentage shocks. Cash-after-expense is **distinct from** discretionary-after-virtual-savings; the savings column never reduces the posted manual cash ledger.

Machine-readable API contract: `backend/openapi/finance-os.v1.json`, operations annotated `IMPLEMENTED_B4`. The unscoped legacy `/v1/planning/scenarios` remains `PLANNED` and is not the B4 API.

## Screens 35–42

| Screen | Connected authenticated experience |
|---|---|
| 35 — Capital Allocation Command Centre | Manual liquidity vs virtual assigned and unassigned, target distribution, immutable event history and over-allocation status. |
| 36 — Allocation Rules & Money Buckets | Create purpose/priority buckets, assign or release virtual amounts, archive empty targets. |
| 37 — Savings & Financial Goals | Create SAVINGS/EMERGENCY targets; real workspace progress relative to virtual earmarks. |
| 38 — Goal Details & Funding | Select goal; assign, release or archive with idempotent and approval-gated requests. |
| 39 — Emergency Fund Management | Target and coverage months based on user-reported essential expenses, not guaranteed cash. |
| 40 — Affordability & Purchase Simulator | Advisory read-only evaluation, no purchase execution or guarantee. |
| 41 — Funding Requests & Approvals | Independent approval decisions, requester/approver separation, explicit no-money-moved labels. |
| 42 — Financial Scenario Planning | Save and review deterministic months, shock parameters, hypothetical cash and virtual-savings-adjusted balances. |

All routes use the existing premium `connected.html` design language. Public GitHub Pages defaults to `connected-config.json.apiBase=null` and intentionally fails closed until an HTTPS production API and real OIDC provider are deployed.

## Certification

Workflow `.github/workflows/backend-b4.yml` runs TypeScript build, OpenAPI validation, B0–B4 unit tests, checksummed migrations, restricted roles, previous B0/B1/B1.1/B2/B3 real-PostgreSQL regressions and the new `test:b4` suite. B4 integration verifies no-POSTED-cash funding rejection, exact-money funding and release, maximum-liquidity and goal-target checks, threshold approval, self-approval rejection, consumed-once replay denial, emergency-fund coverage arithmetic, deterministic scenario snapshots, viewer/cross-workspace denials, immutable DB triggers and unchanged journal count. Frontend syntax, connected-data-honesty checks and 60-screen browser QA are additional merge gates.

**Limitations:** The module is manual-KES-only; no currency conversion, real financial transfers, bank-reserved funds, investment returns, automated savings transfers, debt affordability certification, provider verifications, actual identity deployment, or live MFA/recovery certification. RLS and local database CI do not establish production readiness. Pagination beyond current bounded 80–150 records, disaster recovery, provider confirmation, adaptive allocation rules and a configurable approval threshold remain future production work.

**Next:** B4.1 — persistent API/real OIDC staging certification, or B5 — Debt, Tax, Insurance, Retirement and Estate Planning after operational activation.
