# ClientOS — Implementation Plan

Read after `CURRENT_PROJECT_AUDIT.md`, `HINDSIGHT_INTEGRATION_MAP.md`, `DATA_MODEL.md`, `API_INTEGRATION_PLAN.md`, `AGENT_IMPLEMENTATION.md`.

---

## 0. Premise Correction

The brief for this phase asked for a plan to integrate ClientOS into an **existing application** with minimum necessary changes. **That application does not exist.** The repository contains 10 Markdown files and zero lines of code (`CURRENT_PROJECT_AUDIT.md` §0).

So the instructions "reuse existing code," "do not create duplicate APIs," "do not create duplicate LLM integrations," and "do not rebuild functionality that already exists" have no existing code to bind to. They are honoured in spirit instead: exactly one LLM client module, exactly one Hindsight client module, one confirmation path for preference changes (the two overlapping paths sketched in `docs/API.md` are merged), and no endpoint that the MVP scope and Definition of Done do not require.

The critical-rule from the brief still governs, restated for a greenfield build:

> **Build the smallest system that makes a judge observe all ten Definition-of-Done steps, with Hindsight as the genuine memory layer.** Not the most code.

---

## 1. Priorities

### P0 — MUST HAVE

| # | Item | Depends on |
|---|---|---|
| 1 | Repo scaffold, `.gitignore`, env validation | — |
| 2 | PostgreSQL schema + migrations | 1 |
| 3 | **Hindsight connection** (`getVersion`, health endpoint) | 1, **API key** |
| 4 | **Hindsight retain** (+ id reconciliation) | 3 |
| 5 | **Hindsight recall** (tag-scoped) | 3 |
| 6 | Client / project / interaction CRUD | 2 |
| 7 | Demo dataset + reset/stage endpoints | 2, 4 |
| 8 | Groq client + memory extraction | 1 |
| 9 | **Agent reasoning** — memory-aware recommendation | 5, 8 |
| 10 | **Why / evidence** (deterministic) | 9 |
| 11 | **Preference conflict** detection + resolution | 4, 5, 8 |
| 12 | Frontend: Dashboard, Client Workspace, AI Workspace, **Memory Timeline** | 6, 9, 10, 11 |
| 13 | End-to-end flow passing all 10 DoD steps | all |
| 14 | Deployment (Vercel + Render + Hindsight Cloud) | 13 |
| 15 | README + Hindsight explanation + demo video | 13 |

### P1 — IMPORTANT
UI polish; `reflect`-backed "Client Standing Brief"; mental model with `refreshAfterConsolidation`; retain-retry UI; timeline filters and `?verify=true`; better error copy; fix the doc contradictions in `CURRENT_PROJECT_AUDIT.md` §8.2–8.3; add the `MASTER_SPEC` pointer notes; rewrite `HACKATHON_MASTER_SPEC.md` as an actual spec; smoke tests over the agent pipeline.

### P2 — OPTIONAL
Email / calendar / CRM integrations; advanced analytics; multi-tenant SaaS; auth; knowledge pages; bank transfer/clone; entity graph visualisation. All explicitly out of scope per `MASTER_SPEC` §24.

---

## 2. Build Order

Sequenced so that **the riskiest unknown — Hindsight — is proven first**, and so nothing downstream is built on an unverified assumption. The 8-hour budget in `MASTER_SPEC` §21 is preserved but re-ordered: the spec's Hour 1–3 puts database work before Hindsight, which would mean discovering a Hindsight problem three hours in.

### Phase 0 — Unblock (before the clock starts)

1. **Obtain a Hindsight Cloud API key** (`hsk_…`) — *hard blocker for all of P0*.
2. Obtain a Groq API key.
3. Provision PostgreSQL (local Docker or a hosted instance).
4. **Decide the two open product questions** — the §6 approval list below.

### Phase 1 — Foundation *(~1h)*

Files: `package.json` (npm workspaces) · `.gitignore` · `backend/{package.json,tsconfig.json,.env.example}` · `backend/src/index.ts` · `backend/src/config/env.ts` · `backend/src/middleware/{errorHandler,validate,asyncHandler,demoToken}.ts` · `backend/src/db/{pool.ts,migrate.ts,migrations/001..005.sql}` · `frontend/{package.json,tsconfig.json,vite.config.ts,tailwind.config.js,index.html}` · `frontend/src/{main.tsx,App.tsx}`

