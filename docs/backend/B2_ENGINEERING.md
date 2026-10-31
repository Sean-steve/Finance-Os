# Finance OS Phase B2 — Budgets, Spending Intelligence, Guardrails and Financial Controls

**Implementation contract:** B2 activates PostgreSQL-backed budgeting and manual transaction governance. It extends B0–B1.1 and never creates balances, fictional spending data, payment events, provider statements or automatic financial forecasts.

## Delivery status and risk boundary

- Workspace category budgets can be drafted and activated. Each budget has an immutable definition, revision number, period, KES limit and expense-category allocations. The user cannot silently edit an activated budget: a new budget must be created and conflicts reviewed.
- Spending intelligence is calculated from **POSTED, double-entry journal-backed manual transactions only**; expense reversals compensate the original entry without mutating any posted financial record.
- User-entered expense descriptions may indicate possible recurring activity, but **cannot prove a merchant, subscription, transaction identity or provider confirmation**.
- Guardrails currently support only **AMOUNT** and **CATEGORY** conditions and actions WARN, REQUIRE_APPROVAL, BLOCK. Unsupported merchant, geo, time, or recurring signals must not be fabricated.
- A read-only purchase check returns advisory decision, matched policies, and budget warnings. It never authorizes or moves money, and it cannot block an actual payment outside Finance OS.
- The real **manual expense-posting API** also enforces BLOCK and REQUIRE_APPROVAL: no silent bypass through direct REST calls. All matching REQUIRE_APPROVAL rules must have their own independently approved request ID; an approval is consumed **once only** by an immutable financial record.
- Approval decisions require a different active workspace **OWNER or ADMIN** from the requestor. Self approval, replay with new idempotency key, revision of a final decision, and crossing workspace boundaries are rejected.
- Budget utilization is **not a safe-to-spend calculation** because cash balances and obligations are not provider-verified. It represents posted manual category allocations only.
- The B2 connected frontend activates Screens **16–26** with appropriately scoped and evidence-limited experiences. No backend modules exist yet for automatic subscription cancellation, merchant identification, verified available funds or external card/bank/payment gateways.

## Database and invariants

- Migration: `backend/db/migrations/006_b2_spending_controls.sql`.
- Existing tables: `budgets`, `budget_allocations`, `spending_guardrails`, `approval_requests`. Preserves B0/B1 tables, RLS, double-entry journals and checksummed migrations 001–005 unchanged.
- New `spending_approval_consumptions` links approved authorization requests to posted manual transactions, with a composite workspace FK and unique constraint ensuring an approval cannot be consumed twice.
- Database triggers: immutable budget economics, versioned status transitions, no category overlap across active budgets in overlapping periods, sum of allocations <= budget amount, and one-time independent approval decisions.
- Runtime permissions: `finance_app` may SELECT scoped records, INSERT controlled financial records, UPDATE only budget status/version and approval decision columns, and cannot DELETE or modify posted ledger history. `finance_auth` has no ledger privileges.
- All new data is protected by explicit row-level security policies checking authenticated actor workspace membership. Migrator-only functions are not a user-facing API.
- Idempotency-Key mandatory for every mutating B2 endpoint, including budget activation and approvals. Same key + same request gives replay; same key + different request is rejected.
- Money: **integer minor KES units** only for B2. No mult-currency conversions, fractional minor units, FX assumptions or floating point monetary calculations.
- Audit events record rule creation, budget creation/activation, approval requests/decisions and approved/blocked financial operations. Blocked attempted writes roll back without producing money records.

## API contract (workspaceId is always authenticated and RLS-scoped)

| Method and path (prefix /v1/workspaces/:workspaceId) | Purpose |
|---|---|
| GET /budgets | Period, version, category allocations, ledger-backed spent/remaining |
| POST /budgets | Draft with category allocations, KES limit, period |
| POST /budgets/:budgetId/activate | Immutable lifecycle activation with database overlap guards |
| GET /spending/insights?months=1..12 | Net monthly and category expense totals, repeated description review suggestions |
| GET /spending/guardrails | Active manual financial posting policies |
| POST /spending/guardrails | Create AMOUNT/CATEGORY WARN/REQUIRE_APPROVAL/BLOCK rules |
| POST /spending/purchase-checks | Preview; **no financial movement and no authorization** |
| GET /spending/approvals | Workspace approval queue |
| POST /spending/approvals | Request independently approved expense |
| POST /spending/approvals/:requestId/decision | Independent owner/admin decision |
| POST /transactions (existing B1) | Enforces B2 guardrails, consumes all matching approvals once |

The complete machine-readable contract is `backend/openapi/finance-os.v1.json`. All B2 routes have `x-implementation-status=IMPLEMENTED_B2` (do not conflate with legacy planned routes).

## Authenticated frontend screens

| Screens | B2 implementation |
|---|---|
| 16–18 | Real category and period spending intelligence |
| 19 | Evidence-limited repeated merchant/description review; no verified merchant classifier |
| 20 | Potential recurring expenses from user-entered descriptions; not actual subscriptions |
| 21 | Budgets, spend, lifecycle activation and posted allocation utilization |
| 22 | Multi-category budget builder with expense category allocations |
| 23 | Allocation allowance, explicitly **not** bank-verified safe-to-spend |
| 24 | Create guardrails, evaluate proposed expense, request independent approvals, decide when authorized |
| 25 | Potential recurring descriptions review; no actual subscription management |
| 26 | Spending review/recovery suggestions driven by over-budget allocations and repeat descriptions |
| 01–15, 27–60 | Existing authenticated integrations and honestly unimplemented modules preserved |

The earlier static `rebuild.html` 60-screen visual prototype remains separate and contains demo state. The connected `connected.html` never imports prototype balances.

## Certification

1. `npm --prefix backend run build` and `npm --prefix backend run contract:check`.
2. `npm --prefix backend test`: deterministic rule precedence/unknown conditions, existing OIDC cryptographic verification, auth and B0/B1 contracts.
3. Apply checksummed migrations, provision restricted roles, then `npm --prefix backend run test:db`, `npm --prefix backend run test:b1`, `npm --prefix backend run test:oidc:db` and **`npm --prefix backend run test:b2`** against disposable PostgreSQL 17.
4. B2 integration asserts budgets and overlap rejection, idempotency, tenant access denial, expense and reversal arithmetic, unsafe spending blocks, self-approval denial, independent decisions, and consumed-once approvals.
5. `node tests/connected-contract.cjs` and `node tests/connected-browser-qa.cjs` validate data separation, static 60-route integrity, B2 screen wiring, no fake bank data, and responsive safe failure when no backend is configured.
6. Actual hosted IdP and operational readiness are **separate production gates** and cannot be certified from green repo CI alone.

## Known limitations and following domains

- No external bank verification, M-Pesa deposits, merchant reconciliation, online payment authorizations, subscription provider sync or purchase blocking at the bank/card network.
- No merchant-specific detection or AI-generated financial advice. Repeated descriptions are **review suggestions** only.
- No budget rollover despite schema compatibility; B2 validates rollover=false.
- No automatic repair of overspent budgets and no manipulation of booked finances to meet targets. Income/cashflow, liabilities and savings require their own domain-specific authoritative APIs.
- No production IdP configuration or production backend deployment yet. See `OIDC_KEYCLOAK_ACTIVATION.md` for the real provider test environment and operator activation checklist.

**Next phase:** B3 — Income, Bills, Cash Flow, Accounts & Provider Integration; then B4 — Money Buckets, Goals & Capital Allocation.
