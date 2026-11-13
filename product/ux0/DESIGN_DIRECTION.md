# Finance OS V3 — UX0 Premium Design Direction

**Status: proposed visual and interaction direction.** This is a design brief, not completed visual components or verified accessibility. UX1 must produce actual Figma/browser prototypes and obtain user sign-off before UX2 code reconstruction.

## 1. Design thesis

**Financial calm, not finance administration.** A trusted, modern operating surface that feels more like a well-designed financial companion than an ERP or a form catalog.

Three adjectives: **clear, assured, effortless**.

- **Clear:** can immediately see the position, a visual trend, an obligation and a next action.
- **Assured:** financial data has provenance, clear disclosure and no fake certainty.
- **Effortless:** repetitive tasks are fast, focused, contextual and reversible.
- **Pleasant:** restrained visual detail, responsive interactions, beautiful graphics and consistent page rhythm. Premium does **not** mean excessive glassmorphism, animation or dozens of cards.

**What to retain from the original visual history:** recognizable forest/emerald financial-brand palette, seriousness, data density when needed, and the 60 approved screenshots as inspiration/reference. **What to replace:** numeric menu navigation, multi-column card walls, long explainer sections, constant green hero banners, oversaturated CTA buttons and plain HTML table-first dashboards. Pixel-accurate legacy reproduction is no longer the V3 navigation requirement; original assets remain archived.

## 2. Proposed token foundation for UX1 (not final colors)

| Token role | Proposal | Use |
| --- | --- | --- |
| Brand forest | #07483C | Logo, primary brand, selected control |
| Deep ink | #102A26 | High contrast text and headings |
| Surface | #FFFFFF | Focused modules, forms and drawers |
| Canvas | #F6F8F7 | Spacious neutral background |
| Emerald action | #087D5D | Primary interaction; contrast to be verified |
| Border | #E1E9E6 | Subtle section separation |
| Supporting muted | #58736C | Subtext and provenance |
| Warning | #8B5A19 | Pending bill, partial data; always pair with label |
| Danger | #A53636 | Actual error/overdue; never red alone |
| Positive | #12785A | Recorded progress; never claim verification from color |

Accent is an interaction color, **not** a background for every card. Use semantic tokens (background, foreground, muted, border, positive, warning, danger, chart-series) with checked WCAG AA contrast and dark mode exploration later.

**Typography:** propose Inter or Manrope with system-safe fallback; figure precision with tabular numerals. Headline 28–32px desktop / 24px mobile; section title 18–22px; body 14–16px (prefer >=16px in forms); meta 12–13px only when contrast is sufficient. Use consistent numerals, KES formatting and visually unambiguous negatives.

**Spatial rhythm:** 4/8px base grid; layouts with generous whitespace but not wasted vertical space. Suggested radii 12–16px for cards and 10–12px for controls. Light shadows only on elevated drawers/popovers. Desktop 12-column dashboard grid, max working content width ~1440px; deliberate 1-column collapse by 320px.

## 3. Visual anatomy (must be demonstrated in UX1)

**App chrome**
- Thin topbar with workspace and account control; sidebar with eight destination icons + readable labels.
- Sidebar 224–248px, collapses; each destination has a single active indicator and optional badge with meaningful count.
- Mobile sticky bottom nav with five entries, page title/quick Add above; More sheet for lower-frequency destinations.
- Login is a separate focused page with no authenticated navigation.

**Dashboard first viewport**
- One prominent recorded-position card (large amount, provenance label, period/source badge, link to underlying accounts).
- Compact income/expense comparison and a **single** "Do this next" card with action button.
- Main income-vs-expense chart with selectable 30/90-day period; do not fabricate empty historical intervals.
- Upcoming bills list with count and due labels; budget/goals progress further down with show-all link.
- Limit hero copy to one line; no rotating announcements, unused marketing banners or permanent disclaimers occupying prime space.

**Subpages**
- Each page follows: specific title + small descriptive context, 2–4 useful summary indicators, the **main visual or list**, relevant filter/action. Secondary settings via drawer/tabs, not another long card tower.
- Tables only where density and comparison benefit; desktop sorting/filtering with stable sticky headings, responsive stacked transaction rows on mobile.
- Forms in modal/drawer or focused wizard steps, 1–3 fields per logical group, defaults from existing context, clear confirmation and undo/reversal rules.

## 4. Chart grammar and financial truth

Every chart must answer one question; no decorative line chart just to look investor-ready.