**`.gitignore` first** — it does not exist, and three API keys are about to. Gate: `npm run dev` serves both; `GET /api/health` returns ok; migrations apply.

### Phase 2 — Hindsight integration *(~1.5h)* — **highest risk, done early**

Files: `backend/src/hindsight/{client,tags,banks,retain,recall,curate,directives}.ts` · `backend/src/routes/health.routes.ts`

1. `getVersion()` against the live Cloud instance → `GET /api/health/hindsight`.
2. `createBank('client-vive-studio')` with the missions from `HINDSIGHT_INTEGRATION_MAP.md` §3.1.
3. `retain` one memory with the full tag set; `listMemories({documentId})` to reconcile the id.
4. `recall` with `tagGroups` — **verify tag scoping actually isolates as expected.**
5. `updateMemory` → `state:'invalidated'`; confirm it disappears from recall.

Gate: all five verified against the live instance. **Nothing downstream is built until this passes** — every P0 item except the scaffold depends on it, and the SDK's real behaviour (verified from typings, but not yet from a live call) is the project's largest unknown.

### Phase 3 — Data + demo dataset *(~1h)*

Files: `backend/src/services/{clients,projects,interactions,memory,demo}.service.ts` · `backend/src/routes/{clients,projects,demo}.routes.ts` · `backend/src/db/seed.ts`

Seed Vive Studio + Premium Website Redesign + 8 interactions with **verbatim labels** (`DATA_MODEL.md` §4). `POST /api/demo/reset` and `/api/demo/stage` working across all three stages.

Gate: `reset { history }` seeds 7 interactions, retains them, and `GET /api/projects/:id/memory` shows the memories with correct `source:` labels.

### Phase 4 — Agent *(~1.5h)*

Files: `backend/src/llm/{groq,schemas}.ts` · `backend/src/llm/prompts/{extract,conflict,recommend}.prompt.ts` · `backend/src/agent/{extract,classify,recommend,evidence}.ts` · `backend/src/routes/agent.routes.ts` · `backend/src/routes/interactions.routes.ts`

Gate: `POST /api/agent/recommend` with `useMemory:false` gives a generic answer; with `useMemory:true` gives a memory-aware one citing real memory ids. **This is DoD steps 3–6.**

### Phase 5 — Frontend *(~1.5h)*

Files: `frontend/src/api/client.ts` · `frontend/src/hooks/*` · `frontend/src/components/{AppShell,MemoryStatusBadge,MemoryCard,EvidenceList,LoadingState,EmptyState,ErrorState,TypeBadge,ScopeBadge,ClientCard,ProjectSelector,MemoryPanel,InteractionList,AddInteractionForm,RequestBox,RecommendationCard,AvoidCard,WhyDrawer,TimelineItem,SupersessionLink,MemoryFilters}.tsx` · `frontend/src/pages/{Dashboard,ClientWorkspace,AIWorkspace,MemoryTimeline}.tsx`

Gate: all four screens render with loading/empty/error states; **Use memory** toggle visibly changes the answer; Why drawer shows real evidence.

### Phase 6 — Conflict handling *(~1h)*

Files: `backend/src/agent/{conflict,resolve}.ts` · `backend/src/services/conflicts.service.ts` · `backend/src/routes/conflicts.routes.ts` · `frontend/src/components/ConflictModal.tsx`

**Apply the §6 seed-data fix first** — otherwise there is nothing for detection to find.

Gate: submitting Revision #6 raises a conflict, retains nothing, resolving at project scope writes the new memory + a tag-scoped directive, leaves the old memory valid but marked superseded, and the next identical request returns a changed recommendation. **DoD steps 7–10.**

### Phase 7 — Deployment + submission *(~1.5h)*

Files: `vercel.json` · `render.yaml` · `README.md` (rewrite) · `SETUP.md` (update)

Frontend → Vercel (`VITE_API_BASE_URL`); backend → Render (all backend env vars set in the dashboard, never committed); PostgreSQL hosted; Hindsight Cloud already live.

Gate: full DoD walkthrough on the deployed URLs, then record the demo video against `DEMO_SCRIPT.md`.

**Total ~9h against an 8h event** — Phase 5 polish and all of P1 are the compression buffer. Phases 1–4 and 6 are not compressible without losing a DoD step.

---

## 3. Files

### To create — backend (38)

