# Finance OS — Approved Screen Fidelity Correction

## Why this correction exists

The earlier Phase 2.x build reinterpreted the originally approved screens as a shared white/green financial app. That was not the requested prototype: the user expected the **actual 60 supplied screen designs**. This correction restores the original images as the fidelity baseline and separates them from the previously developed functional modules.

## Source inventory

- 59 supplied approved design PNGs, 1536 × 1024, are converted to WebP without altering the composition, geometry or content.
- All 59 corresponding WebP reference images are now directly available as `assets/screen-NN.webp`.
- **Screen 22 — Create / Edit Budget**: the original screen image was not part of the supplied archive. Its view is explicitly marked as a reconstruction, with an editable local demonstration.
- 60 screen IDs, names and navigation routes remain mapped.

## Fidelity mode — default `index.html`

The reference viewer displays the exact screenshot image edge-to-edge at its original aspect ratio. It does **not redraw** cards, typography, charts, tabs, the sidebar or banner, so all those visible elements match the approved source. It uses *transparent overlays* for navigation and prototype inspection, leaving the screenshot content unchanged.

What can be clicked:
- The reference image's left-hand navigation region opens a searchable 60-screen directory.
- The search field region opens screen search; Ctrl/Cmd+K works too.
- Header, KPI and panel regions open a related-screen explorer.
- Next/previous buttons, direct hash navigation and native-width toggle.
- Screen 22 has a real editable local-only budget editor.

**Important:** The 59 image screens are visually exact, but **not yet reconstructed in code as live HTML components**. You cannot edit the text, bars or fields *inside the image*, and clicking an image region provides a navigation overlay rather than implementing its original form. Calling this “60 fully developed exact screens” would be misleading.

## Working finance demonstration — `app.html`

The earlier Phase 2.2 application remains available under `/app.html`. It contains real data-editing and navigation controls but does not resemble each original screenshot exactly. It is preserved solely as a functional reference for later true reconstruction.

## Engineering acceptance needed for a genuinely coded pixel-faithful prototype

For each screen 01–60, require the following:
1. Responsive CSS and real HTML elements laid out against a 1536 × 1024 reference.
2. Visual screenshot regression comparison at native reference resolution, with a defined tolerance and documented intentional dynamic changes.
3. Real interactions attached to native-looking controls, with focus, hover, loading, empty and error states.
4. Canonical financial state shared across all connected screens, with clear audit of fixture vs live data.
5. Mobile designs derived from approved desktop originals without inventing new desktop compositions.
6. Screen 22 original design supplied or reconstructed design separately approved.

Do not mark an image as a completed coded screen; maintain separate **Visual Fidelity** and **Functional Fidelity** status.

## Publication

GitHub Pages publishes only after the main-branch Chromium/browser checks pass. Static page assets include `index.html`, `app.html`, `src/`, `assets/` and `.nojekyll`. No backend, real financial account, M-Pesa integration or AI provider is connected.
