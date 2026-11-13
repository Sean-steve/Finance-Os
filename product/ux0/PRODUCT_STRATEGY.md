# Finance OS V3 — UX0 Product Strategy & Investment Thesis (Hypotheses)

**Status: UX0 strategy specification, not customer validation or investor certification.** Owner feedback (2026-11-13): the connected backend frontend feels like a series of numbered HTML pages with too much scrolling and too little meaningful visual feedback. The solution is a product-experience reconstruction, not more screens.

## 1. One-sentence product promise

**Finance OS helps individuals understand what happened to their money, what is coming next, and which manageable action will improve their financial position.**

Public positioning candidate: **"Know your money. Plan your next move."**
Internal product category: **personal financial decision workspace**. It is not a bank, money-transfer service, investment adviser, insurer, lending service or custodian.

The UX must deliver four answers within a short check-in:
1. **Where do I stand?** Available *recorded* money, income, expenses, upcoming bills, visible data gaps.
2. **What changed?** Trends and material changes over a chosen period.
3. **What needs attention?** Specific due bills, budget overruns, suspiciously missing records, upcoming shortfalls.
4. **What should I do?** A single recommended next action supported by facts and directly actionable in the app.

## 2. Beachhead customer — hypothesis, not a measured market

**Candidate initial segment:** adults in Kenya who manage day-to-day finances with a combination of salary and/or side-business income, cash, M-Pesa, multiple banks, recurring obligations and savings goals. KES-first, low-friction mobile experience. Profile **not** assumed to be representative without interview evidence.

**Early adopter archetypes to test (hypotheses):**
- **Mixed-income planner:** income arrives unpredictably, needs to plan obligations and distinguish expected from received money.
- **Salary-and-side-hustle coordinator:** juggles bank and mobile money records, aims to stop spending leaks and build a reserve.
- **Goal-focused saver:** wants to know if monthly progress is sustainable without double-counting virtual savings allocations.

**Jobs to be done:**
- *When payday, business payment or expense happens, I want to record it in seconds so my position stays credible.*
- *Before spending, I want to see committed obligations and uncertainty so I do not mistake an estimate for actual money.*
- *At the end of the week, I want a simple account of what changed and the one thing to fix next.*
- *When saving or paying down debt, I want visible progress grounded in my real recorded financial activity.*

**Alternatives to test in interviews:** M-Pesa/bank statements, notebooks, spreadsheets, native bank dashboards, general budgeting apps, and doing nothing. We do **not** assert competitive superiority or willingness to pay.

## 3. Market evidence (context, not TAM or PMF)

- KNBS / CBK / FSD Kenya 2024 FinAccess reported **84.8% formal financial access** and **82.3% mobile-money usage** in Kenya. This supports a digital finance *context*, not a proven Finance OS addressable market or user acquisition channel.
- Monarch's current public onboarding/help emphasizes dashboard widgets, accounts, budgets, recurring bills, goals and reports. Treat this as a structural competitive reference, not a licensing relationship or a mandate to copy.
- Safaricom Daraja provides developer-facing M-Pesa payment APIs. This **does not** mean unrestricted access to users' historical account statements; investigate authorized data portability/partnership pathways separately.
- ODPC registration and applicable Data Protection Act duties must be evaluated before real-person testing. DPIA necessity depends on high-risk processing; do not treat the existing B7 privacy request queue as fulfillment or a legal approval.
- Any future payment execution, lending, investment advice or custody feature requires a separate legal/regulatory assessment before planning a launch.

**Primary sources (accessed 2026-11-13):**
- https://www.knbs.or.ke/reports/2024-finacess-household-survey-report/
- https://www.centralbank.go.ke/2024/12/13/10960/
- https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch
- https://developer.safaricom.co.ke/apis/GettingStarted
- https://www.odpc.go.ke/faqs/
- https://www.centralbank.go.ke/bank-supervision/

## 4. Value proposition and strategic choice

| Decision | V3 stance | Explicit exclusion |
| --- | --- | --- |
| First value | Clear recorded position and next obligation in one visit | A dashboard that is only descriptive |
| Daily habit | Record/review transactions, capture obligations, show progress | Fifty manual forms on first login |
| Data trust | Indicate source, date and confidence per financial figure | Treat user entry, estimate and bank verification as equal |
| Guidance | Explainable, grounded recommendations with direct action | Generic AI advice, investment predictions, hallucinated amounts |
| Savings | Virtual planning goals with visible funding source | Pretend money bucket is a bank balance |
| Access | KES-first mobile-responsive web app | Mobile-only app before real usage evidence |
| Monetization | Test a transparent subscription hypothesis | Charge for real money movement or sell financial records |

**Potential differentiated advantage to validate:** a single answer-driven workspace for *mixed-income + mobile-money-first financial planning*, built on a strict journal-backed internal truth model. Nothing here establishes product-market fit.