```
package.json · .gitignore
backend/package.json · backend/tsconfig.json · backend/.env.example
backend/src/index.ts
backend/src/config/env.ts
backend/src/db/pool.ts · migrate.ts · seed.ts
backend/src/db/migrations/001_init.sql · 002_memory.sql · 003_agent.sql · 004_demo.sql · 005_indexes.sql
backend/src/hindsight/client.ts · tags.ts · banks.ts · retain.ts · recall.ts · reflect.ts · curate.ts · directives.ts
backend/src/llm/groq.ts · schemas.ts
backend/src/llm/prompts/extract.prompt.ts · conflict.prompt.ts · recommend.prompt.ts
backend/src/agent/extract.ts · conflict.ts · classify.ts · recommend.ts · evidence.ts · resolve.ts
backend/src/services/clients.service.ts · projects.service.ts · interactions.service.ts · memory.service.ts · conflicts.service.ts · demo.service.ts
backend/src/routes/health.routes.ts · clients.routes.ts · projects.routes.ts · interactions.routes.ts · agent.routes.ts · conflicts.routes.ts · demo.routes.ts
backend/src/middleware/errorHandler.ts · validate.ts · asyncHandler.ts · demoToken.ts
```

### To create — frontend (28)

```
frontend/package.json · tsconfig.json · vite.config.ts · tailwind.config.js · postcss.config.js · index.html · .env.example
frontend/src/main.tsx · App.tsx · index.css
frontend/src/api/client.ts
frontend/src/hooks/useClients.ts · useProject.ts · useMemory.ts · useRecommend.ts · useConflicts.ts · useHindsightHealth.ts
frontend/src/components/AppShell.tsx · MemoryStatusBadge.tsx · MemoryCard.tsx · EvidenceList.tsx
  LoadingState.tsx · EmptyState.tsx · ErrorState.tsx · TypeBadge.tsx · ScopeBadge.tsx
  ClientCard.tsx · ProjectSelector.tsx · MemoryPanel.tsx · InteractionList.tsx · AddInteractionForm.tsx
  RequestBox.tsx · RecommendationCard.tsx · AvoidCard.tsx · WhyDrawer.tsx · ConflictModal.tsx
  TimelineItem.tsx · SupersessionLink.tsx · MemoryFilters.tsx
frontend/src/pages/Dashboard.tsx · ClientWorkspace.tsx · AIWorkspace.tsx · MemoryTimeline.tsx
```

### To create — deployment / docs (4)

`vercel.json` · `render.yaml` · `CURRENT_PROJECT_AUDIT.md`, `HINDSIGHT_INTEGRATION_MAP.md`, `API_INTEGRATION_PLAN.md`, `DATA_MODEL.md`, `AGENT_IMPLEMENTATION.md`, `IMPLEMENTATION_PLAN.md` *(this phase — already created)*

### To modify (6, all P1 documentation)

| File | Change | Reason |
|---|---|---|
| `README.md` | fix "Revision #2" → **#3** for heavy animation; replace "exact technologies can be selected" with the locked stack; add real setup/run instructions | wrong evidence citation; contradicts `MASTER_SPEC` §12 |
| `HINDSIGHT_MEMORY.md` | fix "Revision #2" → **#3** (twice, §9) | wrong evidence citation |
| `docs/DEMO_DATA.md` | add the palette clause to Design Review #1 *(pending approval)* | conflict has no source memory |
| `ARCHITECTURE.md` | PostgreSQL "optional" → required | contradicts `MASTER_SPEC` §12/§13 |
| `SETUP.md` | `LLM_API_KEY`/`LLM_MODEL` → `GROQ_API_KEY`/`GROQ_MODEL`; real commands | provider is locked to Groq |
| all 9 existing docs | add the `HACKATHON_MASTER_SPEC.md` pointer note | required by `MASTER_SPEC` and never done |

### To remove (1, requires approval)

`/home/laksh/Documents/Hackathon/ClientOS` — a byte-identical duplicate repository with its own `.git` (`CURRENT_PROJECT_AUDIT.md` §0.1). Two repos holding the same docs will cause lost work. **Not deleted; needs an explicit decision.** No file inside the working repository should be removed.

---

## 4. Dependencies

Only what the plan actually calls.

**Backend runtime:** `express` · `cors` · `dotenv` · `zod` · `pg` · `@vectorize-io/hindsight-client` (0.10.1) · `groq-sdk`
**Backend dev:** `typescript` · `tsx` · `@types/node` · `@types/express` · `@types/cors` · `@types/pg`
**Frontend runtime:** `react` · `react-dom` · `react-router-dom` · `@tanstack/react-query`
**Frontend dev:** `vite` · `@vitejs/plugin-react` · `typescript` · `tailwindcss` · `postcss` · `autoprefixer` · `@types/react` · `@types/react-dom`

