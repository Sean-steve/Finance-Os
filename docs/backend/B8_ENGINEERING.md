# Finance OS — Phase B8 Full-System Reconciliation, Security & Production Readiness

**Status:** B8 code and disposable CI certification; **production NOT authorized**. All 60 screens are connected to backend domains implemented in B1–B7, subject to explicit limitations of manual-only evidence. This is not proof of a live deployment, external account integration or compliance.

## 1. Financial correctness and internal reconciliation

New read-only owner-scoped endpoint:

`GET /v1/workspaces/{workspaceId}/certification/financial-integrity`

It reconciles current workspace data in one restricted PostgreSQL transaction:

1. Posted journal totals: each journal has >=2 lines and equal debit/credit minor units.
2. Every KES manual transaction has a POSTED journal in the same currency.
3. Transaction signed amounts equal linked ASSET-account journal effects, including immutable compensating reversals.
4. The aggregate account cash effects equal the manual KES asset-ledger balance.
5. Current user-reported B5 loan debt and B6 manual asset/investment/liability estimates feed an **estimated** net-worth projection; virtual B4 earmarks and B5 pension illustrations cannot be double-counted.
6. B3 bill settlement, B5 debt repayment and tax-payment links remain **manual references**, never proof of a provider payment.

Statuses: `PASS_MANUAL_LEDGER`, `FAIL`, or `INSUFFICIENT_EVIDENCE`. A passing report **does not** certify bank reconciliation, market valuations, investment returns, data-completeness, production activation, or financial statements. Empty workspaces produce `INSUFFICIENT_EVIDENCE`, not a misleading green zero.

The authenticated owner's Settings/Security **Screen 60** exposes a user-initiated read-only check. No polling/implicit movement of money occurs. Other workspace roles cannot request the integrity report. The API produces no raw bank records, private audit details, credentials or individual financial transaction identifiers.

## 2. Production hardening

- `backend/src/server.ts` refuses to **listen in production** if the database migration readiness check is not HTTP 200.
- Existing `backend/src/config.ts` forbids production local-password login, requires provider-verified OIDC/MFA configuration, separate finance/auth connections, explicit HTTPS origins and PostgreSQL certificate mode.
- `finance_app` cannot migrate or own tables. Workspace operations execute under transaction-scoped SET LOCAL and active-membership row-level security. Owner-only B7 privacy records are immutable.
- POST finance/domain state changes require idempotency. Posted double-entry journals are immutable; corrections post compensating entries.
- HTTP responses are no-store; logs redact sensitive bearer/credentials, and errors do not return raw SQL or private financial bodies. Live centralized monitoring and incident response are **still required**, not silently activated here.
- In-memory IP throttling is defense in depth only. **Deploy a shared edge/WAF rate limit** before public traffic.

## 3. Repeatable CI certification

`.github/workflows/backend-b8.yml` on pull requests and main runs:

1. Node 22 locked install, strict TypeScript, OpenAPI 0.9, B0–B7 unit suites.
2. All forward-only PostgreSQL 17 migrations, reapplied to verify checksums, separated least-privilege database roles.
3. B0–B7 database suites including real auth, RLS, ledger, debt, wealth, privacy; B8 cross-module two-tenant golden scenario with income, expense, compensating reversal, debt, valuation, B4 earmark and B7 privacy/settings.
4. B8 owner-only read-only financial-integrity test and cross-workspace privacy denial.
5. **Disposable test-only** PostgreSQL 17 dump/restore into a uniquely named new database, comparing schema checksums, journal and transaction records, journal amount totals and private-record counts. This deliberately does **not** test live backup schedules, offsite encryption, disaster recovery RTO/RPO, point-in-time restoration or production recovery.
6. Fail-closed release-gate test confirming **PRODUCTION_BLOCKED** without real operator attestations.
7. Browser CI tests the complete 60-screen design and connected B8 integrity UI with explicit "not bank verified" disclosure.

Local manual test (only against a brand-new disposable database, never production):

