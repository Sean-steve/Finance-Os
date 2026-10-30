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
| 22 — Budget Studio / Create & Edit Budget | **New design derived from approved Screen 21; no separate source** | `rebuild.html#screen/22` | **Distinct native DOM, live allocation validation, shared save/discard; visual approval pending** |
| 23 — Daily & Weekly Spending Allowance | screen-23.webp | `rebuild.html#screen/23` | **Coded DOM; pixel-match approval pending** |
| 24 — Spending Guardrails & Purchase Approval Check | screen-24.webp | `rebuild.html#screen/24` | **Coded DOM; pixel-match approval pending** |
| 25 — Subscriptions & Recurring Expenses | screen-25.webp | `rebuild.html#screen/25` | **Coded DOM; pixel-match approval pending** |
| 26 — Spending Review & Recovery Plan | screen-26.webp | `rebuild.html#screen/26` | **Coded DOM; pixel-match approval pending** |
| 27 — Income Dashboard | screen-27.webp | `rebuild.html#screen/27` | **Coded DOM / QA; visual approval pending** |
| 28 — Income Sources | screen-28.webp | `rebuild.html#screen/28` | **Coded DOM / QA; visual approval pending** |
| 29 — Income Planning & Forecasting | screen-29.webp | `rebuild.html#screen/29` | **Coded DOM / QA; visual approval pending** |
| 30 — Bills & Financial Obligations | screen-30.webp | `rebuild.html#screen/30` | **Coded DOM / QA; visual approval pending** |
| 31 — Bill Details & Payment | screen-31.webp | `rebuild.html#screen/31` | **Coded DOM / QA; visual approval pending** |
| 32 — Cash Flow Timeline | screen-32.webp | `rebuild.html#screen/32` | **Coded DOM / QA; visual approval pending** |
| 33 — Cash Flow Forecast & Financial Runway | screen-33.webp | `rebuild.html#screen/33` | **Coded DOM / QA; visual approval pending** |
| 34 — Cash Shortfall Recovery | screen-34.webp | `rebuild.html#screen/34` | **Coded DOM / QA; visual approval pending** |
| 35 — Capital Allocation Command Centre | screen-35.webp | `rebuild.html#screen/35` | **Coded DOM / browser QA; pixel-level approval pending** |
| 36 — Allocation Rules & Money Buckets | screen-36.webp | `rebuild.html#screen/36` | **Coded DOM / browser QA; pixel-level approval pending** |
| 37 — Savings & Financial Goals | screen-37.webp | `rebuild.html#screen/37` | **Coded DOM / browser QA; pixel-level approval pending** |
| 38 — Goal Details & Funding | screen-38.webp | `rebuild.html#screen/38` | **Coded DOM / browser QA; pixel-level approval pending** |
| 39 — Emergency Fund Management | screen-39.webp | `rebuild.html#screen/39` | **Coded DOM / browser QA; pixel-level approval pending** |
| 40 — Affordability & Purchase Simulator | screen-40.webp | `rebuild.html#screen/40` | **Coded DOM / browser QA; pixel-level approval pending** |
| 41 — Funding Requests & Approvals | screen-41.webp | `rebuild.html#screen/41` | **Coded DOM / browser QA; pixel-level approval pending** |
| 42 — Financial Scenario Planning | screen-42.webp | `rebuild.html#screen/42` | **Coded DOM / browser QA; pixel-level approval pending** |
| 43 — Debt Management Centre | screen-43.webp | `rebuild.html#screen/43` | **Coded DOM / browser QA; pixel-level acceptance pending** |
| 44 — Debt Details & Repayment Schedule | screen-44.webp | `rebuild.html#screen/44` | **Coded DOM / browser QA; pixel-level acceptance pending** |
| 45 — Debt Repayment Optimizer | screen-45.webp | `rebuild.html#screen/45` | **Coded DOM / browser QA; pixel-level acceptance pending** |
| 46 — Tax Overview & Planning | screen-46.webp | `rebuild.html#screen/46` | **Coded DOM / browser QA; pixel-level acceptance pending** |
| 47 — Insurance & Financial Protection | screen-47.webp | `rebuild.html#screen/47` | **Coded DOM / browser QA; pixel-level acceptance pending** |
| 48 — Retirement Planning | screen-48.webp | `rebuild.html#screen/48` | **Coded DOM / browser QA; pixel-level acceptance pending** |
| 49 — Estate & Beneficiary Planning | screen-49.webp | `rebuild.html#screen/49` | **Coded DOM / browser QA; pixel-level acceptance pending** |
| 50 — Net Worth Dashboard | screen-50.webp | `rebuild.html#screen/50` | **Coded DOM / browser QA; exact visual review pending** |
| 51 — Assets & Liabilities Overview | screen-51.webp | `rebuild.html#screen/51` | **Coded DOM / browser QA; exact visual review pending** |
| 52 — Asset Details & Valuation | screen-52.webp | `rebuild.html#screen/52` | **Coded DOM / browser QA; exact visual review pending** |
| 53 — Investment Portfolio | screen-53.webp | `rebuild.html#screen/53` | **Coded DOM / browser QA; exact visual review pending** |
| 54 — Investment Details & Performance | screen-54.webp | `rebuild.html#screen/54` | **Coded DOM / browser QA; exact visual review pending** |
| 55 — Wealth Growth & Risk Analysis | screen-55.webp | `rebuild.html#screen/55` | **Coded DOM / browser QA; exact visual review pending** |
| 56 — Financial Health & Insights | screen-56.webp | `rebuild.html#screen/56` | **Coded DOM / functional QA; exact visual signoff pending** |
| 57 — AI Financial Advisor | screen-57.webp | `rebuild.html#screen/57` | **Coded DOM / functional QA; exact visual signoff pending** |
| 58 — Financial Reports & Reviews | screen-58.webp | `rebuild.html#screen/58` | **Coded DOM / functional QA; exact visual signoff pending** |
| 59 — Integrations & Account Synchronization | screen-59.webp | `rebuild.html#screen/59` | **Coded DOM / functional QA; exact visual signoff pending** |
| 60 — Settings, Privacy, Security & Audit History | screen-60.webp | `rebuild.html#screen/60` | **Coded DOM / functional QA; exact visual signoff pending** |

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

