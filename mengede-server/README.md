Drizzle + Postgres setup

This folder contains Drizzle configuration and an initial SQL migration.

- To generate migrations locally (without running them), set `DATABASE_URL_DIRECT` to a direct DB URL and run:
  - `npm run db:generate`
- To apply migrations (only after you provide a DATABASE_URL):
  - `npm run db:migrate`

IMPORTANT: Do not run migrations until you confirm your `DATABASE_URL`.
