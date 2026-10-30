# Finance OS — Exact Frontend Reconstruction

## Non-negotiable design contract

**Primary source:** the 59 supplied PNG mockups in `Finance Os.zip`, mapped to `assets/screen-NN.webp` in the repository. The viewer in `index.html` remains untouched and serves as the canonical visual comparison. Screen 22 has no supplied reference; its reference must be approved before claiming exactness.

**The implementation is not an illustration, screenshot hotspot map, or a redesign.** An accepted screen must be built from real HTML/CSS/JS elements. Text, buttons, forms, tables, navigation, chart primitives, and local-state behavior must be accessible and editable. The original screenshots may appear only in the explicit reference/compare mode or as sources of *individual decorative visual assets*.

**Fidelity acceptance:** at 1536×1024 desktop (except the authentication design board, whose desktop/tablet/mobile states are separate responsive representations), each component must match approved geometry, typography hierarchy, palette, icon treatment, card placement and all visible controls. Run side-by-side and overlay review. Do not call a route complete on the basis of a green smoke test alone.

## First implementation batch (Screens 01–05)

| Screen | Reference | Coded route | Status |
|---|---|---|---|
| 01 — Welcome & Authentication | screen-01.webp | `rebuild.html#screen/1` | **DOM reconstruction / visual review required** |
| 02 — Financial Onboarding | screen-02.webp | `rebuild.html#screen/2` | **DOM reconstruction / visual review required** |
| 03 — Financial Profile & Setup | screen-03.webp | `rebuild.html#screen/3` | **DOM reconstruction / visual review required** |
| 04 — Financial Command Centre | screen-04.webp | `rebuild.html#screen/4` | **DOM reconstruction / visual review required** |
| 05 — Today: Safe to Spend | screen-05.webp | `rebuild.html#screen/5` | **DOM reconstruction / visual review required** |
| 06 — Financial Calendar & Action Centre | screen-06.webp | `rebuild.html#screen/6` | **Coded DOM / browser QA; visual approval pending** |
| 07 — Accounts Overview | screen-07.webp | `rebuild.html#screen/7` | **Coded DOM / browser QA; visual approval pending** |
| 08 — Account Details | screen-08.webp | `rebuild.html#screen/8` | **Coded DOM / browser QA; visual approval pending** |
| 09 — Add / Connect Financial Account | screen-09.webp | `rebuild.html#screen/9` | **Coded DOM / browser QA; visual approval pending** |
| 10 — Transaction Management | screen-10.webp | `rebuild.html#screen/10` | **Coded DOM / browser QA; visual approval pending** |
| 11 — Transaction Details | screen-11.webp | `rebuild.html#screen/11` | **Coded DOM / browser QA; visual approval pending** |
| 12 — Record / Edit Transaction | screen-12.webp | `rebuild.html#screen/12` | **Coded DOM / browser QA; visual approval pending** |
| 13 — Statement Import | screen-13.webp | `rebuild.html#screen/13` | **Coded DOM / browser QA; visual approval pending** |
| 14 — Transfers & Payments | screen-14.webp | `rebuild.html#screen/14` | **Coded DOM / browser QA; visual approval pending** |
| 15 — Reconciliation & Financial Ledger | screen-15.webp | `rebuild.html#screen/15` | **Coded DOM / browser QA; visual approval pending** |
| 16 — Spending Intelligence Dashboard | screen-16.webp | `rebuild.html#screen/16` | **Coded DOM; pixel-match approval pending** |
| 17 — Expenditure Trends | screen-17.webp | `rebuild.html#screen/17` | **Coded DOM; pixel-match approval pending** |
| 18 — Spending Category Analysis | screen-18.webp | `rebuild.html#screen/18` | **Coded DOM; pixel-match approval pending** |
| 19 — Merchant & Lifestyle Analysis | screen-19.webp | `rebuild.html#screen/19` | **Coded DOM; pixel-match approval pending** |
| 20 — Spending Leak Detector | screen-20.webp | `rebuild.html#screen/20` | **Coded DOM; pixel-match approval pending** |
| 21 — Create / Edit Budget (reference label) | screen-21.webp | `rebuild.html#screen/21` | **Coded DOM; pixel-match approval pending** |
| 22 — Create / Edit Budget (provisional) | **Missing approved source** | `rebuild.html#screen/22` | **Coded DOM; pixel-match approval pending / provisional** |
| 23 — Daily & Weekly Spending Allowance | screen-23.webp | `rebuild.html#screen/23` | **Coded DOM; pixel-match approval pending** |
| 24 — Spending Guardrails & Purchase Approval Check | screen-24.webp | `rebuild.html#screen/24` | **Coded DOM; pixel-match approval pending** |
| 25 — Subscriptions & Recurring Expenses | screen-25.webp | `rebuild.html#screen/25` | **Coded DOM; pixel-match approval pending** |
| 26 — Spending Review & Recovery Plan | screen-26.webp | `rebuild.html#screen/26` | **Coded DOM; pixel-match approval pending** |
| 27–60 | 34 supplied reference images | `index.html#screen/NN` | **Not yet reconstructed in HTML/CSS** |

