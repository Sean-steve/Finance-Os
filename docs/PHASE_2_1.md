# Phase 2.1 — Complete Screen-Level Reconstruction

## Source of truth

- The original design collection contains 59 screen images; **Screen 22** did not have a separate PNG and was reconstructed in HTML.
- All **60 named destinations** have dedicated primary rendering logic or a uniquely composed workflow screen, with responsive contextual tabs, real HTML controls and shared local demo state.
- Every screen is reachable from the navigation rail, global screen search or nine guided user journeys.
- The reconstructed UI is visually consistent with the original Finance OS vocabulary (light dashboard, green/blue visual hierarchy, KPI cards, tables, charts), but it is **not yet pixel-identical** to each visual reference.

## Implemented workflows

1. Welcome/onboarding/profile and account setup.
2. Manual accounts, transaction ledger, transaction details/editing, CSV importing, internal transfers and local reconciliation review.
3. Spending intelligence, category budgets, guardrails, subscriptions, recovery planning, safe-to-spend allowance.
4. Income sources, planning assumptions, bills, upcoming obligations and cash-flow simulations.
5. Capital allocation, money buckets, goal funding, emergency reserves and purchase affordability.
6. Funding requests with simulated approval/rejection, debt records, payoff priority comparisons.
7. Financial protection, tax, estate and retirement guidance screens. No unverified legal/tax computations or fake provider integrations.
8. Net worth, asset inventory, investments coverage, financial health, report exports, advisor demonstration, privacy controls and activity history.

## Interaction integrity

- Screen 12 transaction form persists records into the same shared ledger used by Screens 04, 05, 10, 16, 27, 32, 56 and 58.
- Screen 22 category budgets persist and affect all spending metrics.
- Internal transfers move demo cash between personal accounts without creating an income or expense.
- Business account balances remain excluded from personal aggregates.
- Global hash-route navigation and contextual tab-switching work without a server.
- Financial calculators are **illustrative**, with risks and limitations identified in the UI.
- All records are **demo data stored in localStorage**; private real financial data should not be entered.
- GitHub Actions runs syntax and screen state smoke tests before uploading public assets.

## Current UI limitations and remaining polish

- Several advanced sections deliberately show blank/not-connected states until trustworthy financial data is supplied; they do not invent holdings, insurance policies or bank balances.
- Forms and charts are functional demonstrations, not authoritative accounting, tax, investment or financial-advice engines.
- A full accessibility audit, pixel-by-pixel reference review, and comprehensive mobile/E2E browser automation remain outstanding.
- The static GitHub Pages site **cannot** provide authentication, database persistence, secure financial records, background processing, statement reconciliation against bank records, AI inference or actual payment movement.
- A later production phase must implement RBAC, encryption, event logs, and provider-approved integrations before sensitive data is accepted.

## Deployment

The workflow in `.github/workflows/pages.yml` builds a minimal static artifact containing only:
`index.html`, `src/app.js`, `src/styles.css`, `.nojekyll`.

On pushes to `main`, the workflow checks JavaScript syntax and UI smoke tests, then attempts a GitHub Pages deployment.

Repository owner must configure **Settings → Pages → Build and deployment → Source: GitHub Actions** if Pages has not been activated. Do not assume the site is live until the deployment job succeeds.

Expected URL once published: `https://sean-steve.github.io/Finance-Os/`.
