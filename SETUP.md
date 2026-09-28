# ClientOS — Setup Guide

## 1. Prerequisites

- **Node.js 20+** (developed on 22)
- **Docker** (for PostgreSQL) — or any PostgreSQL 14+ instance
- A **Hindsight Cloud** API key — Organization → API Keys, begins `hsk_`
- A **Groq** API key — <https://console.groq.com>

## 2. Install

```bash
git clone <repository-url>
cd clientOS
npm install
```

This is an npm workspace: the root install covers both `backend/` and `frontend/`.

## 3. Database

```bash
npm run db:up        # starts postgres:16 on localhost:5432
```

Using your own PostgreSQL instead? Set `DATABASE_URL` in `backend/.env`. A URL containing
`sslmode=require` automatically enables TLS, which managed providers need.

## 4. Environment

```bash
cp .env.example backend/.env
```

Then edit `backend/.env`:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Defaults to the Docker container |
| `HINDSIGHT_API_KEY` | yes | `hsk_…` from Hindsight Cloud |
| `HINDSIGHT_BASE_URL` | yes | `https://api.hindsight.vectorize.io` |
| `HINDSIGHT_TENANT_ID` | no | Defaults to `default` |
| `GROQ_API_KEY` | yes | `gsk_…` |
| `GROQ_MODEL` | no | Defaults to `openai/gpt-oss-120b` |
| `PORT` | no | Defaults to `5000` |
| `CORS_ORIGIN` | no | Defaults to `http://localhost:5173` |
| `DEMO_RESET_TOKEN` | no | Guards the destructive demo reset endpoint |
| `LOG_LEVEL` | no | `debug` · `info` · `warn` · `error` |

Frontend needs nothing in development (Vite proxies `/api` to the backend). For a deployed
frontend set `VITE_API_BASE_URL` to the backend's public URL. **No secret is ever exposed to
the browser** — the only frontend variable is that base URL.

`backend/.env` is gitignored. Never commit it.

### Choosing a model

`GROQ_MODEL` must be a chat model your Groq account can actually access. Check with:

```bash
curl -s https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY" | grep '"id"'
```

ClientOS needs reliable JSON output. `openai/gpt-oss-120b` is the verified default. If the
configured model is unavailable, the API returns `LLM_UNAVAILABLE` naming the model, rather
than a generic outage error.

## 5. Migrate

```bash
npm run db:migrate
```

Forward-only migrations in `backend/src/db/migrations/`, tracked in `schema_migrations`.
Creates 11 tables, 34 indexes and 23 foreign keys.

If you are upgrading an existing database, `006_project_description.sql` adds an optional
`projects.description` column. It is additive and nullable, so existing rows and the seed path
are unaffected.

## 6. Verify the memory loop — do this before anything else

```bash
npm run verify:memory
```

Makes **live** Hindsight and Groq calls and checks:

1. credentials are configured · 2. Hindsight is reachable · 3. a bank can be created
4. memories retain · 5. their real ids resolve · 6. recall returns them
7. project tag scoping isolates · 8. a memory-aware recommendation is produced
9. every citation traces to a recalled memory · 10. the no-memory path stays generic
11. memory changes the answer · 12. invalidation removes a memory from recall

It writes to a throwaway bank (`verify-<timestamp>`) and deletes it afterwards. It never
simulates either service — if credentials are missing it fails and says so.

## 6a. Or start from scratch

Seeding is only for the worked demo. To use ClientOS on your own data, start the app and use
**+ Add client** — ClientOS provisions that client's memory as part of creating it. Then add a
project and start recording feedback. No seed step is required.

## 7. Seed the demo

```bash
npm run db:seed                    # Vive Studio with 7 historical interactions
npm run db:seed -- empty           # no history (demo Scene 1)
npm run db:seed -- post_conflict    # history + the resolved preference change
```

Seeding **requires Hindsight**: it writes through the same retain path the app uses, so seeded
memory is real memory. It deletes and recreates the client's bank first, so the demo can be run
repeatedly without accumulating duplicates.

## 8. Run

```bash
npm run dev
```

- Frontend <http://localhost:5173>
- Backend  <http://localhost:5000>
- Health   <http://localhost:5000/api/health/hindsight>

## 9. Test

```bash
npm test              # 98 backend + 213 frontend
npm run typecheck     # strict TypeScript, both workspaces
```

Backend tests run against real PostgreSQL (start it first). They do **not** require Hindsight
or Groq credentials — they assert invariants that hold whether or not memory is reachable.

## 10. Verification checklist

- [ ] `npm run db:migrate` completes
- [ ] `npm run verify:memory` reports **CORE MEMORY LOOP VERIFIED**
- [ ] `npm run db:seed` reports interactions and memories
- [ ] Header badge reads **Memory connected**
- [ ] AI Workspace with memory off → generic answer, no evidence
- [ ] Same question with memory on → personalised answer with citations
- [ ] "Why?" shows real interaction labels and Hindsight ids
- [ ] Submitting a contradicting preference raises the conflict UI
- [ ] Confirming a scope changes the next recommendation
- [ ] Memory Timeline shows the superseded preference, struck through
- [ ] `git status` shows no `.env`

## 11. Deployment

**Frontend → Vercel.** `vercel.json` is in the repo. Set `VITE_API_BASE_URL` to the backend URL.

**Backend + database → Render.** `render.yaml` is a blueprint. Set `HINDSIGHT_API_KEY`,
`GROQ_API_KEY`, `DEMO_RESET_TOKEN` and `CORS_ORIGIN` in the dashboard (they are marked
`sync: false` so they are never committed). Migrations run on start.

**Memory → Hindsight Cloud.** A bank-scoped key is preferable to an org-wide one.

After deploying, set `CORS_ORIGIN` to the exact frontend origin and re-run the checklist above
against the live URLs.

## 12. Troubleshooting

| Symptom | Cause |
|---|---|
| `MEMORY_UNAVAILABLE` on every request | `HINDSIGHT_API_KEY` missing or rejected. Badge shows the reason. |
| `LLM_UNAVAILABLE: model … not available` | `GROQ_MODEL` is not on your account — see §4. |
| Badge says "Backend unreachable" | Backend not running, or `CORS_ORIGIN` does not match. |
| `db:seed` refuses to run | Hindsight not configured. There is no local memory fallback by design. |
| Migration fails on start | PostgreSQL not up — `npm run db:up`. |
