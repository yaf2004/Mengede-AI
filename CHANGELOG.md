# CHANGELOG

## Unreleased

- scaffold: Drizzle configuration and initial SQL migration (student_profile, conversations, messages, quiz_results, study_plans, plan_tasks, ai_usage)
- feat: added Gemini Interactions client (`lib/gemini.js`) with retry ladder and simulated local responses
- feat: test endpoint at `/api/test/gemini` and `test_gemini.js` script for local verification
- chore: `lib/db.js` DB helper and `drizzle.config.ts` + `drizzle/schema.ts`
- docs: `.env.example` with `DATABASE_URL`/`GEMINI_API_KEY`, `docker-compose.yml` for local Postgres, and README note about migrations