No ORM (nine small tables), no auth library (no auth in MVP), no logger (`console` + the error middleware suffices), no test framework on the P0 path (P1 smoke tests can use `node:test`), no state-management library (react-query covers it), no UI component library (Tailwind only — a component kit is a learning-curve risk inside 8 hours).

`@tanstack/react-query` is the one non-obvious inclusion: the brief requires loading/empty/error states on every screen, and hand-rolling those across 16 endpoints costs more than the dependency.

---

## 5. Environment Variables

**Names only. No value appears in any document, and `.gitignore` must exist before the first commit** — it does not today.

**Backend:** `NODE_ENV` · `PORT` · `CORS_ORIGIN` · `DATABASE_URL` · `HINDSIGHT_BASE_URL` · `HINDSIGHT_API_KEY` · `HINDSIGHT_TENANT_ID` *(optional)* · `GROQ_API_KEY` · `GROQ_MODEL` · `DEMO_RESET_TOKEN`

**Frontend:** `VITE_API_BASE_URL` *(only variable — no key is ever exposed to the browser)*

`config/env.ts` validates all backend variables with zod at boot and fails fast, so a missing key surfaces at startup rather than as a 401 during the demo.

---

## 6. Decisions Needed Before Implementation

Two require your approval; four have recommendations I will apply unless told otherwise.

### Requires approval

1. **The demo conflict has no source memory.** *"Avoid bright colors"* is never established by interactions 1–7, so Revision #6 will trigger no conflict and DoD steps 8–10 cannot run (`CURRENT_PROJECT_AUDIT.md` §8.1). **Recommended:** add one clause to Design Review #1 — *"Keep the colour palette restrained and muted — avoid bright, saturated colour."* This edits specified demo data, so it needs your call.
2. **The duplicate repository** at `/home/laksh/Documents/Hackathon/ClientOS` — delete, archive, or leave? Deleting a git repository is irreversible.

### Recommendations I will apply unless you object

3. **No auth in the MVP** — single seeded demo user; `DEMO_RESET_TOKEN` guards only the destructive reset. (`ARCHITECTURE.md` left this "if required".)
4. **`GROQ_MODEL=llama-3.3-70b-versatile`** — best instruction-following among Groq's production models for the "never invent client history" constraint; one env var to change.
5. **One bank per client, project scoping via tags** (`HINDSIGHT_INTEGRATION_MAP.md` §3.1) — the only option that supports the client and future-project scopes the spec requires.
6. **Recall + Groq for recommendations; `reflect` for the P1 standing brief** (`HINDSIGHT_INTEGRATION_MAP.md` §5) — keeps Groq in the locked stack and gives exact per-bullet citations.

---

## 7. Final Report

### Current Project Status

**Nothing works, because nothing is built.** The repository is 10 Markdown files, 2150 lines, zero code, one commit. No frontend, backend, database, Hindsight integration, LLM integration, dependency manifest, build config, or environment file.

What *is* in good shape is the product thinking: a sharp thesis (memory must change behaviour, not just be displayed), a complete 8-interaction demo dataset with expected memories and worked "Why?" answers, a timed demo script, eight reasoned product decisions, and a clear 10-step Definition of Done. That is a genuinely useful starting position — it is a specification problem solved, with the implementation entirely outstanding.

One caveat on the source of truth: `HACKATHON_MASTER_SPEC.md` is an **unexecuted prompt**, not a spec — 848 lines instructing an AI to *produce* the file it was committed as. Its embedded content (locked stack, MVP scope, demo dataset, priorities, DoD) is treated as authoritative project direction; its claims *about the hackathon* are unverified (see Unknowns).

### Hindsight Status

**NOT CONNECTED.** No API key, no SDK dependency, no client module, no call site — zero Hindsight code in the repository. This is the item carrying 25% of the stated judging weight.

The integration is, however, now fully mapped against the real API — verified from the Cloud docs, the developer docs, **and the published SDK's own 11,878-line type declarations**, which corrected the prose docs in two material places: `tags` is a first-class retain/recall field (the Cloud retain page omits it), and `reflect` supports tag scoping, directive control and `includeFacts` (the Cloud reflect page omits all three). Two documented traps avoided: `getBankProfile` is removed server-side and answers **HTTP 410** (use `getBankConfig`), and several `createBank` options are deprecated — yet both still appear in the official TypeScript SDK guide.