## Screens 27–34 — income, obligations and runway

- Eight screenshot-guided DOM renderers in `rebuild/batch27-34.js` and `rebuild/batch27-34.css`, using the same shared browser-local Finance OS model.
- Income source creation/editing, illustrative income planning assumptions and scenario projections.
- Bill list and details, editable local obligations, due dates, reminders and demo payment history. **No real M-Pesa STK request, debit, bank settlement or authoritative payment allocation.**
- Cash-flow timeline, forecast scenarios, modelled cash runway, optional CSV export, and checklist-based shortfall recovery.
- Scenario estimates are not authoritative: demo values can omit irregular expenses, incomplete incomes and liabilities. Payment simulations do **not** change bank balances.
- Browser QA at 1536×1024 and mobile 390px, plus cross-batch regression. **Pixel-perfect visual sign-off remains outstanding**; source-specific chart assets, some secondary tabs, placement and typographic details require review.

## Screens 35–42 — capital allocation and financial planning

- Reference-specific HTML/CSS screens in `rebuild/batch35-42.js` and `rebuild/batch35-42.css`; photographs and pixel-level chart/typography details still require overlay acceptance.
- Screens include capital overview, bucket-rule management, savings cards, goal funding, emergency reserve, a purchase affordability/amortization model, funding approvals and configurable scenario modelling.
- Goals and emergency fund amounts share state with the earlier `model.goals`. Local funding or emergency withdrawal simulation changes source account and goal amounts inversely; no external funds move.
- Monthly bucket allocations are **planning figures**, not new assets and do not debit accounts. Allocation rules/automation toggles are local preferences and do not install scheduled finance tasks.
- Purchase results are **illustrative only**, not credit approval, financial advice or an actual lender quote. Funding approvals are administrative status changes, not disbursements.
- Scenario projections are uncertain estimates and do not guarantee investment returns. CSV exports contain local demo projections.
- Chromium checks at 1536px and 390px validate flows and state invariants, **not pixel-perfect visual sign-off**.

## Screens 43–49 — debt, tax, protection, retirement and estate

- Seven separate screenshot-guided DOM workspaces in `rebuild/batch43-49.js` and `rebuild/batch43-49.css`.
- Debt details, amortization and avalanche/snowball optimizer share consistent local loan records. A recorded payment reduces demo loan principal only; no cash account or lender is charged.
- Tax overview uses editable **illustrative** estimates; not live Kenya Revenue Authority calculations or an iTax submission.
- Insurance policies and claim drafts are **local metadata**, not verified cover or provider submissions.
- Retirement projections are deterministic scenarios, not investment return guarantees.
- Estate beneficiary names are fictional placeholders, checklists are non-binding and legal document uploads are deliberately disabled due to privacy risk.
- Browser tests cover 43–49 routes, edit persistence, simulated workflow safeguards, download and mobile overflow; screenshots are retained in the Actions run.
- **Not pixel-perfect approved:** chart geometry, typography, imagery/icons and secondary tab content require human comparison.

