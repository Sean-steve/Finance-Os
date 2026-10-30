# Finance OS V2 — Approved Screen Fidelity Prototype

**Current correction:** The landing page now displays the **original supplied screen designs**, not a redesigned approximation.

- **Exact reference view:** [Finance OS Approved Screens](https://sean-steve.github.io/Finance-Os/) — all 59 supplied 1536×1024 screen images are committed under `assets/`. Screen 22 has no original image and has a clearly marked reconstructed budget editor.
- **Separate coded financial demonstration:** [Working Modules](https://sean-steve.github.io/Finance-Os/app.html#screen/4) — retained from Phase 2.2, and **not** represented as a pixel-match.
- The reference view supports 60-screen navigation (click a screenshot's sidebar / toolbar), screen search (Ctrl+K), hotspots, next/previous, native-resolution zoom, and guided related-page links.
- Screenshot text, charts, forms and metrics remain **static image content**; hotspots and the reconstructed Screen 22 editor are the interactions. A true DOM-by-DOM screen implementation remains pending.

**Privacy:** GitHub Pages is public. The design images published here are the uploaded mockups; do not treat displayed personal or financial values as verified live records.

See [Exact visual fidelity correction](docs/EXACT_SCREEN_FIDELITY.md) and [Phase 2.2 QA report](docs/PHASE_2_2_QA.md).


## Exact coded reconstruction (in progress)

**Next coded batch:** [Screens 06–15](https://sean-steve.github.io/Finance-Os/rebuild.html#screen/6) — Calendar, Accounts, Transactions, Statement Import, Transfers and Reconciliation. Reconstructed DOM layouts are interactive, but final pixel-level approvals remain pending. See [screen status](docs/EXACT_RECONSTRUCTION.md).



The first five approved screens are available as **real DOM/CSS prototype views** at [rebuild.html](https://sean-steve.github.io/Finance-Os/rebuild.html#screen/4). Navigate #screen/1 through #screen/5. These remain under visual review and **have not been approved as pixel-identical**. All other screens remain in the original screenshot viewer until individually coded. See [exact reconstruction tracker](docs/EXACT_RECONSTRUCTION.md).

## Run locally

```bash
git clone https://github.com/Sean-steve/Finance-Os.git
cd Finance-Os
python3 -m http.server 8080
```

Open `http://localhost:8080` for original design images or `http://localhost:8080/app.html#screen/4` for the older interactive finance module demonstration.

## Tests

```bash
npm run check
npm test
```

GitHub Actions additionally runs Chromium UI checks, exact-reference image loading/size/navigation tests, and representative WCAG accessibility checks before publishing to GitHub Pages.

---

# Historical Phase 2.1 implementation notes

**Phase 2.1: Complete screen-level interactive UI/UX reconstruction** — a dependency-free responsive browser prototype for financial control, budgeting, cash flow, goals, debt and wealth analysis.

## Run locally

```bash
git clone https://github.com/Sean-steve/Finance-Os.git
cd Finance-Os
git checkout phase-2/interactive-reconstruction
python3 -m http.server 8080
```

Open **http://localhost:8080**. You can also open `index.html` directly.

## Run checks

```bash
npm run check
npm test
```

No npm dependencies are required.

## What works

The application has **60 direct routes across 8 workspaces**, 9 guided journeys, a responsive navigation shell and shared design system, local demo persistence, transaction/budget/account/bill/debt/goal editors, personal/business separation, internal transfers, funding request states, CSV statement import, CSV exports, a purchase calculator, cash-flow what-if scenarios, and a transparent **rule-based** advisor demonstration.

The screens use real HTML controls rather than static image backgrounds. The original 59 image references are maintained in the separate design handoff; Screen 22 was reconstructed.

## Important status boundary

This branch is **an interactive frontend prototype, not a complete product**. It includes distinct primary content for all 60 routes, working contextual tabs, and shared state across financial workspaces. Pixel-for-pixel fidelity review of all original image references, exhaustive browser/accessibility QA, and secure production functions are **not complete**.

All demo figures are illustrative. No authentication, backend, bank/M-Pesa sync, real payments, investment quotes, genuine AI model or secure storage is connected. **Do not input real private financial records.** The data resides in browser `localStorage` and can be reset.

Read [Phase 2.1 design reconciliation and remaining gaps](docs/PHASE_2_1.md).

## Live GitHub Pages prototype

**[Open Finance OS V2](https://sean-steve.github.io/Finance-Os/)**

GitHub Pages publishes the static frontend automatically from `main` after syntax, state, and 60-screen smoke checks pass. Only `index.html` and application JS/CSS are published. Phase 2.1 was merged through pull request #1; GitHub Pages deployment completed successfully.

This is a **demo**, not a secure online banking application.

## Screens 16–26 — coded spending & budgeting reconstructions

[Open Screen 16 — Spending Intelligence](https://sean-steve.github.io/Finance-Os/rebuild.html#screen/16) · [Screen 21 — Budget Editor](https://sean-steve.github.io/Finance-Os/rebuild.html#screen/21) · [Screen 25 — Subscriptions](https://sean-steve.github.io/Finance-Os/rebuild.html#screen/25) · [Screen 26 — Recovery](https://sean-steve.github.io/Finance-Os/rebuild.html#screen/26).

Eleven distinct screen layouts are coded with local demo workflows, charts, filters and form controls. Pixel-by-pixel visual approval is still outstanding. The original Screen 22 screenshot is missing, so that editor is provisional. Financial-provider connections, actual payment restrictions and subscription cancellations are **not** active. [Track exact reconstruction status](docs/EXACT_RECONSTRUCTION.md).