### Existing APIs

**0.** Eight endpoints sketched in prose in `docs/API.md`; none implemented. Sketch dispositions in `API_INTEGRATION_PLAN.md` §A — six kept, one moved to a project-scoped route, one merged away as a duplicate confirmation path.

### Required APIs

**16 — 13 P0, 1 P1, 2 demo-support.** Full specifications in `API_INTEGRATION_PLAN.md` §B.

`GET /api/health` · `GET /api/health/hindsight` · `GET /api/clients` · `GET /api/clients/:clientId` · `GET /api/projects/:projectId` · `GET /api/projects/:projectId/interactions` · **`POST /api/projects/:projectId/interactions`** · `POST /api/interactions/:id/retry-retain` · **`GET /api/projects/:projectId/memory`** · `GET /api/clients/:clientId/memory` · **`POST /api/agent/recommend`** · `GET /api/agent/recommendations/:id` · `POST /api/agent/recommendations/:id/feedback` · **`GET /api/projects/:projectId/conflicts`** · **`POST /api/conflicts/:conflictId/resolve`** · **`POST /api/demo/reset` + `/api/demo/stage`**

### Existing Data

**None executable.** No schema, migration, seed script, or connection string. A demo dataset exists **as prose** in `docs/DEMO_DATA.md` — 8 interactions with expected memories — but nothing loads it.

### Required Data

**11 PostgreSQL tables** (`DATA_MODEL.md`): `users` · `clients` · `projects` · `interactions` · `memory_refs` · `memory_links` · `preference_conflicts` · `recommendations` · `recommendation_feedback` · `hindsight_directives` · `demo_state`, plus `schema_migrations`.

**In Hindsight:** one bank `client-vive-studio`; ~12–20 tagged memories from the 8 interactions; 1 tag-scoped directive after conflict resolution; 1 mental model (P1).

PostgreSQL holds structured metadata and a display cache; Hindsight holds memory. No recommendation reads memory content from PostgreSQL — the boundary is enforced in the agent's code path, not by convention (`DATA_MODEL.md` §1.1).

### Files To Modify

6, all P1 documentation: `README.md` · `HINDSIGHT_MEMORY.md` · `docs/DEMO_DATA.md` *(pending approval)* · `ARCHITECTURE.md` · `SETUP.md` · plus pointer notes in all 9 existing docs. Table in §3.

### Files To Create

**70:** 38 backend, 28 frontend, 4 deployment/docs. Full list in §3.

### Files To Remove

**None inside the repository.** One directory outside it — the duplicate `/home/laksh/Documents/Hackathon/ClientOS` — requires your decision (§6.2).

### Dependencies To Add

7 backend runtime, 6 backend dev, 4 frontend runtime, 8 frontend dev. Full list in §4. Deliberately omitted: ORM, auth library, logger, test framework on the P0 path, state-management library, UI kit.

### Environment Variables

**Backend:** `NODE_ENV` · `PORT` · `CORS_ORIGIN` · `DATABASE_URL` · `HINDSIGHT_BASE_URL` · `HINDSIGHT_API_KEY` · `HINDSIGHT_TENANT_ID` *(optional)* · `GROQ_API_KEY` · `GROQ_MODEL` · `DEMO_RESET_TOKEN`
**Frontend:** `VITE_API_BASE_URL`

Names only. No secret appears in the repository or its git history today — but no `.gitignore` exists either, so creating one is Phase 1 step 1.

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **No Hindsight API key yet** | **critical** | Phase 0 step 1 — blocks every P0 item |
| **Demo conflict has no source memory** — DoD steps 8–10 unreachable | **critical** | §6.1; one-clause seed fix, needs approval |
| **Nothing is built with ~8h of event time** | **high** | Phases 1–4 + 6 are the incompressible core; Phase 5 polish and all P1 are the buffer |
| Recall may not surface the right memories from only 8 seeded items | high | Phase 2 gate tests recall before anything depends on it; tune `budget`, `minScores`, `retainExtractionMode` |
| Hindsight extracts a different number of facts than predicted | medium | id reconciliation via `listMemories({documentId})`; nullable `hindsight_memory_id`; unmatched local rows excluded from the UI (`DATA_MODEL.md` §5) |
| **Writes are never auto-retried by the SDK** | medium | `retain_status='failed'` + a user-visible retry endpoint — never a silent loss |
| LLM returns invalid JSON | medium | zod validation + one repair retry, then `503` |
| LLM invents client history | medium | prompt constraint + evidence-id validation + verbatim-quote gate; uncited preference claims are dropped |
| Groq structured-output support unconfirmed per model | low | JSON-object mode + zod, not strict schema enforcement; model id in one env var |
| Hindsight Cloud credits exhausted by repeated reseeding | medium | seed with `async:false`; create mental models only after seeding; refreshes are ~$0.05 each |
| Observation consolidation too slow to show live | medium | fall back to `world`/`experience` facts |
| Duplicate repo causes lost work | medium | §6.2 |
| Deploying three services under time pressure | medium | Phase 7 has its own 1.5h; deploy a hello-world early if possible |

