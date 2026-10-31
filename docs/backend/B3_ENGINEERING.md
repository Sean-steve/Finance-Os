# Finance OS — B3: Income, Bills, Cash Flow and Financial Obligations

## Scope and non-negotiable financial authority

**B3 is a financial-planning and manual-transaction evidence module, not a bank/payment integration.** It extends the signed, immutable B1 journal and the B2 budget/approval controls. All amounts in B3 are integer **KES minor units**. Only `POSTED` manual double-entry journals count as recorded income, expenses, or a manual account balance. No income forecast, recurring schedule or user-reported obligation creates or moves money.

**Terminology matters:**
- **Recorded income**: existing posted manual INCOME journal, net of any posted reversal; does not claim provider confirmation.
- **Expected income**: user-entered cadence and amount, never a receipt or cash balance.
- **Bill / financial obligation**: user-reported schedule; it is not a creditor-confirmed invoice or executable mandate.
- **Recorded bill settlement**: an explicit association to a previously POSTED manual expense of the exact bill amount, expense category and currency. It is **unverified**, not bank evidence of payment.
- **Indicative cash-flow forecast**: manual posted asset balance as of date, plus future expected income, minus upcoming unpaid reported obligations. It is not net worth, financial runway certified by a bank, safe-to-spend cash, or guaranteed solvency.

## Backend and persistence

**Migration:** `backend/db/migrations/007_b3_income_bills_cashflow.sql`, forward-only, checksum enforced, prior migrations 001–006 unchanged.

| Entity | Authority and invariants |
| --- | --- |
| `income_sources` (extends B0) | Immutable currency, amount, cadence, category and first/last expected date; explicit `USER_ESTIMATE` origin on B3-created sources; one-way enabled → disabled with version increment and audit event. Existing workspace policies replaced with active member+role RLS. |
| `bills` (new) | Composite workspace/category FK, integer positive KES value, name, optional payee label, ONCE/WEEKLY/MONTHLY/QUARTERLY/YEARLY recurrence, first/last due date, immutable economic terms; one-way ACTIVE → CANCELLED. |
| `bill_settlements` (new) | Composite workspace/bill and workspace/manual-transaction FKs. One manual transaction may be linked once, and at most one non-reversed settlement exists per bill due date. Status RECORDED → REVERSED is allowed only when an authoritative B1 POSTED reversal exists. No deletion or arbitrary settlement edits. |
| `journal_entries`, `journal_lines` (B1) | No B3 writes. All monetary evidence derives from existing immutable balanced postings. B1 expense reversal automatically marks the matching bill settlement REVERSED in the same database transaction and audits both events. |
| `idempotency_records`, `audit_events` (B0/B1) | All mutating routes use Idempotency-Key and workspace/actor-bound audit events; replays return prior records, conflicting reuse rejected, posted monetary records untouched. |

**Roles:** `finance_app` receives only the necessary INSERT and limited status/version UPDATE grants, with RLS and verified workspace membership. `finance_auth` retains no financial-domain privileges. VIEWER may read, never write. Direct cross-workspace record access returns 404, and composite FKs prevent linking an obligation to another workspace's expense.

**Evidence and reversals:** A user may link one existing POSTED B1 expense (kind EXPENSE, category and exact signed amount match, KES, not reversed) to one generated due occurrence. This does not initiate a transfer or duplicate the expense journal. The original settlement remains an auditable historical row when reversed; another new eligible expense may then settle the due occurrence. A journal reversal never silently changes the original journal.

## Recurrence and cash-flow computation

- Calendar recurrence is anchored to the original day, with end-of-month clamping: Jan 31 → Feb 28 (Feb 29 in a leap year) → Mar 31. WEEKLY means exactly seven UTC date-only days; QUARTERLY and YEARLY use anchored calendar months. VARIABLE is a **single dated estimate**, not fabricated recurring deposits.
- All upcoming schedule dates are generated **on read**, within explicit bounded horizons. Income forecast: 1–180 days; cash-flow forecast and shortfall: 1–180 days; cash-flow history: 1–365 days; bill calendar: maximum 366 days.
- Bill calendar distinguishes `DUE_UNVERIFIED`, `OVERDUE_UNVERIFIED` and `RECORDED_UNVERIFIED`. Cancellation removes future occurrences without rewriting historical settlements. The default calendar covers 30 days past and 90 days ahead.
- The **starting balance** comes from POSTED journal lines on manual, non-archived KES CASH/BANK/MOBILE_MONEY asset accounts, limited to entries with economic date on or before the as-of date. It is not a bank-confirmed balance.
- Future income comes **only** from enabled user-estimated source schedules and is not posted. Future bill exposure comes **only** from unrecorded, non-cancelled user-reported obligations and is not posted. Recorded bill settlements are excluded from future due projections. No synthetic loan repayments or invoice charges are assumed.
- Overdue unpaid obligations from the **last 366 days** are a separate unverified exposure; they are **not** injected into today's journal or double-subtracted in the future event timeline. `endingAfterOverdueExposureMinor` explicitly stress-tests that separate amount.
- Forecasts may overlap manually posted future-dated records or income expectations not fulfilled. They explicitly disclose this limit, and negative projected balances are advisory warnings, not automatic expense blocks or automated creditor payments.
- Historical timeline counts only POSTED manual transactions by economic date, with income and expense reversals compensating their original categories in the reversal date. No inferred provider or external cashflow is invented.

