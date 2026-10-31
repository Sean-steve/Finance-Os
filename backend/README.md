# Finance OS Backend — Phase B0

Runnable **foundation only**: Node.js 22+ (Fastify), PostgreSQL 16, forward-only SQL migrations, OpenAPI 3.1 contract, fail-closed readiness, schema/contract tests and PostgreSQL integration tests.

**No real authentication, financial API mutations, bank/M-Pesa integrations, or user data services are active.** The existing GitHub Pages frontend is separate and remains a mock-data demonstration.

## Quick start

\`\`\`bash
cd backend
export FINANCE_OS_DB_PASSWORD='set-a-strong-local-secret'
docker compose up -d
cp .env.example .env
# Change DATABASE_URL's password in the uncommitted .env to the same value
set -a; . ./.env; set +a
npm install
npm run db:migrate
npm run db:check
B0_INTEGRATION_TEST=1 npm test
npm start
\`\`\`

The API runs on \`http://127.0.0.1:3001\` by default. \`/health/live\` responds without the database; \`/health/ready\` returns HTTP 503 if the database cannot be reached. \`/v1\` reports contract-only status. All reserved financial endpoints return HTTP 404 until B1 implements and authenticates them.

CI in \`.github/workflows/backend-b0.yml\` provisions a throwaway PostgreSQL service for migrations, tests and contract checks. Migration files are SHA-256 locked in \`schema_migrations\`. Changing a previously applied SQL file is prohibited.

- [Architecture and domain boundaries](../docs/BACKEND_B0_ARCHITECTURE.md)
- [Architectural decision](../docs/ADR_B0_001.md)
- [OpenAPI 3.1 contract](contracts/openapi.json)
- [Migration schemas](db/migrations/)
