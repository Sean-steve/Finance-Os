# Finance OS V3 — Phase UX1 Premium Visual System and Interactive Prototype

**Delivery:** source-coded, interactive **UX1 preview** at `v3/index.html`, independently served from the V2 prototype and connected backend. It is deliberately **not** a production-ready frontend or a financial data product. All numbers are generated illustrative records and kept in JS memory for the current tab only. No network requests, bank connectors, M-Pesa integration, real authentication, production token storage or provider verification exist in UX1.

## Product design direction delivered

### Experience architecture
- Exactly eight primary desktop destinations: **Home, Activity, Spending, Cash Flow, Goals, Wealth, Insights, Settings**.
- Mobile bottom navigation: **Home, Activity, Spending, Goals, More**. More accesses the four remaining destinations.
- Welcome, non-credential sign-in preview and guided empty onboarding are **outside authenticated navigation**.
- No numbered legacy screens, sidebar link to prototypes or repetitive corporate banners; V2 screen archive remains separate.
- One global **Add new** action palette, contextual drawers, single-primary-action page headers and task-oriented drilldowns.

### The financial command centre

Desktop design: 252px minimal left rail + compact topbar, financial-position card, income/expense pair, immediate next-action card, responsive cash-flow chart, ranked spending categories, forthcoming bills, virtual goal progress, and five recent transactions.

Mobile at 390px: single-column cards, bottom nav, responsive SVG bar graph, touch-first drawers, and readable transaction rows. At 320px, verify no page-level clipping; tabular financial details may use local horizontal scrolling. Primary cards and controls must remain usable.

### Proposed visual tokens

| Semantic token | Light value | Meaning |
| --- | --- | --- |
| `--forest` | `#0D4237` | Brand, primary action and active navigation |
| `--forest-deep` | `#082A25` | Emphasis, elevated dark surfaces |
| `--emerald` | `#0C8662` | Positive/manual activity and charts, not a bank-verification signal |
| `--lime` | `#CBEA91` | Restrained accent; primary preview CTA |
| `--paper` | `#F6F8F5` | Neutral workspace canvas |
| `--ink` | `#152D2A` | Body text |
| `--muted` | `#657974` | Secondary labels and data provenance |
| `--line` | `#E1EAE4` | Quiet separation |
| `--warning` | `#8A641D` | Pending/estimated caution |
| `--danger` | `#A43B43` | Validation errors |

Typography: system-ui/Inter-compatible fallback, tabular numeric feature for financial figures; responsive ~30px heading desktop and ~26px mobile, 12px secondary labels (contrast to be measured against WCAG 2.2 AA during UX2).

Components include `AppShell`, `Sidebar`, `MobileNav`, `Topbar`, `PositionCard`, `MetricTile`, `ActionCard`, `BarChart`, `CategoryProgress`, `GoalGauge`, `TransactionFeed`, `BillDueList`, `SourceDisclosure`, `Drawer`, `FormField`, `Toast`, `EmptyState`, and `AccountSelector`. In UX1 these are **vanilla JS functions/CSS prototypes**, not yet React components; UX2 implements the reusable React component library.

### Chart semantics

The Home bar chart displays recorded *illustrative manual* income and expenses for 30-day, 90-day and 6-month periods. Interactive bars expose exact month values and are accessible by keyboard. A native expanded table is available as a nonvisual alternative. The Spending view uses source-labeled ranked category progress, Goals use radial progress and budgets show utilization. Empty data never becomes a fabricated "bank balance".

Strictly unavailable in UX1: provider-verified history, live quotes, real financial advice, true bank balances, automatic payments, transfers, real account onboarding and income tax filing.

## Interactive flows demonstrated

| Flow | Steps | Visible completion |
| --- | --- | --- |
| A — First financial record | Welcome → empty onboarding → add manual account → record income or expense → Home | Position and chart respond to the in-memory entry, visibly marked unverified |
| B — Monthly money control | Home → Activity → add expense → Spending → edit budget → Cash Flow → create/mark bill | Current-month totals and budget progress update; bill is explicitly **manually** settled without payment |
| C — Saving and long-term outlook | Goals → create target → update virtual progress → Wealth → Insights | Progress visualization, manual asset/debt estimates and transparent rule-based review |

All forms validate their required fields and financial amounts. The UI uses ephemeral in-memory state (no localStorage, no sessionStorage, no fetch); refreshing the browser resets the sample state, and no saved progress is implied.

## How to try UX1 locally

```bash
git pull origin main
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/v3/`. The existing real local backend continues at `http://127.0.0.1:3101` and the connected local UI at `http://127.0.0.1:8080/connected.html`. These are **different experiences**. The UX1 preview must **never** take credentials or imply financial data persistence.

Once Pages workflow reports a successful deployment, the public standalone UX1 preview is at `https://sean-steve.github.io/Finance-Os/v3/`. Pages is static; it cannot host PostgreSQL or a production API.

## Automated verification

- `npm run ux1:check` validates syntax, offline CSP, no persistent storage/network, eight destinations, presence of charting and form flows, disabled real-money claims and mobile rules.
- `node tests/ux1-browser-qa.cjs` after installing Playwright exercises:
  - welcome→demo, exclusive eight-item navigation, 30/90/6-month chart interaction;
  - transaction, budget, bill, goal changes;
  - wealth and insights states, reset to empty;
  - 390px mobile More navigation, no page horizontal overflow;
  - sign-in **without** capturing credentials and first-value empty onboarding;
  - no browser uncaught errors or requests outside the local `v3/` preview.
- Browser QA exports `qa-artifacts/ux1-v3-desktop.png` and `qa-artifacts/ux1-v3-mobile.png`; merged V3 preview reaches GitHub Pages **only** through the already-required successful full Browser UX QA workflow.

**Acceptance classification:**
- Engineering-interactive-preview check: pending GitHub CI until run completes.
- V3 real authenticated app, 60 feature migration, OIDC and backend API integration: **NOT DONE** (UX2+).
- Actual high-fidelity human sign-off, moderated usability with >=8 representative users, measured task completion and independently verified WCAG AA: **NOT DONE**. These remain UX1 human-validation gates; technical tests cannot waive them.
- Investor demand, traction, profitability and regulatory approvals: **NOT MEASURED / NOT CERTIFIED**.

## Design critique/research checklist before UX2

1. At first glance, can 8–12 recruited users answer "where do I stand, what should I do next, and how certain are these numbers"?
2. Can a first-time user record an expense with <=2 context changes and without assistance?
3. Can a user find an upcoming bill and distinguish "manually settled" from actually paid?
4. Can they explain that goals represent virtual plans and not real bank balance transfers?
5. Are the Home cards meaningful at 1440, 1024, 390 and 320px?
6. Do keyboard-only and screen-reader participants reach mobile More, charts, dialog and form errors predictably?
7. Are financial disclaimers readable without covering the entire first viewport?
8. Does the interface feel like a cohesive product rather than a long form/table page?

Collect negative findings; record design changes and consented research metrics in the next evidence note before approving UX2 React reconstruction.

## UX2 handoff

Implement these UX1 experiences in a **separate React + TypeScript/Vite shell** with accessible dialog primitives, React Router, TanStack Query and reusable chart components. Connect to existing B0–B8.1 APIs through a workspace-aware, source-classified adapter. Replace ephemeral sample data with PostgreSQL data only when authenticated and authorized; error/empty/incomplete states must never silently fall back to mock financial records. Keep V2 connected.html available until transactional parity, tenant isolation and full backend/UX testing pass.
