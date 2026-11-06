# Finance OS B7 — Financial Health, Advisor, Reporting, Integrations, Privacy & Security

## Purpose and trust boundary

Phase B7 completes the connected experience for Screens **56–60**. Every amount originates from POSTED **manual** KES transactions in the current PostgreSQL workspace (or B6 unverified asset/debt estimates) and never from the 60-screen static design prototypes.

- **56 Financial Health:** six-month income/expense and estimated net-worth indicators. A score is **null** because no calibrated scoring model or verified provider data exists. Insufficient evidence is not shown as a negative or zero score.
- **57 AI Financial Advisor:** `B7_RULES_V1` is an explicitly **on-server deterministic explainable rules engine**, **not** a generative AI service. It is disabled by default, owner opt-in only, never calls an external AI provider and cannot execute financial actions.
- **58 Reports:** bounded 1–12-month posted-manual KES reports and category summaries, excluding reversal-linked original entries and future-dated records. Browser CSV exports are local files of the bounded report response; no cloud transfer.
- **59 Integrations:** provider capability catalog truthfully reports `NOT_CONFIGURED` and `canConnect:false`. An owner can register `REQUEST_INFORMATION`, which remains `NOT_CONNECTED`. No account linking, OAuth, credentials, scraping or bank/tax/broker sync.
- **60 Settings, Privacy, Security & Audit:** OWNER-only append-only preference snapshots (advisor opt-in; no external analytics sharing), privacy **review** requests and bounded metadata-only security audit history. Requests are **REQUESTED**, not fulfilled. No destructive deletion or automatic data export. This is a retention/legal/privacy workflow starting point, not a full data-subject-rights implementation.

## Backend and database

Migration `011_b7_financial_governance.sql` adds owner-only FORCE RLS to three append-only tables: `b7_settings_snapshots`, `b7_privacy_requests` and `b7_integration_intents`, with FK provenance and immutability triggers. Finance application role gets SELECT and narrow INSERT only. The auth role cannot manage these tables.

Fastify `backend/src/b7.ts` exposes 13 workspace-scoped GET/POST endpoints under:

```text
/financial-health             GET
/advisor                      GET
/reports/monthly              GET
/reports/categories           GET
/integrations/catalog         GET
/integrations/requests        GET,POST [OWNER]
/settings                     GET,POST [OWNER]
/privacy/requests             GET,POST [OWNER]
/privacy/status               GET [OWNER]
/security/audit               GET [OWNER]
```

All POSTs require an `Idempotency-Key` header and are audited; no B7 endpoint writes journal entries. Role restrictions are enforced in application code **and** PostgreSQL RLS. Responses have `Cache-Control: no-store`; the browser does not save tokens, financial data, reports or privacy requests to localStorage.

## Certification

`.github/workflows/backend-b7.yml` provisions PostgreSQL 17, applies all migrations twice for checksum/idempotency checks, provisions least-privilege roles, builds TypeScript, validates OpenAPI 0.8, runs B0–B7 unit and all B1–B7 database integration suites. `.github/workflows/browser-qa.yml` includes an isolated Chromium B7 connected-client test for all five screens, report CSV, owner consent and privacy requests.

Production activation remains separate. Required gates: real OIDC MFA certification; field-level access and DPIA review; approved and tested privacy request fulfillment, legal retention and identity re-verification; backup/DR; centralized operational logs and alerts; real bank/broker integration contracts if desired; independent review of financial advice claims and optional external LLM data processing contracts. There is **no claim** that a generative AI, automatic financial provider feed, PDF report production, or automated user erasure is active.