## Screens 50–55 — assets, investments, net worth & wealth risk

- Six individual, screenshot-guided workspaces in `rebuild/batch50-55.js` and `rebuild/batch50-55.css`.
- **Shared financial source of truth:** net worth = personal cash from primary personal accounts + recorded physical asset values + investment holdings at estimated market value − debt balances in `protectionV2.debts`. Business account balances and separately earmarked savings goals are excluded from personal cash to avoid double counting.
- Asset creation, valuation adjustments and investment holding edits persist in the same browser-local model and update all six screens.
- Simulated buy/sell entries move value between the selected demo personal cash account and holding quantities; no broker, exchange, settlement or bank is contacted. Cash-plus-holding value must remain conserved at the simulated execution price.
- Market prices and historical chart series are **illustrative**, not authoritative quotes, investment research or verified past results. Projected wealth relies on user-editable assumptions.
- Portfolio and wealth CSV exports are local snapshots. No sensitive documents, verification or secure account integration.
- Rendered at 1536×1024 and tested at 390px; final pixel-overlays against the original screenshots remain to be reviewed.
- Assets screen 52 uses decorative CSS illustrations; original property photographs were not supplied separately as source assets and must be reconciled before pixel-level signoff.

## Screens 56–60 — financial intelligence, reports and governance

- Five independent HTML/CSS/JS workspaces follow the supplied 1536×1024 reference screenshots in `rebuild/batch56-60.js` and `rebuild/batch56-60.css`.
- Financial Health aggregates actual **browser-demo records** from the other 55 screens; its score and historical chart are **illustrative heuristics**, not an audited financial health or credit score.
- AI Financial Advisor is **rule-based and local**; no remote model/API, professional financial adviser or confidential data transfer is connected.
- Reports generate downloadable **CSV/JSON snapshots** from the local financial ledger, with report history and a browser print/save-to-PDF option. Scheduled report toggles are local preferences; no automated delivery occurs.
- Integrations gallery is provider metadata and demonstration previews only. `Connected Accounts=0`, `Verified Syncs=0`, `Sync Balance=0`; **no provider is connected**, even if a preview is marked as prepared.
- Profile, notifications, privacy toggles and local audit history persist in browser storage. Users can export their local demo JSON and explicitly delete demo data. Passwords, multifactor authentication, devices, billing, encrypted storage, server-side audit and access control **cannot be implemented securely in a static GitHub Pages prototype**; these actions are visibly unavailable.
- The complete routed inventory is now **60/60 coded**, but **visual overlay acceptance has not been completed**. Screen 22 still has **no original supplied screenshot**, so its provisional layout cannot be deemed exact.
- Chrominium QA tests all 60 routes, mobile 390px, actionable forms, report exports, provider status honesty, and local data deletion.

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

## Visual fidelity correction pass 1 (30 October 2026)

- **Screen 22 created as a separate full-featured native UI**, not duplicated from Screen 21: ten editable budget categories, live donut, category share, rollover toggles, alert preferences, saved templates, balance allocation, validation and explicit save/discard into shared `spendV2`. Its visual language is derived from the approved source for Screen 21; there is no separate Screen 22 screenshot to compare against.
- **Screen 08 Account Details** refactored to use one account hero, one tab bar, source-matched four panel top row, recent transactions and account alerts without duplicate global KPI/hero.
- **Screen 11 Transaction Details** refactored with transaction hero, identity card, six fact cells, overview/receipt/actions panels and notes. Original edit/categorization handlers remain in place.
- **Screen 21 Budget Editor** repositions Quick Setup into Budget Details and moves Budget Preview to the original right-hand top position. Adds navigation to the Screen 22 Studio.
- **Screen 40 Affordability Simulator** restores the approved three-column layout (simulator/results/purchase summary), including the original decorative vehicle photograph cropped from the supplied source image; charts and forms remain real DOM.
- Quantitative comparison uses 384×256 downsampled RGB MAE, baseline vs newly captured code for Screens 08, 11, 21 and 40. See `tests/visual-metrics-qa.py` and branch QA artifacts.
- No untouched screen is claimed visually corrected. Pixel-perfect sign-off for all 59 supplied original designs remains pending beyond this measured repair batch.
