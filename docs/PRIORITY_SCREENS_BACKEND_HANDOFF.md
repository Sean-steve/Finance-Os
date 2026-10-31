# Finance OS — Priority Frontend Correction & Backend Handoff

**Date:** 31 October 2026  
**Correction scope:** Screen **01 → 42 → 29 → 24 → 43**.  
**Canonical branch:** feature branch merged to \`main\` after QA.  
**Frontend mode:** public static GitHub Pages **demonstration**, not a production financial product.

## Source of truth and corrections

The approved originals are \`assets/screen-01.webp\`, \`screen-42.webp\`, \`screen-29.webp\`, \`screen-24.webp\` and \`screen-43.webp\` at 1536 × 1024. The visual reference viewer (\`index.html\`) stays unchanged. The actual editable HTML/CSS/JS frontend lives at \`rebuild.html#screen/N\`.

| Order | Screen | Implemented correction | Interaction preservation |
| --- | --- | --- | --- |
| 1 | 01 — Welcome & Authentication | Source-oriented three-device design showcase, refined two-panel desktop composition, password visibility, visible prototype security caveat, responsive/mobile treatment | Existing native sign-in form and local-only onboarding flow, loading/error/success/new-user reference cards remain |
| 2 | 42 — Financial Scenario Planning | Reordered three-column scenario/projections/outcomes/builder layout; four-color SVG scenario projection chart and legend, source-conformant comparison/insight grids | Existing numeric assumption form, model recalculation, presets, save/export continue via delegated handlers |
| 3 | 29 — Income Planning & Forecasting | Source-aligned forecasting/summary/scenarios row, source table/growth plan row, monthly/mix/insight row; stacked 12-month income-source SVG | Existing income source records and local forecasting calculations remain authoritative within demonstration; no actual provider sync |
| 4 | 24 — Spending Guardrails & Purchase Approval Check | Source-led guardrail/approval/check layout, rule-type column, approval decisions reflected in queue and counters, last purchase evaluation displayed | Demo rule toggles, local approval decisions, purchase-check form remain interactive; no actual card/payment restrictions |
| 5 | 43 — Debt Management Centre | Source-aligned debt breakdown/trend/actions, commitments/progress/insight, accounts/strategy; current debt values in breakdown legend | Debt account details, optimizer routing, local repayment simulation remain |

This release uses **native DOM elements and CSS**, not a screenshot superimposed on an application. Corrections are idempotently reapplied after existing delegated-event render calls via \`rebuild/priority-screen-fidelity.js\`; visual rules live in \`rebuild/priority-screen-fidelity.css\`. Existing domain modules are preserved intact.

## Verification and acceptance boundary

- \`tests/priority-screen-fidelity.cjs\` tests the five specified screens, checks source-aligned grid names, editable form preservation, local-state decisions, scenario updates, optimizer navigation, screenshot captures at 1536 and 390px and non-overflow on mobile.
- The existing Browser UX QA workflow also exercises 60 routes, the 59 approved source images, all batch checks, visual-parity scoring and accessibility.
- **Visual correction is not pixel certification**. Human overlay approval and acceptance of the 59 original screens are still outstanding, as is the absent original asset for Screen 22. Do not call 60/60 visual reconstruction certified.
- Authentication, bank connections, M-Pesa, lender actions, approval enforcement, actual payment settlement and sensitive-record retention are **not implemented**. Do not enter real financial credentials/data in the GitHub Pages prototype.
- The scenario comparison lines use visual sensitivity assumptions and are explicitly **illustrative**. They must not be confused with audited forecasting engines or promises of return.

## Recommended backend direction

**Use a modular, API-first monolith for Finance OS v1**, with clean domain boundaries and strict data contracts; avoid independently deploying a separate microservice for every screen. Suggested stack: **TypeScript/Node.js** (e.g. Fastify/NestJS) with **PostgreSQL**, a migration system, background job queue, and a separately deployed API. Keep the currently published static UI as a review environment until production login and finance data boundaries are established.

### Backend delivery stages

1. **Foundation & identity:** private environment/secrets; accounts and household/workspace ownership; secure real login, MFA and session rotation; scoped APIs; tenant isolation; audit trails; OpenAPI and frontend error/loading contracts. Replace demo auth *only after* the security gate passes.
2. **Canonical financial data:** currency as integer minor units, source accounts, transactions, categories, double-entry postings, immutable reconciled entries, CSV imports with deduplication, idempotency keys and invariant tests. Distinguish pending, verified and estimated balances.
3. **Financial obligations & rules:** budgets, savings allocations, bill schedules, the source-backed Screen 24 rules/purchase check, approvals, evidence and decision logs; only server-authoritative decisions may enforce financial constraints. No payment blocking without a supported provider.
4. **Planning engines:** income planning (29), scenario projections (42) and debt schedules (43) use versioned snapshots of the same canonical ledger. Persist assumptions and distinguish known cash flows, forecasts and simulations, without mutating ledger balances.
5. **Provider integrations & production hardening:** optional bank/M-Pesa integrations only after consent, security review, verified webhooks, retry/idempotency, encryption and record-level audit. Add reconciliation, migration rehearsal, backups, monitoring, API contract/E2E and disaster recovery gates.

### Backend non-negotiables

- Never use \`localStorage\` as authoritative financial storage.
- Never trust frontend amounts, spending rules, approval status or user IDs without server authorization and consistency checks.
- Never mix demo/projection data with confirmed bank data in the same balance calculations.
- Keep currency units, posting dates, time zone and transaction provenance explicit. Support Kenya/KES from the start, with future multicurrency expansion designed up front.
- Provide a one-time import/migration strategy for users who opt in; do not automatically import prototype data or carry over its unverified financial records.
- Avoid storing passwords, access tokens, signed provider callbacks or card credentials in GitHub Pages/browser scripts.

**Recommended starting sprint:** Backend Sprint B0 — Architecture, domain boundaries, data contracts, identity posture, infrastructure and CI; then B1 — secure account/transaction/ledger core. Postpone integrations until B0/B1 certification.
