# Finance OS V3 — UX2 React / TypeScript Authenticated Application

**Delivery status:** UX2 engineering branch, integration certification still in progress. This is **not** the synthetic UX1 prototype. It uses the existing Finance OS B1–B8 financial API and the locally running PostgreSQL database. Do **not** treat it as production ready without live identity/infrastructure/privacy evidence and real E2E certification.

## Run locally on Ubuntu — from the Finance-Os repository

Prerequisites: backend PostgreSQL 17, migrations, separate `finance_app` and `finance_auth` roles, `LOCAL_AUTH_ENABLED=true`, Node 22+, and a running API on `127.0.0.1:3101`.

Terminal 1 (existing backend; keep the same secrets and environment where the backend already reports READY):

```bash
cd ~/Sites/Finance-Os/backend
npm run dev
curl -s http://127.0.0.1:3101/health/ready
curl -s http://127.0.0.1:3101/v1/meta
```

Expected API meta: `financialEndpointsAvailable=true`, `authenticationAvailable=true`, `authenticationScope=LOCAL_TEST_ONLY`.

Terminal 2:

```bash
cd ~/Sites/Finance-Os
git pull origin main
cd ux2
npm install
npm run dev
```

Open **http://127.0.0.1:5173/** — **not** `/` on the Python 8080 prototype server.

The Vite local development proxy forwards `/finance-api/*` privately to `127.0.0.1:3101/*`; it removes the browser Origin header on the upstream hop because the browser is talking same-origin to localhost:5173. The API remains bound to localhost. **Do not use this proxy for public network access or production.** Never alter local backend `CORS_ALLOWED_ORIGINS` just to make the Vite frontend work.

This UX2 app is separate from:
- `/v3/` — UX1 Pages demo with **synthetic** figures, no database.
- `/connected.html` — B8 connected V2 UI on the Python 8080 server.
- `/` — original approved screenshot navigator.
The UX2 app intentionally does **not** have bank login fields, demo records, external accounts or payment buttons.

## What is connected

| Area | Real-data reads | Recorded mutations in UX2 |
| --- | --- | --- |
| Identity/workspaces | meta, /me, /workspaces; local session or OIDC PKCE MFA | local dev register/login/logout, create workspace |
| Home | manual accounts, posted ledger, recorded transactions, report history, bills, goals | contextual actions |
| Activity | accounts, categories, transactions, ledger summary, reconciliation | manual accounts, categories, posted transactions, statement staging, match |
| Spending | budgets, spending insights, guardrails, approvals | create budget, create WARN guardrail |
| Cash Flow | bills, income sources, 90-day forecast, risks | create bill, create expected income |
| Goals | savings goals, money buckets, virtual allocations, scenarios, capital requests | create goal, bucket, virtual allocation, scenario |
| Wealth | estimated net worth, assets, investments, liabilities, debts, tax, insurance, retirement, estate | create asset, investment, liability, debt, tax, insurance, retirement estimate |
| Insights | B7 monthly reports, category reports, health, rules-only advisor | read-only reporting |
| Settings | identity, workspace, privacy, integration information requests, audit | create workspace, request review, request provider information; owner-initiated B8 integrity check |

**Explicitly not implemented end-to-end by this phase:**
- B1 transfers/actual payments (not implemented by backend); no bank/M-Pesa source authentication, live provider sync or independently verified balances.
- All advanced financial mutation flows (transaction reversal, budget activation/archive, bill settlement evidence, debt/tax payment linking, cross-portal approval decisions, valuation history and estate follow-up). Some have backend endpoints but do **not** yet have dedicated V3 UX2 controls; require acceptance testing before calling all 60 original functions migrated.
- Real production OIDC MFA provider activation, staging hosting/HTTPS/DNS/backup operations, independent investor and regulatory evidence.
- Complete live-browser CI with actual PostgreSQL end-to-end testing until added and passed. TypeScript build + contract checks alone are not an E2E certification.

## Manual golden test (synthetic financial data, real local database)

1. Open `http://127.0.0.1:5173`, register a **fresh test-only** identity or sign in with an existing dev identity.
2. Add a `BANK` manual account. Verify the account begins with **zero recorded balance** and is labeled manual.
3. Add an `INCOME` category ("Salary"), and an `EXPENSE` category ("Groceries").
4. Post KES 100,000 of *test income*, then KES 2,500 of *test expense*. Confirm Activity and Home show the updated manual ledger position (KES 97,500 for the new account if no prior entries), and reports show the activity with the correct period and currency.
5. Create a budget using Groceries category, a bill and a savings goal. Verify each appears in its respective module and persists after browser reload/sign-in again.
6. Add a user-reported asset estimate. Wealth should now label derived net worth **estimated**, never a bank-confirmed market valuation.
7. Open Settings → Security as an OWNER, manually trigger the B8 integrity check. Inspect returned `PASS_MANUAL_LEDGER` or `INSUFFICIENT_EVIDENCE`; neither means bank reconciliation.
8. Create another personal workspace; its accounts and transactions must be empty. Switch back; original records must remain. Inspect network requests: workspace IDs in URLs must match the selected workspace. If any records leak between workspaces, **STOP and report**.
9. Sign out, verify financial content is hidden and TanStack Query cache cleared. On full refresh, authentication is required again (tokens are memory-only). A VIEWER must not be able to write.
10. Verify failures: stop API and refresh page, expect a clear retry error—not zeros or synthetic sample data.

**Limitations:** This is a suggested local manual test, not a claim that every step has passed in the user's environment. Use no real bank passwords or private customer data. Do not port credentials to GitHub Pages.

## UX1 design consistency

The UX2 app imports its **own copy** of UX1 visual tokens in `src/base.css` plus additional live-data styles in `src/styles.css`. It uses React Router for eight destinations, TanStack Query for explicit workspace-scoped reads with invalidation after writes, Recharts for ledger-backed income/expense history, and accessible reusable cards, lists and focus-managed drawers.

- No numbered sidebar or "Welcome & Authentication" menu item.
- Account setup/authentication is outside the main application shell.
- Empty/error/loading states never silently import UX1 demonstration records.
- All transactions are idempotent manual ledger POSTs; provider verification labels never inferred.
- Legacy V2 and UX1 remain untouched for rollback and visual comparison.

## Release gate

`npm run build` must pass strict TS and Vite build. `node tests/ux2-contract.cjs` must pass. GitHub Actions runs both. A real local PostgreSQL/browser verification log, security/role and OIDC provider certification, full B0–B8 backend regression, cross-module accounting reconciliation, performance/a11y and actual user usability review are separately required before declaring all UX2 complete.

Never set `apiBase` to a public endpoint without authenticating with an approved OIDC MFA provider, HTTPS, DNS, security monitoring and privacy release checks. `public/config.json` is a public **nonsecret** configuration stub and intentionally has `apiBase:null`; production fails closed until configured on an approved host. UX2 is **not automatically deployed to GitHub Pages**, since the static public demo cannot serve an authenticated backend.

## Further implementation work to close UX2

1. Certify new React V3 frontend against real local PostgreSQL (Playwright golden flow plus forbidden/tenant cases), not mocked fixture UI only.
2. Add the remaining high-risk secondary workflows with confirmation, server authority and source tagging.
3. Verify auth token expiration and OIDC callback on an actual test identity provider; require fresh MFA and CORS approval.
4. Run responsive/accessibility/usability sessions and record measured performance; UX1 design validation remains open.
5. Complete production environment/evidence only after controlled staging activation.

These are not silently rolled into build-passing status.
