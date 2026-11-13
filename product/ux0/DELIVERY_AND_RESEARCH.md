# Finance OS V3 — UX0 Delivery, Research & Certification Plan

**Status:** executable plan, not evidence that research, high-fidelity design, customer demand or deployment has occurred.

## UX0 decisions locked for UX1 exploration

- The current numbered HTML navigation is a **temporary test harness only**. V3 gets a newly architected React/TypeScript frontend that connects to the existing Fastify/PostgreSQL service.
- Use **outcome-centered navigation** (Home, Activity, Spending, Cash Flow, Goals, Wealth, Insights, Settings) with login/onboarding outside the shell.
- The canonical original 60 screens remain in experience-architecture.json as traceability; the initial V3 scope is **not** the implementation of 60 separate route layouts.
- Preserve B0–B8.1 ledger correctness, secure boundaries and manual financial provenance; no artificial provider sync, payment, bank balance, AI or customer data.
- Begin with first value and monthly control, then deepen goals/wealth. Prefer a small outstanding experience to a sprawling weak one.
- A premium investor demo can use explicitly labeled synthetic sandbox fixtures only; **never present synthetic traction or demo data as real customer statistics.**

## Delivery dependency plan

| Phase | Deliver | Must pass before next phase |
| --- | --- | --- |
| UX0 — Strategy + architecture | Proposition, target user hypothesis, 60-to-8 IA, 3 journeys, design rules, evidence register | Complete and reviewed in repo; research gaps listed honestly |
| UX1 — Premium visual design | Design system, 7 anchor views in desktop/mobile, real empty/provenance states, clickable flows | Internal stakeholder sign-off **plus moderated usability observations**, no numeric menu |
| UX2 — React app foundation | V3 application shell, routing, session integration, secure backend adapter, TanStack Query and reusable primitives | Existing contract/role tests pass; nav and auth boundaries verified; local connected runtime works |
| UX3 — Command Centre MVP | Home, Accounts, Activity, Quick Add, transaction editing/reversal, source-backed chart and next action | End-to-end local PostgreSQL scenario; transaction, balance and source correctness; usable mobile |
| UX4 — Money Control | Spending, budgets, income, bills, cash flow and savings goals | Core monthly flow e2e, budget/cash forecast truth labels and no false payment claims |
| UX5 — Intelligence & Wealth | Debt, assets, liabilities, wealth analytics, scenarios, reports and transparent insights | Verified assumptions and source paths; existing B5–B8 finance tests green |
| UX6 — Product Beta Certification | Cross-browser, performance, accessibility, high-risk abuse cases, opt-in research cohort, privacy gates | Independent security/privacy and hosted identity approval before real user data |
| UX7 — Commercial Validation | Pricing, retention/cohort analysis, real customer studies, investor storyline with evidence | Claims correspond exactly to measured metrics and source records |

**Suggested delivery rhythm:** 2-week iteration target for UX1 and UX2 sub-milestones, but do not treat this as a delivery promise. Split PRs by business journey, use screenshot/video regression comparisons with original visuals only as reference. Never merge a known financial misrepresentation to meet a schedule.

## Priority backlog — implementation order

**P0 — investor-visible and first-value critical**
1. Layout shell, navigation, auth separation, workspace switcher, accessible mobile nav.
2. Home recorded-position tile; income/expense trend, obligations and next-action card with real provenance and empty data.
3. Quick Add transaction and account drawers; post/reverse/update feedback and query invalidation.
4. Budget status, bill due list and savings progress, all source-labeled.
5. Page layout pattern with loading, empty, failure, forbidden and unsupported states.
6. Responsive usability and accessible charts, with drill-down and table equivalents.
7. Backend/UI integration tests with true disposable PostgreSQL and no demo fallbacks.

**P1 — expansion**
8. Cash-flow assumptions, goals and debt forecast charts.
9. Transaction search, filters, pagination and categorization review.
10. Weekly financial review and permissioned meaningful-action analytics.
11. Detailed reports, wealth history, insights explanations and preferences.

**P2 — after provider/legal access**
12. Real M-Pesa/bank integration exploration only with approved access and explicit consent.
13. Actual provider verification and automatic reconciliation.
14. Generative AI financial explanations with privacy-aware data boundaries and professional-advice review.
15. Any execution of payments, custody, credit or regulated activity under independent licensing analysis.

## Concrete UX1 build brief (handoff)

**Figma or equivalent high-fidelity reusable component system:**
- Desktop: authentication, onboarding, Home, Activity/accounts, Activity/transaction drawer, Spending/budget, Cash Flow/bills, Goals/savings; these are 8 view states covering 7 product areas plus auth.
- Mobile: authentication, Home, Activity/quick-add, Spending/budget, Goals/goal-detail, More drawer.
- Variants: first-run zero data; few manual transactions; many transactions; partial/estimated data; loading; mutation rejected; expired session; inaccessible/owner-only action; API offline.
- Chart states: 30/90-day period, no history, only one data point, dense history, mixed source, partial metadata.
- Audit source of every financial value and button; handoff includes API endpoint, authorized roles, event and status.

