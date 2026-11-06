# Finance OS B6 — Net Worth, Assets, Liabilities, Investments & Wealth Analytics

## Architecture

B6 adds **manual-only** asset, investment and non-loan liability registers with append-only KES valuation history. In the connected authenticated experience, Screens **50–55** use database-backed workspace records, not demo fixtures.

Migration: `010_b6_wealth_analytics.sql` (forward-only and checksum-bound). API: `backend/src/b6.ts`. OpenAPI version `0.7.0`.

| Source | Included in current estimated net worth? | Authoritative quality |
| --- | --- | --- |
| B1: POSTED manual KES CASH/BANK/MOBILE_MONEY asset ledger | Yes, positive balances as cash assets, negative as overdraft liabilities | POSTED_MANUAL_LEDGER (not provider verified) |
| B6: user-estimated property, land, vehicles, equipment, business or other assets | Yes, current latest self-reported value | USER_ESTIMATE |
| B6: manually entered investment positions | Yes, current self-reported estimated position value | USER_ESTIMATE |
| B5: self-reported loan debt less non-reversed manual principal cross-references | Yes, reported outstanding as liability | USER_REPORTED_WITH_MANUAL_CROSS_REFERENCE |
| B6: other non-loan obligations, not already recorded as debt or bill | Yes, latest reported amount | USER_ESTIMATE |
| B4: virtual bucket and goal assignments | **No**; these are earmarks of existing B1 cash, not new money | PLANNING_ONLY |
| B5: hypothetical retirement forecasts, insurance cover limits and tax estimates | **No**; forecasts/coverage are not assets, tax estimates are not established liabilities | ADVISORY |
| B3: future bills and income estimates | **No**; no double counting of future cash-flow expectations | USER_ESTIMATE |

All sums use safe integer minor units; aggregation fails closed on overflow and refuses to silently truncate a workspace with more than 500 records in any source.

## Domain and security rules

- `b6_assets`, `b6_investments`, `b6_liabilities`, `b6_valuations` have `workspace_id`, composite foreign keys, immutable inserts and FORCE RLS.
- Active workspace membership permits reads. OWNER/ADMIN/EDITOR may append records and valuations. VIEWER cannot write.
- Any POST requires a unique idempotency key. Replay returns HTTP 200, creation HTTP 201. Cross-workspace references are blocked by RLS/FKs.
- Date-stamped valuations remain append-only. An archived or deleted valuation cannot rewrite history; each dashboard uses the most recent recorded estimate by date.
- All money is integer KES minor units. Investment quantity is integer **millionths of a unit**, not a fabricated price feed. Cost basis and market value are strictly user-entered total amounts.
- User input cannot mark a value as `providerVerified`, turn on asset custody, claim completed trades, or import passwords/token/identities. Exact record fields are validated with strict Zod schemas.
- `/wealth/analytics` reports estimated cost-vs-value differences and portfolio share percentages, **not** time-weighted returns, annualized yield, verified performance or investment advice.
- No wealth API writes to B1 journal entries or sends funds, broker orders, portfolio rebalances, tax payments, dividends or corporate actions.

## Endpoints

```text
GET /v1/workspaces/{workspaceId}/wealth/summary
GET /v1/workspaces/{workspaceId}/wealth/analytics
GET,POST /v1/workspaces/{workspaceId}/wealth/assets
GET,POST /v1/workspaces/{workspaceId}/wealth/investments
GET,POST /v1/workspaces/{workspaceId}/wealth/liabilities
GET,POST /v1/workspaces/{workspaceId}/wealth/assets/{assetId}/valuations
GET,POST /v1/workspaces/{workspaceId}/wealth/investments/{investmentId}/valuations
GET,POST /v1/workspaces/{workspaceId}/wealth/liabilities/{liabilityId}/valuations
```

## Certification

Run from `backend/`, against disposable PostgreSQL 17 using an administratively provisioned `finance_migrator`, `finance_app` and `finance_auth`:

```bash
npm ci
npm run check && npm run contract:check && npm test
npm run migrate
# Re-run scripts/provision-app-role.sql as the migrator with both app_password and auth_password
npm run test:b6
```

GitHub Actions `.github/workflows/backend-b6.yml` runs all B0–B6 financial regressions, TypeScript, contract validation, migration checksums and asset valuation security tests. Browser QA runs the connected six-screen flow with CI-only mocked API data.

**Production status:** Not certified for provider-connected wealth or money operations. Production gates require verified identity, backup/DR, secrets, observability, privacy retention, explicit asset/portfolio provider contracts, currency conversion/FX policy, valuation provenance and independent investment/tax advisory review.

**B6.1 suggested:** authorised provider integrations, documented valuation sources and a historical performance methodology; do not infer ownership or actual holdings from self-reported data.
