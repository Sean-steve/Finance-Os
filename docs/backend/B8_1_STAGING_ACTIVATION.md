# Finance OS — B8.1 Dedicated Staging & Production Evidence Closure

**Implemented in source:** deployable, isolated staging API and authenticated frontend images; staging-only HTTPS/OIDC checks; strict PostgreSQL 17 role/checksum/RLS audit; operator-triggered live endpoint probes; explicit release-evidence template. **NOT yet activated:** hosted staging, production infrastructure, a real IdP enrollment, live customer data, provider sync, backup operations or legal/privacy sign-off.

## Deployment topology

Use **three distinct staging HTTPS endpoints**, not existing unrelated application accounts:

| Component | Operator-provisioned requirement | Current status |
|---|---|---|
| Authenticated staging frontend | Dedicated HTTPS staging origin and TLS reverse proxy to **127.0.0.1:8080** | Template only |
| Finance OS staging API | Dedicated HTTPS API origin and TLS reverse proxy to **127.0.0.1:3101** | Template only |
| MFA OIDC issuer | Separate Keycloak/verified IdP issuer with PKCE S256, real enrolled MFA, dedicated API audience and matching ACR | Not activated |
| PostgreSQL 17 | Dedicated `finance_os_staging` DB, trusted TLS `sslmode=verify-full`, separate migration/app/auth roles, private access | Not provisioned |
| Backup and monitoring | Encrypted off-site backup, measured restore, alert escalation, WAF/edge throttling | Not activated |

The staging containers **never expose public ports**: Compose binds only loopback. A trusted HTTPS fronting service, firewall and DNS are operator-managed prerequisites. The API runs `NODE_ENV=production` and `LOCAL_AUTH_ENABLED=false` **even in staging**, so it refuses local password authentication, missing OIDC MFA settings and insecure PostgreSQL. The independent `backend/compose.yaml` remains for localhost development only.

## Staging activation procedure (run only on an operator-owned Linux host)

1. Reserve distinct HTTPS staging UI, API and IdP FQDNs, an isolated host/network, DNS and TLS. Verify staging host identity and firewall; do not reuse a production database or unrelated application's Supabase credentials.
2. Provision **PostgreSQL 17 over trusted TLS** (not publicly accessible), database `finance_os_staging`, and three **different** identities: `finance_migrator` (DDL), `finance_app` (restricted finance), `finance_auth` (identity only). Store independent credentials in a secret store. Configure `MIGRATION_DATABASE_URL` solely for the migration task; run `npm ci --prefix backend`, `npm --prefix backend run migrate` **twice** to verify checksums, and apply `backend/scripts/provision-app-role.sql` with a privileged provisioner, never the running app account.
3. Activate a **separate persistent** staging OIDC MFA realm/provider. Verify real user MFA enrollment, recovery, token rotation, verified emails, authorization-code PKCE, allowed redirect URI `https://<stage-ui>/connected.html`, dedicated API audience, verified ACR and access-token expiry. **The repository's Keycloak CI realm and `start-dev` must never be used here.**
4. Copy `backend/deploy/staging.runtime.example` to an untracked protected host file outside the Git checkout, set `chmod 600`, and replace **every** placeholder. Set `NODE_ENV=production`, `LOCAL_AUTH_ENABLED=false`, `DATABASE_URL` and `AUTH_DATABASE_URL` with different roles and valid `sslmode=verify-full`; set all OIDC configuration and the one approved HTTPS `CORS_ALLOWED_ORIGINS` origin.
5. Set operator environment variables (URL/commit values are public; do **not** put passwords in arguments):

```bash
export FINANCE_STAGE_UI_ORIGIN='https://<staging-ui-host>'
export FINANCE_STAGE_API_ORIGIN='https://<staging-api-host>'
export FINANCE_STAGE_IDP_ISSUER='https://<staging-idp-host>/realms/<staging-realm>'
export FINANCE_STAGE_RELEASE_SHA='<FULL_40_HEX_GIT_COMMIT>'
export NODE_ENV=production
export LOCAL_AUTH_ENABLED=false
# Operator-controlled absolute host paths outside the checkout:
export FINANCE_STAGE_API_ENV_FILE='/secure/finance-os/staging-runtime.env'
export FINANCE_STAGE_WEB_CONFIG_FILE='/secure/finance-os/connected-config.json'
npm --prefix backend run staging:preflight
npm --prefix backend run staging:prepare
```

6. Validate `backend/deploy/staging.Caddyfile.example`, replace the **sample hostnames** with real DNS, and start the proxy with an approved HTTPS certificate. Inspect `backend/deploy/staging.compose.yaml`. On the host, run:

