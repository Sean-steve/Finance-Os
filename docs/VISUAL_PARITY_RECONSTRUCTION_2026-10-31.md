# Finance OS — Visual Parity Reconstruction: Screens 21, 22, 33 and 40

**Date:** 31 October 2026  
**Baseline audit:** `docs/FULL_60_SCREEN_UX_CERTIFICATION.md` — 59 supplied approved references, 60 coded routes.

## What changed

- **Screen 21 — Budget Editor:** Original `assets/screen-21.webp` is a Create/Edit Budget reference. Rebuilt its four-stage stepper, budget details and embedded quick setup, source-width category allocations table, preview donut, projection, alerts and goal summary. Keeps editable native form controls.
- **Screen 22 — Create/Edit Budget:** Reconciled the already coded independent editor against the same Screen 21 source geometry. Removed duplicate JS/CSS inclusion, synchronized category allocation and rollover state with Screen 21, persisted budget templates, and repaired the lost Save click caused by re-rendering during input blur. The standalone Screen 22 original was never supplied; this uses Screen 21 as the explicitly identified design reference.
- **Screen 40 — Affordability Simulator:** Replaced the overflowing generic dashboard order with source-aligned simulator → center financial results/graphs → right vehicle purchase summary. Reused a narrow **cropped region** of the user-provided Screen 40 mockup for the vehicle photo, without overlaying an entire screenshot over the frontend.
- **Screen 33 — Cash Flow Forecast & Runway:** Added a 12-month editable scenario, source-led balance line and income/expense columns, standalone runway chart, scenario cards, driver summaries and assumptions panel. Financial projections remain illustrative and user-editable.

## Measured visual differences

All images were compared at **384×256 RGB** after rendering the coded interface at **1536×1024**, using the matching approved references, except Screen 22 (compared to Screen 21's reference). Lower differences are better. This metric is a **diagnostic**, not a sign-off.

| Screen | Original audit (RGB/255) | After this reconstruction (RGB/255) |
| --- | ---: | ---: |
| 21 | 23.80 | **20.449** |
| 22 (vs #21 design) | Not applicable | **19.363** |
| 33 | 31.11 | **27.606** |
| 40 | 32.75 | **28.579** |
| 59-screen average | 27.18 | **24.769** |

Note: The average comparison spans other shared styles introduced between audit runs; not all of the difference should be attributed to this specific PR.

## Automated verification

**14/14 targeted browser checks passed**, verifying:
- Budget 21/22 source component structure, screen 22 save and template persistence, rollover and cross-editor allocation continuity.
- Screen 40 three-column layout, editable affordability calculation, saved scenarios, mobile width.
- Screen 33 forecast/runway structure, form recalculation and mobile width.
- No uncaught browser JavaScript exceptions.
- Full-page screenshots at 1536×1024 and 390px mobile for target screens.
- Reference-versus-coded comparison and ranked review of all 59 approved images.

Screens **01–20, 23–32, 34–39 and 41–60** remain **unapproved** for visual parity; many retain material differences. Screen 01 is the highest remaining pixel divergence. **Do not call the system pixel-perfect or production-certified.**

## Important limitations

This repository is a browser-local static prototype, not a live banking, investment, tax, regulatory, identity, security or AI service. Model-based cash forecasts, loan calculations, payments and provider states remain demo only.

## Recommended next visual correction queue

1. **Screen 01** — Authentication responsive showcase: latest difference ~41.88/255.
2. **Screen 42** — Scenario planning: ~28.09/255.
3. **Screen 29** — Income planning: ~27.89/255.
4. **Screen 24** — Spending Guardrails: ~27.78/255.
5. **Screen 43** — Debt management: ~27.26/255.

Continue screen-by-screen visual/functional remediation, then rerun the full comparison until the accepted target is reached.