## Authenticated API

All paths have prefix `/v1/workspaces/:workspaceId`, require a validated OIDC/session identity and active workspace membership; every write is idempotent and audited.

| Method | Route | Outcome |
| --- | --- | --- |
| GET / POST | `/income/sources` | List / create immutable user-estimated income schedules |
| POST | `/income/sources/:sourceId/disable` | Disable expectation without touching recorded income |
| GET | `/income/overview?months=6` | Actual journal-backed recorded income and separately labeled estimates |
| GET | `/income/forecast?days=90` | Dated, unreceived user-estimated income only |
| GET / POST | `/bills` | List / create user-reported financial obligations |
| GET | `/bills/calendar?from=...&to=...` | Generated dues with recorded-vs-unverified status |
| GET | `/bills/:billId` | Obligation terms and settlement history |
| POST | `/bills/:billId/cancel` | Stop future dues without rewriting history |
| GET / POST | `/bills/:billId/settlements` | View / link eligible POSTED manual expense to due occurrence; no payment execution |
| GET | `/cash-flow/timeline?days=90` | Daily manual ledger net income and expenses, historical |
| GET | `/cash-flow/forecast?days=90` | Illustrative event projection with manual baseline and clearly separated overdue exposure |
| GET | `/cash-flow/shortfalls?days=90` | Read-only conservative risk flags and verification suggestions |

Machine-readable schemas: `backend/openapi/finance-os.v1.json` with B3 operations marked `IMPLEMENTED_B3`. Legacy global `/v1/income/*` paths remain `PLANNED`, not silently assumed to be implemented.

## Screens 27–34: connected experience

| Screen | Connected B3 UI behavior |
| --- | --- |
| 27 — Income Dashboard | Real manual POSTED net income and monthly entries; planned sources separately labeled as estimates |
| 28 — Income Sources | Source registry, estimated amount/cadence/dates, create and one-way disable |
| 29 — Income Planning & Forecasting | Date-based upcoming USER_ESTIMATE expectations; explicit NOT RECEIVED labels |
| 30 — Bills & Obligations | Active/cancelled scheduled bills, overdue and upcoming exposure, create/cancel actions |
| 31 — Bill Details & Payment | Details and due occurrences; links an already-POSTED eligible manual expense. **No actual payment action.** |
| 32 — Cash Flow Timeline | Historical posted manual journal income, expense, and net totals |
| 33 — Cash Flow Forecast & Runway | Estimated source receipts, unverified future bills, manual starting balance and indicative end; **not safe-to-spend or guaranteed runway** |
| 34 — Cash Shortfall Recovery | Conservative exposure flags and review checklist only, no automatic transfers/financial advice |

All authenticated data is sourced from the current workspace API, with error-state fail-closed behavior; no demo localStorage fixtures. The original `rebuild.html` visual 60-screen prototype remains separate and should not be mistaken for a production-verified accounting UI.

## Engineering certification and operational gaps

**Automated gates:** strict TS build, OpenAPI structure/operation-status validation, deterministic anchored recurring calendar/leap-year/variable-income unit tests, B0–B2 regression suite, distinct PostgreSQL roles, checksummed migrations, and **B3 disposable PostgreSQL integration** for:
- Income estimates not credited to actual income, source create/disable and idempotency, invalid category and unsupported currency.
- Bill recurrence and obligation calendar, expense/category exact-match settlement, rejection of unmatched/duplicate/foreign-workspace records.
- Compensating posted journal reversals automatically re-opening the bill and preserving historical settled/reversed rows.
- Cashflow actual vs projected differences, unverified risk posture, cancellation, independent RLS/VIEWER permissions and immutable financial terms.
- Authenticated 60-route connected frontend syntax, data-honesty contract and browser regression.

**Not supported or certified:** production OIDC MFA/recovery and deployed finance API (still pending from B1.1), provider-confirmed balances, automated deposit detection, bill payment scheduling, external payment methods or standing orders, partial settlements, overdue older than 366 days in risk exposure, creditor verification, bank reconciliation evidence of payment, FX, unrecorded bank transactions, payroll/tax calculation, actual debt obligations, or financial advice. Reader APIs use bounded rows and will require cursor-based pagination and source-specific provider integrations before large-scale production use.

**Next direction:** B3.1 dedicated real IdP/API environment certification when hosting is available, then B4 — Money Buckets, Savings Goals, Capital Allocation & Financial Scenarios.