```bash
docker compose -f backend/deploy/staging.compose.yaml config
docker compose -f backend/deploy/staging.compose.yaml build
docker compose -f backend/deploy/staging.compose.yaml up -d
# After real OIDC and DB are alive:
npm --prefix backend run staging:db:certify
npm --prefix backend run staging:probe
```

The staging API **must not** be advertised until `/health/ready` returns 200, migration checksums and forced RLS pass, the web-only `connected-config.json` points exclusively to the staging API, OIDC metadata matches the exact staging issuer and redirect URI, missing tokens are denied, and CORS accepts **only** the staging UI origin. The probe makes read-only requests; it **does not** prove a successful end-user MFA login or legal/privacy compliance.

7. With explicitly created **staging test identities and synthetic records only** (never production financial data), exercise the authenticated 60-screen journey and B8 owner integrity endpoint. Confirm cross-workspace denials, immutability and reversal behaviour, loan/asset/projection separation, report counts, privacy review queues and manual KES ledger continuity. Avoid publishing private exported data in GitHub logs or test artifacts.
8. Record time-bounded, separately approved evidence for database isolation, real MFA sign-in, incident notification, TLS, backup/restore, recovery targets, financial integrity and privacy handling. Real hosting credentials remain in a secret manager, **not this repository**.

## What the automated B8.1 certification does and does NOT do

`.github/workflows/backend-b8-1.yml` runs two independent **disposable** checks:

- Docker build validation for the non-root API and restricted authenticated web images, loopback-only Compose contract, strict HTTPS/OIDC origin validation and production evidence-blocking tests.
- A fresh **CI PostgreSQL 17 database named `finance_os_staging`** to run all existing forward-only migrations, provision restricted role separation, audit schema checksums/forced RLS without workspace context, and rerun the real B8 cross-domain financial scenario.

**CI's `finance_os_staging` is an ephemeral test database, not a persistent hosted staging environment.** No infrastructure is activated, and no customer records are inserted on any live host.

A separate `workflow_dispatch` job, protected by the optional GitHub Environment `finance-os-staging`, accepts real staging URLs and SHA to perform a **read-only** remote probe; it is skipped for all normal commits. The operator must first configure that GitHub Environment and its approval policy. The probe result `STAGING_TECHNICALLY_REACHABLE` means only that the verified endpoints and public protocol contracts were reachable, **not** that a human successfully used MFA or that staging is approved to accept real financial data.

## Production infrastructure and evidence gates

A **separate** production DB, credentials, backup boundary, IdP realm, HTTPS UI/API hostnames, versioned releases, edge rate limits, monitoring and disaster recovery must be provisioned. Do not rename or repurpose staging as production. No backend deployment to a real Finance OS host has been performed by this phase.

The canonical evidence register is `backend/deploy/PRODUCTION_EVIDENCE.template.json`, deliberately with every entry `PENDING`. Copy it only into a protected external store after infrastructure and human review actually exist. Fill each of the ten B8 gates (live MFA, TLS/DNS, least privilege, staging reconciliation, observed backup restoration, monitoring incident drill, Kenyan privacy/DPIA and retention review, data rights operations, accessibility/load tests and rollback/sign-off) with independently reviewable HTTPS evidence, named approver and accurate verification timestamp. Then run:

```bash
export FINANCE_RELEASE_EVIDENCE_FILE='/secure/finance-os/production-evidence.json'
export FINANCE_RELEASE_COMMIT='<PRODUCTION_DEPLOYED_SHA>'
npm --prefix backend run release:gate -- --require-production
```

The gate checks evidence **format and freshness**, not cryptographic authenticity; even ten valid-looking entries result only in `EVIDENCE_RECORDED_PENDING_INDEPENDENT_REVIEW`. A human release manager must independently confirm all evidence, staging-to-production promotion safety, real deployment version, and compliance. **Never change `productionReady:false` based on a local test or a form submission.**

### Current release decision (B8.1)

- Code packaging and CI tests: **ready to certify**.
- Live dedicated staging: **BLOCKED — no staging host, DNS, TLS, real MFA IdP, staging PostgreSQL credentials or operator access provided**.
- Live finance production: **BLOCKED — every listed external evidence gate remains open**.
- OIDC and provider security: **no demo/local accounts or CI Keycloak realm may be reused**.
- Financial correctness: the B8 `PASS_MANUAL_LEDGER` result means **only internal manual KES ledger reconciliation**, not independent bank or market verification.

**Next practical dependency:** an operator-controlled staging host and three staging HTTPS origins, PostgreSQL 17 trusted-TLS connection plus a real MFA OIDC provider. Once provisioned, execute the documented remote checks and attach actual evidence to close each gate.
