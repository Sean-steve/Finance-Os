# Finance OS — Screens 01–60 to Backend Capabilities (B0 design)

This is a **contract map**, not a declaration that the endpoints work.

| Screens | Responsibility | Backend ownership | Phase |
|---|---|---|---|
| 01–03 | Signup, login, onboarding, profile | identity, workspace, consents | B1 |
| 04–06 | Command centre, safe-to-spend, calendar | ledger derived summaries, budget snapshot, bills | B1–B2 |
| 07–09 | Accounts and linking | financial accounts, provider status, verification | B1 / B4 for providers |
| 10–15 | Transactions, transfers, import, reconciliation | double-entry journal, idempotency, import provenance | B1 |
| 16–20 | Spending intelligence and leaks | categorized ledger aggregates, rules and heuristics | B2 |
| 21–26 | Budget, allowance, guardrails, subscriptions, recovery | budgets, guardrails, approvals and advisory outcomes | B2 |
| 27–34 | Income, obligations, cashflow and forecasts | income source registry, bill obligations, versioned forecast | B2–B3 |
| 35–42 | Allocation, goals, emergency reserves, purchases, scenarios | allocations, bounded simulations, source-linked scenarios | B3 |
| 43–45 | Debts and repayment simulations | liabilities, amortization and estimated schedules | B3 |
| 46–49 | Tax, insurance, retirement, estate | records, explicit estimates, consent and legal disclaimers | B3–B4 |
| 50–55 | Assets, investments, net worth, wealth insights | valued positions with timestamps and sources | B3–B4 |
| 56–60 | Health score, AI advisor, reports, integrations, security | transparent evidence, governance, reporting, identity logs | B4 |

## Integration rules

- Each UI screen uses API data with explicit loading, empty, stale, error and unauthorized states. There is **no silent fallback to fixture localStorage as if verified**.
- Cross-screen state derives from a single ledger and versioned projections. Wallet and asset balances must reconcile after transfers, funding and repayment events.
- No frontend action can claim to have blocked payments, paid bills, purchased securities, repaid loans, filed taxes or activated coverage without an authoritative service and receipt.
- Financial scenario (42) and income forecast (29) always show source snapshot, currency, time horizon, model version and assumptions. Debt management (43) shows verified/manual/estimated origin separately.
- Guardrail decision (24) is advisory until a supported payment provider supports authoritative enforcement.
- Authentication (01) stays visually consistent but must replace local demo sign-in with a secure B1 identity flow. Never ship real login on GitHub Pages with client-side credentials.
- Privacy/security (60) must handle data export, deletion, audit visibility, role enforcement and provider consent when backend work reaches B4.