| Question | Pattern | Source | Drill-down |
| --- | --- | --- | --- |
| Did spending rise? | Daily/weekly time-series bar or line with comparison | Posted transactions only | Filtered transaction list |
| Where did money go? | Horizontal ranked categories, optional segmented donut | Manual category postings | Category details |
| Can I cover upcoming bills? | Dated obligation timeline / stacked forecast | Scheduled bills + recorded money, assumptions | Bill detail & forecast assumptions |
| Am I on budget? | Progress against plan with accessible labels | Budget + categorized posted spend | Budget editor |
| Is a goal progressing? | Progress track with source breakdown | Saved goal + virtual allocations / actual funding flags | Goal |
| How has estimated net worth changed? | Source-labeled line with uncertainty | B6 dated manual values only | Asset/liability detail |

**Requirements:** axis labels, contrast, hover/focus/tap tooltips, accessible table equivalent for each chart, zero vs missing handled distinctly, no interpolated invented values, relative/absolute comparison clearly marked, currency/time zone/period stated, keyboard support. "Not enough recorded history" is a valid result.

**Do not use** unverified "safe to spend" banners, projected income as cash, scenario-based returns as real portfolio performance, or line charts with fabricated data to fill gaps.

## 5. Functional component inventory for UX1 / UX2

**Foundational:** AppShell, Sidebar, MobileNav, Topbar, WorkspaceSwitcher, CommandAction, PageTitle, Breadcrumb, Button, Input, Select, CurrencyInput, DateField, Dialog, Drawer, Tabs, Toast, Skeleton, ErrorBanner, EmptyState, Confirmation, StatusBadge, ProvenanceBadge, PeriodPicker, DisclosurePopover.

**Financial:** PositionCard, MetricDelta, SpendingTrendChart, CategoryBreakdown, BillDueList, TransactionFeed, TransactionComposer, BudgetUsageCard, SavingsGoalCard, CashFlowForecastTimeline, DataCompletenessIndicator, RiskAndOpportunityCard, SourceDetailsPanel, ManualLedgerIntegrityStatus.

**Interactions:** quick add action palette, contextual edit drawer, click-to-filter charts, editable budget line items, source-linked figures, cross-page return path, keyboard nav, focus trap/restore, non-intrusive success feedback. Form validation before mutating; idempotency on backend.

**Motion:** 120–220ms subtle transitions for navigation and drawers, simple state changes; animations never imply money moved before the server confirms. Respect reduced-motion preference. No parallax, bouncing dashboards, auto-playing carousels or random celebration confetti.

**Copy:** verbs and outcomes ("Record expense", "Review bill", "Create goal"), no numbered screen labels. Short, specific, non-judgmental error recovery. Replace "Financial Ledger" tech copy with "Recorded transactions" for general users while keeping technical audit detail in settings.

## 6. UX1 deliverables and review protocol

1. **Moodboard / reference principles** as a small set of approved design directions, with visible differences between premium, legible and dense options.
2. **Token library** with tested light theme, dark theme exploration, type scale, spacing, elevation, status states.
3. **Five high-fidelity anchor designs:** authentication, first-value onboarding, Home command centre, Activity transaction view/Add drawer, Spending budget view; plus representative Cash Flow and Goals modules.
4. **Desktop and mobile** 1440px, 1024px, 768px, 390px, 320px breakpoints; accessibility state samples.
5. **Charts, empty/loading/error/different-provenance states** on actual designed components, not lorem ipsum or fake "live" customer data.
6. **Clickable prototype** for first-value, monthly-control and financial-progress journeys.
7. **Design-to-implementation handoff** (component variants, constraints, tokens, routing, events, API data requirements, decision log) with a finite scope.

**UX1 is accepted when** a reviewer can complete the three flows in the clickable prototype, core UI has no numeric nav/auth menu, key values show source/period, charts have no fabricated datapoints, mobile remains usable at 320px, and measured feedback is documented. Frontend engineering starts in UX2 only after the selected direction is approved.

## 7. Anti-patterns to eliminate

- 60 numbered menu entries or "Welcome & Authentication" in the authenticated sidebar.
- Large banner repeated on every module; endless explanatory paragraphs above action.
- A card for every possible API response; nested card-on-card-on-card layouts.
- Busy charts without source trace; charts with repeated sample data presented as actual.
- "AI advisor" claims without an activated provider or provable heuristic provenance.
- Buttons saying "Pay" or "Transfer" when only a manual record or approval is created.
- Hard-coded balances, imported screenshots masquerading as DOM and fake bank-verified badges.

**UX0 decision:** design begins with financial outcomes; visual style follows information hierarchy. UX1 must be a usable interface prototype, not another gallery of separate disconnected pages.