## 5. Proposed MVP wedge and what is deliberately later

**Private alpha (UX3):** authentication, guided first account, transaction, verified *manual* ledger balance, command centre, chart for records that exist, immediate next-action card.

**Beta candidate (UX4):** monthly budget, bill due list, income sources, cash-flow outlook, goal tracking, privacy controls and an explanation of assumptions.

**Post-beta depth (UX5):** debt/wealth projections, monthly insights, comprehensive reports, scenario planning, optional integrations after technical and legal verification.

**Not initial release blockers:** every legacy screen looking polished; automated banking and M-Pesa feeds; generative-AI assistant; payment execution; autonomous transfers; provider-verified investment performance; tax filing; legally effective estate plans.

## 6. Define real activation, value and retention

**North Star (proposed): Weekly Financial Clarity Action (WFCA)** = unique consented user who in a rolling 7-day period **(a)** viewed a populated financial summary sourced from recorded data **and (b)** completed at least one actual financial action (recorded a posted manual transaction, reviewed a due bill, updated a budget, or progressed a savings goal). Deduplicate per user per week. A login or screen view alone does not count.

**Primary funnel:**
1. Authenticated registration completed;
2. Workspace/account created;
3. First valid manual income or expense posted;
4. First reliable summary viewed with data provenance;
5. User completed a recommended/selected next action;
6. Returned for another meaningful action within seven and 28 days.

**Guardrails:** financial reconciliation errors must be **zero** in certification, no spoofed verified balances, no disclosure of private financial values in analytics, no misleading claims of payment/approval/custody.

**Proposed research success thresholds (NOT actual results):**
- 20–30 problem interviews from at least two behavioral subgroups before locking the proposition.
- 8–12 moderated clickable-prototype tests on top three journeys; record raw task completion and assistance needed.
- Before controlled beta, aim for >=80% independently completed first-account + first-transaction journey and a <=5-minute median time to first meaningful record; adjust after baseline.
- After compliant opt-in beta: monitor week-1/4 retention and 7-day WFCA cohorts; no retention estimate until observed.
- Pricing: conduct explicit willingness-to-pay conversations and preferably a real, authorized pricing experiment; do not invent ARR, churn or CAC.

**Instrument only privacy-safe event metadata** (action name, duration, state, aggregate error type). Do not capture balances, payees, memos, account names, transaction content, emails or credentials in telemetry. User privacy consent, retention policy and compliance review precede external tracking.

## 7. Investor diligence evidence register

| Question | Required evidence | UX0 status |
| --- | --- | --- |
| Is the pain real? | Interviews with verbatim consented notes, frequency/severity | **NOT COLLECTED** |
| Why this segment? | Segmentation, competitor workflow comparison, willingness to switch | **HYPOTHESIS** |
| Is the product desirable? | Moderated task observation and qualitative feedback | **NOT TESTED** |
| Can it be delivered accurately? | Existing B0–B8.1 CI + V3 real user workflow/reconciliation tests | **LEGACY CI ONLY** |
| Does it retain? | Consented cohort activation/retention, meaningful actions | **NOT MEASURED** |
| Will people pay? | Pricing experiment, paid beta, net receipts | **NOT MEASURED** |
| Is it safe to launch? | OIDC MFA, hosted data protection, legal/privacy, recovery and independent approval | **BLOCKED** |
| Can it scale commercially? | TAM/SAM/SOM model from sourced addressable definitions, acquisition and unit economics | **NOT MODELED** |

There is **no credible valuation, growth forecast or investment readiness certificate** implied by completing UX0.

## 8. Decision rules and trade-offs

- Start with user problems and source-backed financial truth; cut or defer superficial feature breadth.
- Do not carry forward 60 numbered views as 60 top-level navigation choices.
- Preserve existing B1–B8.1 financial backend until proof a contract needs migration.
- Keep local password auth dev-only. Production still needs real OIDC MFA and infrastructure evidence.
- Strongly prefer accessible reusable components and mobile readability over animation as decoration.
- Pair every visual summary with a drill-down path to its underlying records, period and assumptions.
- Treat marketing claims and generated product screenshots as clearly illustrative until they represent tested product functionality.

## 9. Open choices for actual user research

1. Which subgroup feels the pain most acutely and has daily/weekly motivation?
2. Is manual entry acceptable without M-Pesa statement import, and for how many days?
3. Are bills or budgeting the primary week-1 return trigger?
4. Is a weekly money review more valuable than a constantly updated dashboard?
5. What is the willingness to pay for *manual-only* Finance OS versus provider-connected Finance OS?
6. Is individual-first right, or should a small independent business owner be the first adopter?
7. What data completeness threshold is required before showing planning estimates?

**Exit from UX0:** a testable proposition, routes and trusted-data rules, wireflow spec, design direction and prioritized UX1/UX2 work. **Research, market validation, prototype usability certification and launch approval occur later.**