### Unknowns

| # | Unknown | Why it matters |
|---|---|---|
| 1 | **Official hackathon judging weights.** The 30/25/20/15/10 split is asserted inside `HACKATHON_MASTER_SPEC.md` — which is our own prompt, not a quoted official source. I confirmed the event exists (Devnovate × Hack With India, 8 hours, teams of 2–6, prizes to ~$2,000) but **could not retrieve the official criteria** — the event page returned no readable body. | Priorities assume Hindsight usage is weighted heavily. Verify against the official brief. |
| 2 | Official submission requirements and official resource URLs | `MASTER_SPEC` §25 lists them without citation |
| 3 | Whether the Hindsight account uses a non-`default` tenant | one env var |
| 4 | Exact HTTP paths for directive endpoints | SDK methods confirmed; ClientOS calls those, so low impact |
| 5 | Real recall quality and latency against a live bank | needs the Phase 2 gate; may require tuning |
| 6 | Whether Groq's chosen model reliably honours the no-fabrication constraint | needs one live test in Phase 4 |
| 7 | Hindsight Cloud credit allowance for this account | affects how often the demo can be reseeded |
| 8 | Whether consolidated `observation` facts appear fast enough to show live | affects which fact types the timeline features |

Items 1 and 2 are the ones worth resolving from the official material rather than from our own documents, since `MASTER_SPEC` explicitly forbids presenting our assumptions as official rules — and, as written, it does exactly that.

### Recommended Implementation Order

```
Phase 0  Unblock          API keys (Hindsight + Groq), PostgreSQL, approve §6.1 and §6.2
Phase 1  Foundation       .gitignore, workspaces, env validation, DB migrations, health
Phase 2  Hindsight  ★     client, banks, tags, retain, recall, curate — GATE before anything else
Phase 3  Data + demo      services, CRUD routes, seed, demo reset/stage
Phase 4  Agent            Groq client, prompts, extract, classify, recommend, evidence
Phase 5  Frontend         shared components, 4 screens, memory badge, Why drawer
Phase 6  Conflict         detection, 3 resolution branches, conflict modal  (apply §6.1 fix first)
Phase 7  Deploy           Vercel + Render + Postgres, README, demo video
```

The one deliberate departure from `MASTER_SPEC` §21: **Hindsight moves ahead of the database.** The spec puts database and models in Hours 1–2 and Hindsight in Hour 3. Given that Hindsight is the entire premise of the project, is the sole unverified external dependency, and has no key yet, discovering a problem with it three hours in would be unrecoverable. Proving it in Phase 2 costs nothing and de-risks everything after.

---

## 8. Definition of Done — Traceability

| # | DoD step (`MASTER_SPEC` §27) | Delivered by | Phase |
|---|---|---|---|
| 1 | Client has historical decisions | seed + `POST /api/demo/stage` | 3 |
| 2 | Hindsight stores those decisions | `retainBatch` + id reconciliation | 2, 3 |
| 3 | User asks for a new task | `POST /api/agent/recommend` | 4 |
| 4 | ClientOS recalls relevant history | `recall` with `tagGroups` | 2, 4 |
| 5 | Recommendation changes because of history | `useMemory` toggle, one screen | 4, 5 |
| 6 | ClientOS explains why | deterministic `agent/evidence.ts` | 4, 5 |
| 7 | Client changes a preference | Revision #6 submitted live | 6 |
| 8 | ClientOS detects the conflict | `agent/conflict.ts` — **needs §6.1** | 6 |
| 9 | User confirms scope | conflict modal → resolve | 6 |
| 10 | Future recommendation changes again | new memory + tag-scoped directive | 6 |

**No code has been written. Awaiting approval.**