**Explicit UX1 non-goals:** no complete new frontend production launch, no automatic live banking, no fabricated market numbers, no paying for new infrastructure, no changes to existing PostgreSQL money-posting logic without test-backed need.

## Moderated interview and research protocol

**User interview study (planned, not performed):** recruit 20–30 Kenyan adults across mixed-income, salary+side-income and goals-focused segments; include people who decline budgeting apps or only use spreadsheets. Avoid presenting internal archetypes as discovered personas. Obtain informed consent; don't request actual statements, phone transaction screenshots, passwords or bank IDs.

**Eight core questions:**
1. Walk through the last time your income and expenses did not line up as expected. What happened?
2. How do you currently track bank, mobile-money and cash movements?
3. What financial decision did you struggle with in the last month?
4. How often do you check upcoming bills and available recorded funds?
5. What have you tried (apps, notes, spreadsheets), and why did you stop?
6. How much manual data entry feels acceptable before giving up?
7. What would make you trust or distrust an app calculating your financial position?
8. If Finance OS solved this specific problem, how would you decide whether to pay? (Ask actual scenario; do not frame as sales pitch.)

**Observe:** task frequency, workaround cost, abandonments, recurring trigger, privacy concerns, competing solutions, existing willingness to pay. Report both counterevidence and positive feedback.

**Prototype task set (8–12 moderated testers after UX1):**
- Task A: Create personal workspace, account and sample income; interpret recorded balance and source.
- Task B: Notice a due bill, create a budget, see which spending category needs attention.
- Task C: Create a savings goal, understand virtual allocation status and inspect a debt estimate.

Record unassisted completion, time, navigation backtracks, wrong clicks, trust comprehension and comments. Stop/make a design change when more than two testers repeatedly fail the same critical action or misinterpret financial truth. UX1 acceptance is evidence-backed, not "looks premium to the team."

## Event schema proposal (consent and privacy review required)

Emit metadata only: event_name, flow_id, route_id, workspace_type (not workspace ID by default), source_class (enum), success/failure category, approximate duration bucket, client_platform, anonymized stable experimental cohort when explicitly consented.

Candidate events: onboarding_completed, account_created, manual_transaction_posted, manual_transaction_reversed, monthly_budget_created, bill_reviewed, due_bill_reviewed, savings_goal_created, dashboard_summary_viewed, recommendation_action_completed, chart_drilldown_opened, financial_integrity_checked.

Prohibited telemetry: transaction amounts, raw account numbers, payee names, transaction memos, names, emails, passwords, OAuth tokens, exact device identifiers without explicit lawful basis. Avoid claiming a working analytics platform until implementation and verification.

## Definition of UX0 done (verifiable from repo)

- [x] Inspect existing authenticated frontend's numeric navigation and dashboard architecture.
- [x] Capture product promise, non-goals, target segment **as hypotheses**.
- [x] Create the 60-screen migration map, all screens represented exactly once.
- [x] Remove auth/onboarding from planned authenticated navigation.
- [x] Specify 3 task-oriented user journeys and distinct availability semantics for unavailable features.
- [x] Define dashboard hierarchy, chart grammar, provenance and status states.
- [x] Define component inventory and desktop/mobile requirements.
- [x] Set explicit phase delivery order, test gates and investor evidence register.
- [ ] Conduct customer interviews and usability tests — **not possible to self-certify from code**.
- [ ] Receive human product/visual approval of the direction.
- [ ] Provision real identity/production infrastructure — deliberately OUTSIDE UX0.

**What UX0 completion means:** the V3 design/engineering team has enough approved **direction** to execute UX1 and evaluate it, **not** that a V3 product, market traction, investor financing, customer compliance or live releases exist.

## Technical PR standards for UX2 onward

1. Build new isolated V3 source directory; leave V2 public prototype and connected HTML test tool untouched until the replacement passes parity.
2. Progressive cutover only via a reversible feature flag or independent local V3 URL; avoid breaking existing B0–B8.1 test users.
3. Data fetching is workspace-bound; clear caches on logout/workspace change; never persist financial auth tokens to localStorage.
4. All writes retain idempotency and RLS; use strict TS & OpenAPI schema tests.
5. No UI changes permitted that represent manual money as verified provider money; audit charts source and assumptions.
6. Automated route/navigation test, mocked state tests, at least one real PostgreSQL golden scenario, accessibility and mobile browser snapshots before merge.
7. UX1–UX7 phases must each update an evidence register with actual results and remaining blockers; a green CI check is not commercial/product-market validation.

**Next user-visible milestone:** UX1 premium interactive app-shell and command-centre prototype, shown on desktop and mobile before rebuilding remaining functions.
