# ClientOS — Technical Architecture

> Describes the system as built. See `HINDSIGHT_MEMORY.md` for the memory design and
> `docs/API.md` for the endpoint contract.

## 1. Shape

```
┌───────────────────────────────────────────────────────────┐
│  React 18 + TypeScript + Vite + Tailwind                  │
│  Dashboard · Client Workspace · AI Workspace · Timeline    │
│  Holds NO credentials. Talks only to /api.                │
└───────────────────────┬───────────────────────────────────┘
                        │ JSON  { success, data } | { success, error }
┌───────────────────────▼───────────────────────────────────┐
│  Express + TypeScript (strict)                            │
│    routes → controllers → services → repositories         │
│                    │                                       │
│    agents/   extract · conflict · classify · recommend ·   │
│              evidence · (resolve lives in services)       │
│    hindsight/ retain · recall · reflect · curate ·         │
│               directives · banks · tags                   │
│    llm/      ONE Groq client, schema-validated output      │
└──────┬─────────────────────────────┬──────────────────────┘
       │                             │
┌──────▼──────────┐          ┌───────▼─────────────────────┐
│  PostgreSQL     │          │  Hindsight Cloud            │
│  metadata only  │          │  THE memory system          │
│  11 tables      │          │  one bank per client        │
└─────────────────┘          └─────────────────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │  Groq (reasoning)   │
                              └─────────────────────┘
```

## 2. Layering

No business logic lives in route files. Routes bind paths to controllers; controllers validate
and shape HTTP; services own orchestration; repositories own SQL; the `hindsight/` and `llm/`
modules own every external call. There is exactly one Hindsight client and exactly one Groq
client in the process.

```
backend/src/
├── config/env.ts        zod-validated environment, fails fast, never logs values
├── controllers/         HTTP shape only
├── routes/index.ts      path → controller
├── services/            memory · interactions · conflicts · agent · demo
├── repositories/        clients · projects · interactions · memory · conflicts ·
│                        recommendations · directives · users
├── agents/              extract · conflict · classify · recommend · evidence
├── hindsight/           client · banks · tags · retain · recall · reflect · curate · directives
├── llm/                 groq.ts · schemas.ts · prompts/
├── middleware/          requestContext · validate · asyncHandler · demoToken · errorHandler
├── db/                  pool · migrate · seed · migrations/
└── utils/               errors · logger · slug · respond
```

## 3. What each store holds

| PostgreSQL | Hindsight |
|---|---|
| users, clients, projects | the memories themselves |
| interactions (raw text + retain status) | preferences, approvals, rejections, constraints, decisions, outcomes |
| `memory_refs` — **pointers + display cache** | consolidated observations |
| `memory_links` — supersession graph | tag-scoped directives |
| `preference_conflicts` — pending decisions | |
| `recommendations` — audit + evidence snapshot | |

**The rule:** no recommendation reads memory content from PostgreSQL. The agent's only source
of client history is a live Hindsight recall. `memory_refs` exists because Hindsight has no
supersession relation and no server-side metadata filtering, and because the timeline must
render instantly without a network round trip. Every row carries `hindsight_memory_id`;
Hindsight is authoritative on any disagreement.

### 3.1 PostgreSQL tables

Eleven tables plus `schema_migrations`. Defined in `backend/src/db/migrations/` — those files
are the source of truth; this is a map, not a duplicate of the DDL.

| Table | Holds | Notable constraints |
|---|---|---|
| `users` | the seeded demo user | unique email |
| `clients` | client identity and its `hindsight_bank_id` | unique slug, unique bank id — the cross-system join |
| `projects` | projects per client | unique `(client_id, slug)` |
| `interactions` | raw client feedback, `occurred_at`, `retain_status` | unique `(project_id, label)` — blocks duplicate submission |
| `memory_refs` | pointer + display cache for one memory | unique `hindsight_memory_id` where present; nullable until reconciled |
| `memory_links` | supersession graph (`supersedes` / `refines` / `contradicts`) | no self-links; unique per (from, to, relation) |
| `preference_conflicts` | a detected change awaiting scope confirmation | resolution claimed atomically |
| `recommendations` | agent output + point-in-time evidence snapshot | `memory_used`, `hindsight_ok` honesty flags |
| `recommendation_feedback` | accepted / rejected / corrected outcomes | cascades with its recommendation |
| `hindsight_directives` | local record of tag-scoped directives | scope is `project` or `client` |
| `demo_state` | which demo stage is loaded | single-row guard (`id = true`) |

Two columns carry design weight:

- **`memory_refs.hindsight_memory_id` is nullable.** `retain` returns no memory ids — Hindsight
  extracts facts rather than storing text verbatim, so one submission may yield several facts
  or none. Ids are reconciled afterwards via `listMemories({ documentId })`.
- **`recommendations.evidence` is a jsonb snapshot, not a join.** It records what was recalled
  at that moment and must not change when memory later changes, or the audit is worthless.

Migrations are forward-only and tracked in `schema_migrations`.

### 3.2 Multi-project memory

One client, one bank, many projects:

