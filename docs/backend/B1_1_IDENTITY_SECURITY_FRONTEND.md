# Finance OS — Phase B1.1 Identity, Security and Connected Frontend

**Scope:** An OIDC-integrated backend identity path, MFA assurance checks, hardened access validation, and a separate authenticated frontend. This repository does not include a configured real identity provider or a production server deployment.

## Production identity design
- Configured OIDC provider with Authorization Code + PKCE, public SPA client, HTTPS authorization/token/JWKS endpoints, pinned issuer, audience, JWKS and MFA ACR.
- Resource server validates RS256 JWT signature (including pinned kid), issuer, audience, iat, exp, nbf, fresh auth_time, required acr and email_verified=true. Unknown signing keys and JWKS outages fail closed.
- Each verified issuer+subject uniquely maps to a Finance OS user. Matching email alone is NOT enough to link a different identity. New verified identities receive a personal workspace in the same database transaction. Every financial request still validates active workspace membership and PostgreSQL RLS.
- Passwords, MFA enrollment, password reset and account recovery belong to the configured external identity provider. There is no custom password reset pretending to be verified.
- Password login runs solely with LOCAL_AUTH_ENABLED=true on development/test; production refuses it. Public OIDC path mounts no password registration/login endpoints.
- Tokens are kept in browser memory, not stored in localStorage or sessionStorage. SessionStorage contains only ephemeral PKCE challenge data and state, which are deleted after the callback. Browser token revocation is not claimed to be global provider SSO logout.

## Production configuration (illustrative placeholders, not credentials)
NODE_ENV=production
HOST=127.0.0.1
DATABASE_URL=postgresql://finance_app:SECRET@db.example/finance_os?sslmode=verify-full
AUTH_DATABASE_URL=postgresql://finance_auth:OTHER_SECRET@db.example/finance_os?sslmode=verify-full
LOCAL_AUTH_ENABLED=false
CORS_ALLOWED_ORIGINS=https://finance.example
OIDC_ISSUER=https://idp.example/realms/finance
OIDC_AUDIENCE=finance-os-api
OIDC_JWKS_URI=https://idp.example/realms/finance/protocol/openid-connect/certs
OIDC_CLIENT_ID=finance-os-spa
OIDC_AUTHORIZATION_ENDPOINT=https://idp.example/realms/finance/protocol/openid-connect/auth
OIDC_TOKEN_ENDPOINT=https://idp.example/realms/finance/protocol/openid-connect/token
OIDC_REDIRECT_URI=https://finance.example/connected.html
OIDC_REQUIRED_ACR=provider-specific-mfa-assurance-value
OIDC_MAX_AUTH_AGE_SECONDS=3600

The access token MUST be a signed JWT issued for this API; it must include an IdP-verified email, auth_time and MFA acr claim. Many OIDC providers do not put these claims in access tokens by default; configure the provider explicitly. Token endpoints must support CORS for the SPA PKCE exchange. Enforce short-lived access tokens at the provider.

## Connected frontend
- connected.html is a separate authenticated 60-route financial workspace. It deliberately DOES NOT import rebuild/app.js, the visual prototype, or seeded localStorage balances.
- Set public connected-config.json apiBase to the HTTPS backend URL for deployment. The default is null and refuses unconfigured public access. Localhost automatically uses http://127.0.0.1:3101 for test only. Never put secrets in the JSON config.
- Screens 01-04: OIDC sign in, authenticated profile, personal/household/business workspace creation, and real manual ledger overview.
- Screens 07-13 and 15: server-backed accounts, categories, manual transactions, immutable reversal entries, statement staging, reconciliation and posted journal listing.
- Screens 05-06, 14, and 16-60: all routes are accessible but show a truthful module-not-active state, NOT fabricated budgets, safe-to-spend totals, debt, taxes, investment returns, bank balances or financial advice.
- The separate visual design prototype remains available in rebuild.html and continues using illustrative data. Do NOT confuse it with the authenticated financial workspace. B1.1 is complete ROUTING integration for 60 screens, not 60 completed backend domains.

## Deployment and security gates still required
- Real IdP connection; live MFA, account recovery and SSO logout verification; security review and pentest; system-level abuse limits/WAF; secrets and TLS certificates; database backup and tested recovery; consent/privacy/legal review; CSP connect-src restricted to actual IdP and API origins; production observability and incident response.
- Bank feeds, M-Pesa connections, actual transfers, credit-card liabilities, budgets and spending governance remain future B2/B3 phases.
- Never import prototype state automatically into real accounts. No real provider accounts or user financial secrets should be entered into public GitHub Pages.
- Production startup validation is stricter, but this is NOT a production-release certificate.
