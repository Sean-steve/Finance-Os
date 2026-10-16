# Finance OS V2

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
