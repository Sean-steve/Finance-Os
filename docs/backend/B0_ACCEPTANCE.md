# Finance OS — B0 Acceptance Matrix

| Gate | Automated evidence | Required outcome |
|---|---|---|
| Existing frontend unmodified | Compare PR diff against `rebuild/**`, `index.html`, `app.html` | Only backend and docs/workflow change |
| Strict TS compilation | `npm --prefix backend run build` | PASS |
| OpenAPI 3.0 schema lint | `npm --prefix backend run contract:check` | PASS and no unresolved references |
| Planned API truth | `npm --prefix backend test` | 25 finance operations marked PLANNED, health/meta live |
| SQL migration replay | `npm --prefix backend run migrate` twice | APPLIED then SKIP; changed SHA rejects |
| PostgreSQL 17 schema | Disposable CI PostgreSQL service | tables, FKs, checks, extensions created |
| Tenant separation | App role and `SET LOCAL` tests | Deny without scope; one tenant per transaction |
| Privilege separation | App read-only; migration role separate | Financial inserts denied in B0 |
| Financial integrity | Integration test | Unbalanced post rejected; balanced post immutable |
| Audit evidence | DB append-only trigger and policy | No in-place audit modifications |
| GitHub Pages | Existing frontend publish pipeline | Unaffected |
| Production deploy | Not part of B0 | **NOT STARTED** |

## Mandatory transition decisions before B1

- Confirm primary login provider (OIDC) and account recovery/MFA UX. No fake demo login in production.
- Approve personal vs business vs household workspace lifecycle and delegated roles.
- Define canonical API error taxonomy, field-level permissions, data quality and idempotency retention.
- Establish CI migration rollback and verified backup/restore drills on a disposable environment.
- Plan secret management, TLS, least-privilege DB role grants, logging privacy, incident handling and consent for integrations.

B0 is **engineering foundation**, not product readiness. Gate for starting B1: backend CI green, integration test with a non-superuser app role green, and migration artifact review. Real financial transactions must remain disabled until B1/B2 certification.