```bash
cd backend
npm ci
npm run build
npm run contract:check
npm test
# Provision a brand-new PostgreSQL 17 test DB and finance_app / finance_auth as in README.
npm run migrate
npm run test:b8
node --test test/release-gate.test.mjs
npm run release:gate -- --assert-blocked
```

## 4. Production release decision: separate, evidence-based

Release command (does not deploy or externally validate evidence):

```bash
FINANCE_RELEASE_EVIDENCE_FILE=/secure/path/production-evidence.json \
FINANCE_RELEASE_COMMIT=<40-character-commit-SHA> \
npm --prefix backend run release:gate -- --require-production
```

The evidence file is **not committed**. It must specify `environment:"production"`, an HTTPS `origin`, the exact `releaseCommit`, and ten named verification records. Each record requires `status:"VERIFIED"`, an HTTPS `evidenceRef`, named `approvedBy`, and ISO `verifiedAt` no more than 30 days old. This checks operator-submitted evidence **syntax and recency only**. It cannot cryptographically verify the source, test live IdP, inspect secrets, prove GDPR/Kenya Data Protection Act compliance, or grant deployment authorization.

Mandatory independent gates:

| Gate key | Required external proof |
| --- | --- |
| live_oidc_mfa | Real issuer, MFA, role authorization, session revocation and incident recovery tested |
| production_tls_dns | HTTPS, HSTS, DNS, trusted cert, CORS and edge WAF verified |
| least_privilege_database | Isolated DB roles, migrations, RLS, encryption and DB access reviewed |
| staging_cross_module_reconciliation | Real staging identities, tenant boundary and end-to-end business workflows verified |
| backup_restore_observed | Encrypted backup location, recent independently restored backup, measured RTO/RPO |
| monitoring_alerts_incident_drill | Production logs with privacy redaction, alert paging, runbook and incident drill |
| privacy_dpia_retention_review | Owner/operator approval of Kenyan privacy/DPIA, data minimization and retention basis |
| privacy_requests_operational | Human-reviewed export/access/erasure operational process with identification and legal holds |
| accessibility_performance | Real representative-device, accessibility and load testing |
| deployment_rollback_and_signoff | Versioned deploy, rollback proof, change approval and named accountable owner |

**Any missing/expired evidence -> PRODUCTION_BLOCKED.** Even a complete evidence file produces `EVIDENCE_RECORDED_PENDING_INDEPENDENT_REVIEW`, not an automatic declaration of production safety. Formal human review and host-level verification remain necessary.

## 5. Staging / production operations and rollback

1. Provision a **separate** staging DB and dedicated OIDC MFA IdP (not local passwords). Store secrets only in an approved secret manager. Use trusted TLS and a private PostgreSQL network.
2. Deploy a tagged/committed version after tested `npm ci`, `npm run build`, migration checksum verification and restricted grants; check `GET /health/live`, `GET /health/ready`, and `/v1/meta` (`productionReady:false` until all external gates close).
3. Exercise 60-screen authenticated journeys and the owner finance-integrity endpoint. Record actual ledger evidence, never screenshots from a prototype fixture.
4. Verify offsite encrypted backups, restore into an **isolated** environment, reconciliation parity, retention/legal permissions, recovery plan and measurable restore time.
5. Configure monitored alerts for HTTP 5xx, lockout/rate limit, database failures, migration readiness 503s, audit anomalies and backup failure. Avoid raw request payloads or passwords in log exports.
6. Before opening external traffic, obtain sign-offs on privacy handling, access segregation, provider contracts, rate-limit policy, rollback rehearsal, restore evidence and run `release:gate -- --require-production`.
7. Rollback **application** revision by immutable release artifact; never reverse an applied financial migration or mutate posted journals. If a schema migration is incompatible, do a reviewed, additive forward migration and restore from an independently verified recovery point only under an incident/change-control plan.

**Unfinished production dependencies are visible by design.** B8 certification proves application + disposable PostgreSQL invariants, not live financial/provider authority.
