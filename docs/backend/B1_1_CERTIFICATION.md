# B1.1 — Engineering certification matrix

| Requirement | Automated gate | Production status |
| --- | --- | --- |
| OIDC signature, key selection, issuer/audience | Unit JWT signature tests | Repo check |
| MFA acr + fresh auth_time + verified email | JWT rejection tests | Repo check; live IdP pending |
| Local password forbidden in production | Configuration tests | Repo check |
| Separate finance/auth database roles | PostgreSQL RLS / B1 integration | Repo check |
| Account takeover via email matching denied | Real PostgreSQL OIDC test | Repo check |
| Cross-workspace finance access denied | PostgreSQL OIDC + B1 tests | Repo check |
| Balanced immutable ledgers and reversals | B0/B1 CI | Repo check |
| 60 routes never render demo data in connected app | Static browser tests | Repo check |
| Public frontend fails closed without API URL | Connected shell tests | Repo check |
| Account recovery, MFA enforcement with real IdP | Operator / staging | OPEN |
| Distributed WAF/rate limiting, HSTS and CSP deployment | Hosting / security | OPEN |
| Penetration test, privacy review, backup and restore | Operations | OPEN |
| End-user production financial account readiness | All above | NOT CERTIFIED |

Completion of repo tests cannot certify an actual OIDC provider, operational compliance or independent financial controls.
