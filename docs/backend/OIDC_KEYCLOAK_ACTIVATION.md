# Finance OS — Real OIDC provider activation / certification status

## What has been verified

The GitHub connection contains the Finance-Os codebase with OIDC resource-server validation in B1.1. No Finance OS production API/HTTPS domain or previously configured identity-provider secrets were found. The connected Supabase account has a separate AGENCY OS project, which must NOT be reused for Finance OS accounts or financial identities without a deliberate migration plan.

### Genuine provider smoke, not production enrollment

The workflow `.github/workflows/oidc-keycloak-smoke.yml` starts **real Keycloak 26.8.1** in a disposable GitHub Actions container bound to `127.0.0.1:8180`. This is not a mock JWT test or a public identity service. The imported realm is `finance-os-ci` and has disposable CI-only test accounts.

The test `backend/test/keycloak.provider.mjs` verifies:
- Live OpenID Provider Discovery and documented issuer;
- Authorization Code grant and PKCE S256 capability;
- a genuine Keycloak-signed RS256 access JWT validated against the provider's published JWKS and `kid`;
- dedicated Finance OS API audience;
- rejection of password-only authentication as proof of Finance OS MFA assurance;
- denial of password-only login for a test subject with a required TOTP registration action.

**It does not certify successful MFA, enrollment, account recovery, external availability, hardening, or production login.** Real MFA proof needs actual TOTP/passkey enrollment and an assured `acr` mapping in the deployed Keycloak authentication flow; B1.1 intentionally refuses tokens without the configured MFA assurance value and recent authentication timestamp.

To reproduce disposable provider tests locally (never bind public interfaces):
```bash
docker run --rm -d --name finance-keycloak-ci \
 -p 127.0.0.1:8180:8080 \
 -e KC_BOOTSTRAP_ADMIN_USERNAME=ci-admin \
 -e KC_BOOTSTRAP_ADMIN_PASSWORD=CI-ONLY-ADMIN-PASSWORD-NOT-A-SECRET \
 -v "$PWD/backend/keycloak:/opt/keycloak/data/import:ro" \
 quay.io/keycloak/keycloak:26.8.1 \
 start-dev --hostname=http://127.0.0.1:8180 --import-realm

node backend/test/keycloak.provider.mjs
docker rm -f finance-keycloak-ci
```

**Strictly test-only:** The CI realm contains public disposable test passwords and enables direct-access password grants solely for one protocol smoke test. Never import it into production. Keycloak `start-dev` and a local plain-HTTP issuer must **never** be exposed to the Internet or represented as production-grade security.

## What is required to activate Finance OS production identity

1. Provision dedicated persistent **Finance OS identity infrastructure** with an isolated database, backup and restore, secrets, secure admin controls, patch and update policy, HTTPS hostname, WAF and audit logs.
2. Configure a production Keycloak realm, trusted external OIDC issuer, a **public SPA Authorization Code + PKCE S256 client** whose only redirect is the Finance OS HTTPS `connected.html`, and a resource audience `finance-os-api`.
3. Enforce required email verification, TOTP/WebAuthn MFA and provider-managed account recovery. Configure an **MFA-specific ACR** value in the access token, fresh `auth_time`, `email_verified`, pinned RS256 signature and a short access-token lifespan (<15 minutes). Never treat `acr=1` password-only as verified MFA without proven provider flow mapping.
4. Make public token exchange CORS-capable only for the approved frontend HTTPS origin. Enforce strict CSP `connect-src` and exact API/IdP origins, HSTS, TLS, secret rotation, trusted reverse proxies and shared abuse-rate limits.
5. Create a separate deployed Finance OS API with `finance_app` and `finance_auth` credentials; run migrations through a **separate migrator**; do not use the financial runtime role as PostgreSQL superuser or bypass RLS.
6. Set `OIDC_* ` variables per B1.1 security document; set public `connected-config.json.apiBase` only after verified HTTPS API reachable. Do NOT include client secrets, refresh tokens, database passwords or admin keys in GitHub Pages or source control.
7. Perform actual staging login (valid MFA, invalid MFA, expired sessions, JWT rotation, revoked user, changed verified email, recovery), cross-tenant direct-API abuse tests, audit/incident response and backup restoration.
8. Only then declare production IdP **ACTIVATED & CERTIFIED**.

## Current operator decisions needed

- Decide the Finance OS-specific production IdP domain and finance API hosting domain. No domains or provisioned credentials have been attached to this project.
- Supply secure Keycloak/IdP admin credentials through a protected deployment secret store, not chat or source code.
- Connect the persistent production database and arrange an HTTPS reverse proxy; confirm provider assurance mapping via real MFA.
- Do not use AGENCY OS Supabase secrets or other projects' identities.

Current status: **genuine Keycloak protocol smoke available in CI; external Finance OS production IdP NOT ACTIVATED or CERTIFIED.** B2 development can proceed on disposable database/CI and cannot become live-user-ready until those outstanding gates are closed.