```
ONE CLIENT
   ↓
ONE HINDSIGHT BANK
   ↓
MULTIPLE PROJECTS          (tags, not separate banks)
   ↓
PROJECT-SCOPED MEMORY  +  CLIENT-WIDE MEMORY
   ↓
ACTIVE-PROJECT RECALL      (project ∪ client ∪ future, strict)
   ↓
GROQ RECOMMENDATION
```

A client-wide memory has `memory_refs.project_id = NULL` and no `project:` tag,
so it is stored once and surfaces under every project. A project-scoped memory
carries both, so it stays where it belongs.

The project memory counts shown in the UI count **what recall will actually draw
on** — the project's own memories plus the client-wide ones — so the number in
the header matches the number of memories the agent can cite.

#### Active project vs memory scope

Two ideas that sound similar and are not:

| | **Active project** | **Memory scope** |
|---|---|---|
| Answers | Which project am I working on? | How widely does this decision apply? |
| Values | one of the client's projects | `interaction` · `revision` · `project` · `client` · `future` |
| Lives in | the URL (`?project=<slug>`) | tags on the memory |
| Chosen | by switching project | when a preference change is confirmed |
| Changes | what is recalled for the next request | what is recalled for every future request |

Worked example: with **Premium Website Redesign** as the active project, confirming
a change at scope **This project** leaves the Mobile App untouched; confirming the
same change at **All future projects** makes it apply there too. The active project
is the context of the work; the scope is the reach of the decision.

The UI keeps them apart deliberately. There is exactly **one** active-project
control per screen (`useActiveProject`, rendered by `ProjectSwitcher` in the client
workspace and `ProjectContextSelector` elsewhere), and the conflict card *shows*
its project without offering to change it — a conflict already belongs to one.

## 4. Agent flow

```
request
  → resolve client (bank id) + project (tag), assert they are related
  → hindsight.recall  with compound tag filter (project ∪ client ∪ future), any_strict
  → classify by type: tag                       [no LLM — mechanical]
  → Groq synthesis, memory as the ONLY source of client history
  → bind evidence to recalled memory ids        [no LLM — deterministic]
      · drop citations not present in the recall result
      · drop lines asserting history with no citation
  → persist recommendation + evidence snapshot
```

Steps 3 and 5 are deliberately not LLM steps. That is what makes a fabricated preference
unable to survive: it cannot cite a real memory id.

## 5. Write flow

```
feedback
  → persist interaction (recoverable if later steps fail)
  → Groq extraction → durability gate
      · confidence ≥ 0.6
      · sourceQuote must be a VERBATIM substring of the feedback
      · not a duplicate of an existing statement
  → per candidate: targeted recall (world + observation) → Groq contradiction check
      · conflict, or ambiguous scope → hold as pending, RETAIN NOTHING
      · clear → hindsight.retain, then reconcile the real memory id
  → status: retained | awaiting_confirmation | not_durable | failed
```

Hindsight is written **before** the local pointer row. If memory fails, there is no database
row implying success. If the pointer write fails afterwards, the response carries a warning
rather than reporting clean success.

## 6. Failure handling

Each dependency fails independently and is reported distinctly.

| Failure | Behaviour |
|---|---|
| Hindsight unreachable / rejected | `503 MEMORY_UNAVAILABLE`, **no recommendation returned**, badge turns red |
| Recall returns nothing | `200` with `memoryUsed: false` and an explicit note — not an error |
| Retain fails | `retain_status='failed'` + retry endpoint (the SDK never auto-retries writes) |
| Groq unreachable / bad key | `503 LLM_UNAVAILABLE` |
| Groq returns invalid JSON | Up to 3 attempts with the validation error fed back, then `503` |
| Provider rejects its own JSON (`json_validate_failed`) | Treated as a bad generation and retried, not an outage |
| Model not on the account | `503` naming the model — a config bug, not an outage |
| PostgreSQL unreachable | `503 DATABASE_UNAVAILABLE` |
| Duplicate interaction label | `409` |
| Concurrent conflict resolution | Atomic claim; exactly one write, loser gets `409` |

The governing rule: **never claim memory was used when it was not.** The health badge uses an
authenticated Hindsight call, because an unauthenticated ping reports success with an invalid
key — which would be precisely the false reassurance this rule forbids.

## 7. Security

- Credentials are backend-only. The frontend's sole variable is `VITE_API_BASE_URL`.
- `.env` is gitignored; `render.yaml` marks secrets `sync: false`.
- All SQL uses bound parameters; identifiers are pattern-validated before any lookup.
- Bodies capped at 256 kB; feedback at 5000 chars; agent messages at 1000.
- Logs redact key-named fields *and* key-shaped values at any depth, and truncate long strings.
- Errors expose no stack traces, SQL, or internals.
- React escapes all rendered text; `dangerouslySetInnerHTML` is used nowhere.
- Prompts instruct the model to treat memory and request text as data, never instructions.
- Cross-client access is blocked by resolving both ids and asserting the relationship.

## 8. Deployment

| Piece | Target | Config |
|---|---|---|
| Frontend | Vercel | `vercel.json` — SPA rewrites, security headers |
| Backend | Render | `render.yaml` — migrations on start, `/api/health` check |
| Database | Render PostgreSQL | `DATABASE_URL` injected from the blueprint |
| Memory | Hindsight Cloud | bank-scoped key preferred |
| Reasoning | Groq | `openai/gpt-oss-120b` |
