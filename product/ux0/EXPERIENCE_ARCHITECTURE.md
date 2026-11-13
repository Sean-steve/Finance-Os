# Finance OS V3 — UX0 Experience Architecture & Product Journeys

**Contract status: proposed V3 experience architecture; not implemented frontend.**
Canonical machine-readable mapping: [experience-architecture.json](./experience-architecture.json), including exactly 60 original screen references. In V3, a screen is **not** a menu item: it can become a page, a panel, an embedded section, a drawer, a wizard or a deliberately blocked future function.

## 1. Navigation / information architecture

**Authenticated desktop sidebar (exactly eight destinations):**

| Destination | Primary question | Anchor route | Deep-linked responsibilities |
| --- | --- | --- | --- |
| Home | Where do I stand and what next? | /home | Command centre, next action, calendar, planning availability |
| Activity | What money came in or went out? | /activity | Accounts, transactions, statement import, reconciliation |
| Spending | How much am I consuming? | /spending | Budget, categories, recurring, guardrails, recovery |
| Cash Flow | What bills and income are coming? | /cash-flow | Income source, upcoming bills, runway scenarios |
| Goals | Am I progressing toward priorities? | /goals | Savings, emergency reserve, buckets, debt, scenarios |
| Wealth | What is my estimated financial position? | /wealth | Assets, liabilities, investments, retirement, tax and insurance records |
| Insights | What changed and why? | /insights | Explainable financial-health heuristics, reporting, source trace |
| Settings | What can I control? | /settings | Privacy, audit, identity, access, integration requests |

**Outside authenticated navigation:** /auth (register, login, account recovery when available), /onboarding, /onboarding/profile. No "Welcome & Authentication" in the sidebar. User-facing labels never include "Screen 04", "B8", "ledger phase", or module code. The original numbered screens remain internal traceability references only.

**Mobile:** bottom navigation Home, Activity, Spending, Goals, More; More contains Cash Flow, Wealth, Insights, Settings and user account. Each page has an optional single clear primary call-to-action; access to Add Transaction can remain in global utility action. No horizontal scroll for primary layouts at 320px.

**Navigation limits:** eight primary desktop targets, five mobile anchors, <=3 visible primary actions at any moment, one dominant decision per region. Deep information is available in tabs, drawers and drill-down pages. Keyboard-accessible global search for accounts and transactions can follow in UX4; don't imply the search is already live.

## 2. Core journeys as task-oriented wireflows

### Journey A: "Get value in my first session"

**Goal:** first manually recorded cash movement and an understandable financial summary.

1. Full-screen /auth: transparent sign-up, local-dev label or production OIDC assurance as appropriate. NO auth link in logged-in nav.
2. /onboarding: choose personal workspace, set KES preference, explain "manual records until connected providers" in one sentence; skip optional advanced setup.
3. First account drawer: Cash, Bank (manual) or Mobile Money (manual); explain provider connection not present. Account name + type, without fake bank-link button.
4. Record initial balance **only if backed by an appropriate supported financial posting route**; otherwise guide user to record genuine income/expense and say the empty account begins with no recorded transactions. Never invent an opening balance.
5. Add Transaction drawer: income or expense, account, amount, date, category and memo. Submit with idempotency, success feedback and details link.
6. /home: summary shows data source and time range. If only one transaction exists, a useful sparse chart and "record another / create bill" action instead of false history.
7. Return entry resumes /home with one priority action. No mandatory 30-step wizard.

**Success:** user can find and explain the recorded amount, navigate to original transaction, and knows that it is not verified by a bank. **Error:** auth/session failure, empty state, failed POST and rollback all have recoverable paths without ghost success.

### Journey B: "Keep my monthly money under control"

1. From /home due-bill insight or /spending budget progress, open a context-sensitive task.
2. Add or review income source in /cash-flow/income. Distinguish expected from received; never add forecast money to posted cash.
3. Add a bill with due date and manual amount in /cash-flow/bills; visually mark due/overdue, no automated payment claim.
4. Make a monthly budget in /spending/budgets; start from common categories but require user confirmation before saving.
5. Review 30-day recorded spending category chart with period selector, provenance badge and transaction drill-down.
6. Adjust budget or record manual bill settlement; the state changes only on confirmed API success; show what did *not* happen (no money transfer).
7. On return, the dashboard raises the next due action; suppress stale/unavailable charts rather than fake zeros.

