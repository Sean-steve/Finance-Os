# Finance OS V3 — UX2.1 Financial Workflow Parity and Local Certification

**Code branch:** `phase-ux2-1-financial-workflow-parity`  
**Primary objective:** Complete the existing B1–B8 **manual-data** financial workflows inside the premium V3 React shell without restoring numbered prototype pages, and certify a real PostgreSQL 17 + Chromium golden journey.

## Verified in disposable CI

**Finance OS V3 UX2 React Build and Contract** (PR checks, run **43396927862**, November 13, 2026): both **PASS**:
- Strict React 19 / TypeScript build and Vite asset build.
- UX2 original contract + UX2.1 advanced-workflow safety contract.
- No synthetic financial balances in the connected React app; no browser-side payment initiation or bank authentication.
- All finance mutations use the selected authenticated workspace ID, independent idempotency keys, and backend-enforced validation.
- The React browser flow runs against a **real PostgreSQL 17 container** and the actual B8 Fastify API. It does not intercept/mimic/mount JSON fixtures in place of the API.

**Actual Chromium flow covered:** new local test identity and workspace → manual account → income/expense categories → posted manual income and expense → verified derived account position → budget create → bill create → virtual savings goal → owner B8 manual ledger check → second isolated workspace with no leaked records → back to original account → **bill settlement linked to an existing posted expense** → budget activate/archive → **compensating transaction reversal** with consistent manual balance → estimated asset create → new valuation history entry → privacy status view → responsive 390px screenshot/no horizontal overflow → logout and refreshed auth denial.

The API exposed a real rate-limit issue during initial accelerated test runs (HTTP 429): all active queries were being broadly refetched after each mutation. UX2.1 now marks the selected workspace cache stale, refreshes only affected active queries, and skips unrelated account/category/goal form queries. Full CI subsequently passed **without raising the API rate limit**. This is a useful regression and performance guard.

## Delivered V3 modules (workflow centre)

The new `Workflow tools` button opens a **progressively disclosed** drawer; the daily Home dashboard remains concise.

| Area | Implemented V3 functionality | Boundaries / backend rules |
|---|---|---|
| Activity | POST immutable transaction reversals; imported statement row + manual transaction reconciliation; posted journal summary | Compensating journal, no destructive edits or real bank payments |
| Spending | DRAFT→ACTIVE→ARCHIVED budget lifecycle, create/deactivate guardrails, internal approval request and independent OWNER decision, advisory purchase checks | Approval self-decision rejected by API; rule enforcement applies to manual postings only |
| Cash Flow | Due occurrence calendar, bill details/settlement evidence history, evidence link to an existing posted expense, cancel active bill, disable projected income source | No actual bill payment or income receipt is created |
| Goals | Virtual funding requests/independent decision, allocations, conservative affordability simulation, saved scenario details | No real money moves; affordability never certifies available funds |
| Wealth | Append manual asset/investment/liability valuation history, link existing posted expenses as debt/tax payment evidence, owner-only estate review snapshots | Estimated market value, not verified by broker, insurer, lender, tax office, lawyer or custodian |
| Settings | Owner financial settings snapshot, privacy request status, provider integration catalog, workspace security audit view | No external bank syncing, automatic deletion, live provider MFA, or eTIMS/KRA filing |

Every financial mutation is subject to explicit impact acknowledgement in the advanced drawer, with financial record changes submitted **only after user action**. The Fastify/PostgreSQL financial ledger and RLS remain authoritative; frontend code never calculates an alternative durable ledger.

## Local testing on Ubuntu

The existing backend MUST first pass:

```bash
cd ~/Sites/Finance-Os/backend
curl -fsS http://127.0.0.1:3101/health/ready
curl -fsS http://127.0.0.1:3101/v1/meta
```

Required for local password tests: API `authenticationScope: LOCAL_TEST_ONLY`, `authenticationAvailable:true`, and actual PostgreSQL roles and migrations (do not change production OIDC settings for local convenience).

Launch V3:

```bash
cd ~/Sites/Finance-Os
git pull origin main
cd ux2
npm install
npm run build
npm run dev
```

Then open **http://127.0.0.1:5173/**. In the connected command centre, use the top-right **Workflow tools** for advanced actions. Login or register a **test identity only**. The old Python server on port 8080 still serves historical UX1 and the legacy prototype; it is not V3.

Recommended hands-on cross-domain check:

1. Create a manual KES account, expense category and expense record. Confirm posted account balance and KES minor units in Activity/Home.
2. Schedule a bill for the same expense amount and valid due date. Under Cash Flow → Workflow tools, link the **existing** expense as manual settlement evidence. Check the bill occurrence status; verify no extra payment/expense was created.
3. Reverse the exact posted expense from Activity → Workflow tools. The ledger balance must change by the correct amount and the bill settlement must be marked **REVERSED** or reappear due in the occurrence list; no row may be silently deleted.
4. Create an expenditure budget, activate it and archive it; verify state transitions. Add a warning/approval guardrail, evaluate a proposed manual purchase, and confirm the **not a bank authorization** disclaimer.
5. Create a savings goal and request virtual allocation. A separate permitted approver is required for independent approvals, and the API must reject self-approval.
6. Add a reported asset, record a subsequent valuation, check the append-only estimate history, and confirm that Wealth continues to label net worth **estimated**.
7. Verify a second workspace displays no records from the first; sign out and refresh, confirm authenticated records are hidden.

Never use real personal/bank data or financial credentials in the local demo.

## What local CI does NOT certify

The green workflow is **a significant real E2E slice**, not universal coverage of every control. Still requiring independent evidence or further tests:
- Browser certification of **each** secondary mutation, denied-role/self-approval paths, overspending guardrails, cross-tenant failures and locked/expired/replayed idempotency scenarios (the backend has separate B0–B8 tests; they should also be run when release gating).
- Automated WCAG/axe screen-reader and keyboard audit **across all dialogs**, 320px/tablet/desktop, measured p95 API and frontend performance.
- Verified production provider OIDC MFA on a real HTTPS identity domain, dedicated PostgreSQL 17 staging host, production DNS/TLS, operations monitoring/backups/DR and DPIA/privacy/legal regulatory signoff.
- Provider payments, provider-verified balances, banking/M-Pesa/market data, KRA filing and automatic privacy erasure were **never** available features and must not be represented as operational.
- Human first-time-user usability tests and investor product-market validation.

Accordingly, classify this phase as **UX2.1 implementation and real local golden flow CERTIFIED**, **complete 60-screen migration audit / production certification PENDING**. Do not use the green CI result to override B8 staging/production release blockers. Track remaining gates in issue **#35**.