The unchanged approved-design viewer is the source of truth while the rebuilt pages are verified. The older generic functional prototype is available separately at `app.html`.

## Screens 06–15 — second implementation batch

- Ten original reference compositions are represented by real HTML/CSS screen renderers in `rebuild/batch06-15.js` and `rebuild/batch06-15.css`.
- Calendar event selection, period switching, and action queues are demonstrated.
- Account overview/detail and local manual-account creation share the onboarding model.
- Transaction ledger, details, editing and classification operate on the same records.
- Local CSV statement import previews rows, validates header fields and skips duplicate records on confirmation.
- Own-account transfers simulate balance movements, preserving combined balances. External payments are explicitly unavailable.
- Reconciliation provides local manual matching, status filters, and a clear non-authoritative disclaimer.
- Browser QA covers all ten screens, key workflows, and 390px mobile overflow (`tests/rebuild-batch06-15.cjs`).
- **Not yet approved as pixel-identical.** Photography, chart geometry, iconography, some secondary tabs, text density, and spacing require reference-overlay comparison. Screenshot rendering and working navigation alone do not prove fidelity.

## Screens 16–26 — spending and budgeting reconstruction

- Reference-aware HTML/CSS renderers in `rebuild/batch16-26.js` and `rebuild/batch16-26.css` cover 11 named screen destinations.
- Four KPI cards, three-column analytics panels, charts, tables and dense financial controls follow the supplied compositions.
- Editable budget category allocations, alerts, periods and local save actions feed into allowance and spending modules.
- Daily/weekly allowances, configurable guardrails and purchase checks are **advisory simulations** only, not actual payment restrictions.
- Subscriptions can be added, edited and locally paused/cancelled; no third-party subscription is cancelled.
- Spending-leak review and recovery-plan tasks persist as local demonstrations, not verified financial advice.
- The supplied screenshot labelled **Screen 21** visibly says **"Create / Edit Budget"**, despite the earlier named screen inventory calling 21 "Budget Management." The screenshot is the source of truth for the coded layout.
- **Screen 22** has no supplied reference and is a provisional derivative of the Screen 21 budget form. It must not be signed off as exact.
- Chromium tests capture screen screenshots at 1536px and 390px, financial state persistence, CSV export and 01–15 navigation regressions in `tests/rebuild-batch16-26.cjs`.
- The JSX/DOM route status does **not** imply visual pixel-level approval. Final comparison, typography, chart geometry and per-control testing remain pending.

## Rebuild implementation behavior

- Sign-in is **demo-only** and never authenticates with a real financial provider.
- Onboarding provider selection opens a **local simulation** rather than a false bank connection.
- Financial profile fields are editable and stored in browser-local demo state.
- Safe-to-Spend has native cash-allocation cards, spending charts, pace, bills, transactions, insights and actions following the approved composition.
- Command Centre has native KPI, account, expense, category, budget, goal, bill, advisor, transaction and forecast components following the approved grid arrangement.
- Add Transaction creates a demo ledger entry and updates the native Recent Transactions panel.
- Reference button overlays the exact approved image for visual comparisons.
- Navigation to a page not yet coded explicitly opens its original visual prototype rather than pretending its screenshot is live frontend code.

## Visual quality checklist per screen

1. Compare against reference at its original 1536×1024 design size.
2. Capture HTML screenshots of desktop/tablet/mobile states.
3. Check element placement, margin, padding, font/weight, colors, borders, icons, chart styles and scroll behavior.
4. Keyboard access: focus order, labels, Escape handling, dialog semantics.
5. Forms: validation, empty/error/success states, local persistence, and cross-screen state.
6. Never change approved visual elements without a documented limitation.
7. Do not delete a capability because the current backend or data source does not support it; represent pending connectivity clearly.

## Blockers / limitations

- Screenshot-only source provides no precise original design tokens, separate banner imagery, source icons, fonts or chart data; some approximation remains until visual QA and designer approval.
- The generated mockups contain inconsistent cross-screen sample values. Treat these as *illustrative fixture numbers* and reconcile in the later data-contract phase.
- No backend or verified banking connection, and browser localStorage is not suitable for real personal financial records.
- The coded first batch **has not been declared pixel-identical**. More reconstruction and visual comparison work remain.

## Run locally

```bash
git clone https://github.com/Sean-steve/Finance-Os.git
cd Finance-Os
git checkout reconstruction/pixel-accurate-components
python3 -m http.server 8080
```

- Coded first batch: `http://localhost:8080/rebuild.html#screen/1` through `#screen/5`
- Approved screenshot reference: `http://localhost:8080/index.html#screen/1`
- Legacy functional app: `http://localhost:8080/app.html#screen/4`

```bash
node --check rebuild/app.js
npm install --no-save playwright@1.56.1
npx playwright install chromium
node tests/rebuild-qa.cjs
```