**Success:** user knows what has been recorded, what they expect to pay next, where their budget is under pressure, and how to act in <=2 navigational hops from a surfaced concern.

### Journey C: "Build a safer future"

1. Choose an emergency-fund goal in /goals; pick target and date.
2. Show goal progress from a clearly named funding or virtual allocation source; display "virtual earmark, not transferred funds" when relevant.
3. See what-if assumptions and risk trade-offs; do not claim money moved.
4. Add a debt with its estimated/manual obligation; understand the suggested payoff schedule is an illustration.
5. /wealth shows assets, liabilities and investments with manual/estimated source labels and last-updated timestamp.
6. /insights shows one source-linked recommendation and a single next action; never use invented scores, market prices or AI claims.

**Success:** user can explain progress, funding assumptions and the difference between actual and planned money.

## 3. First-screen command centre — visual hierarchy

**At 1440px desktop:**
- Top shell: concise product identity, workspace switcher, global Add, alerts, avatar; never a link back to an unrelated prototype.
- Narrow fixed/collapsible left navigation with eight destinations, no numbers.
- Main responsive 12-column grid: first viewport prioritizes a strong financial position card + source/updated badge, this-month income/expense, **one** next-action panel and **one** meaningful chart. No giant welcome banner.
- Below: due bills (3 visible with View All), budgeting progress (3 visible), savings goal card (1–2 visible), and recent activity (5 items).
- Drawers: add transaction, create account, adjust budget and drill into due-bill detail; keep user in context.
- Details/reports: deeper tables, source states, reconciliation and audit; not unbounded on dashboard.

**At 375px mobile:** strong position card, next action, horizontally tappable metric pair, compact chart, obligations; bottom nav. Functional sorting and filters never require hover.

**Illustrative layout contract (not a rendered design):**

    ┌─────────────────────────────────────────────────────────────────────┐
    │ Finance OS       Workspace ▾             + Add        Alerts  User │
    ├────────────┬────────────────────────────────────────────────────────┤
    │ Home       │ Good morning       Your financial picture    [30d ▾] │
    │ Activity   │ ┌─────────────┐ ┌─────────────┐ ┌───────────────────┐ │
    │ Spending   │ │ Recorded KES│ │ Income/Out  │ │ Next best action  │ │
    │ Cash Flow  │ │ provenance  │ │ manual      │ │ do it now         │ │
    │ Goals      │ └─────────────┘ └─────────────┘ └───────────────────┘ │
    │ Wealth     │ ┌───────────────────────────┐ ┌─────────────────────┐ │
    │ Insights   │ │ Income / expense trend    │ │ Upcoming bills      │ │
    │ Settings   │ │ [source] [range] [drill]  │ │ Due dates + action │ │
    │            │ └───────────────────────────┘ └─────────────────────┘ │
    │            │ Goals and spending progress | Recent activity        │
    └────────────┴────────────────────────────────────────────────────────┘

**No fake data rule:** if no authoritative workspace records exist, the first viewport becomes an efficient welcome empty state with one "Add an account" button and a 3-step progress indicator. Never display illustrative amounts in authenticated mode.

## 4. Single design language for financial truth

Every number or recommendation in a UI module carries:
- **Data class:** POSTED_MANUAL, USER_REPORTED, ESTIMATED, EXPECTED, VERIFIED_PROVIDER (only when a real provider supplies verification), VIRTUAL_ALLOCATION, INSUFFICIENT_DATA.
- **Currency & unit:** KES minor units from API, formatted into KES for people; never format bigint through unsafe floating arithmetic without bounds.
- **Time window:** exact start/end dates with timezone, and updated timestamp when known.
- **Source link:** go to transactions, accounts, bill or report behind that figure.
- **Completeness state:** empty, loading, partial/unavailable, success, stale, error, forbidden and retry.
- **Action consequence:** an "Approve" means internal approval, not payment execution.

Examples:
- "Recorded balance • Manual entries • Updated [time]" instead of "Bank balance".
- "Income expected next month" instead of "Money available".
- "Bill marked settled manually" instead of "Payment successful".
- "Savings bucket — planning allocation" instead of "Cash saved".
- "Not enough evidence to estimate what is safe to spend" instead of an invented safe amount.

**B8 integrity endpoint:** owner-only explicit check remains a settings/security action; PASS_MANUAL_LEDGER never becomes "bank accounts reconciled". Authentication tokens remain memory-only. No prototype seeded data should enter the V3 connected app.

## 5. State and interaction contracts

| State | Required behavior |
| --- | --- |
| No records | Explain benefit and give one relevant Add action; no zero-as-complete charts |
| Loading | Skeleton matching card/chart geometry; prevent duplicate submit |
| Saving | Inline spinner; keep form visible with preserved input until confirmed |
| Saved | Toast/confirmation plus direct link to new record; revalidate dependent queries |
| Failed mutation | No success animation or optimistic posted balance; explain and retry safely |
| Unsupported provider | Clear "Not connected yet", never active-looking Connect/Pay actions |
| Session expired | Preserve safe navigation intent, require reauthentication; never leak workspace |
| Incomplete source | Visible source badge, dated estimate, method/assumptions link |
| Forbidden | Access-denied explanation, no hidden private records or stale cached data |
| Accessibility | Screen reader announces updates, all dialogs focus-managed, errors associated with fields |

## 6. Existing backend reuse and missing presentation data

Reuse existing TypeScript/Fastify and PostgreSQL B0–B8 financial services:
- Accounts, manual ledger, transactions, reversals, budgets/guardrails, income/bills, capital goals, debt, asset/wealth estimates, B7 insight governance and B8 integrity.
- Preserve scope validation, row-level security and journal immutability.
- Use **React + TypeScript + Vite, React Router, TanStack Query, Tailwind, Recharts, accessible dialog/form components** as the recommended UX2 presentation architecture, pending feasibility review.

**Backend presentation gaps to assess during UX2 (NOT claimed complete):**
1. Scoped, paginated **chart-ready time-series read models** for income/expense, cash flow, budget utilization and goals; only add contracts if current APIs cannot safely support aggregation.
2. Cross-module **Home summary** read model that carries source labels, updatedAt, periods and disclosure; avoid dozens of waterfall requests.
3. The distinction between *expected*, *recorded*, *reversed*, *manually settled* and *bank verified* in API-facing DTOs.
4. Idempotent onboarding/first value flow, no invalid opening-balance postings.
5. Explicit external-integrations "not connected" capability flag and AI provider "rules-only" flag.
6. Scoped analytics event intake with privacy review; no financial PII in event properties.
7. User-friendly pagination/filtering and stable query keys per workspace for financial detail panels.

**Boundary:** Do not build generic "AI Insights" or M-Pesa sync from raw API names or falsely assume APIs support live banking. Any added backend fields require OpenAPI, contract tests, RLS/tenancy checks and CI.

## 7. Legacy traceability and acceptance criteria

Every original screen ID 1–60 maps once and only once in experience-architecture.json. Some translate to a flow or drawer, not a top-level route. The 60-screen visual reference library may be used in **design review**; it must not constrain V3 navigation or publish as financial data.

**Navigation acceptance:**
- Eight and only eight primary nav targets, with stable labels and clear active states.
- Authentication/onboarding absent from authenticated nav and logout only via account control.
- Every destination supports responsive deep links, refresh/back and one meaningful task.
- Original screen numbers never shown in navigation, titles, breadcrumbs or global search.
- All 60 prior concerns appear in traceability; unsupported capabilities remain visibly unavailable and non-interactive.
- Manual financial posting preserves ledger invariants and cross-domain refresh.
- First-session, monthly-control and goals journeys can be demonstrated on actual isolated PostgreSQL seeded with explicit synthetic *testing-only* data, never an authenticated production demo.

**Design research gate before UX1 signoff:** draft these routes and wireflows into a clickable desktop/mobile prototype, run moderated tasks with representative interview recruits, record success/failure and revise navigation based on observed paths, not only stakeholder preference.
