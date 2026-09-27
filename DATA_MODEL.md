# ClientOS — Data Model

**Status:** design document. **No database exists today** — no schema, migration, ORM config, connection string, or seed script (`CURRENT_PROJECT_AUDIT.md` §5).

---

## 1. The Two-System Split

ClientOS stores data in two places with a strict, non-negotiable division of responsibility.

| | **PostgreSQL** | **Hindsight** |
|---|---|---|
| Holds | structured application metadata | durable experiential memory |
| Answers | *"what clients, projects and interactions exist?"* | *"what has this client decided, and why?"* |
| Written by | CRUD routes | `retain` after extraction + confirmation |
| Read by | UI lists, navigation, timeline scaffolding | **every recommendation** |
| Source of truth for | identity, structure, workflow state | **memory content and its semantics** |
| If it is down | app cannot navigate | **app must refuse to claim memory was used** |

The rule from `ARCHITECTURE.md` §3 — *"The database should not replace Hindsight as the core memory mechanism"* — is enforced structurally:

> **No recommendation may read memory content from PostgreSQL.** The agent's memory context comes exclusively from a Hindsight `recall` call. PostgreSQL's memory-related tables hold *pointers and a display cache*, never authority.

### 1.1 Why a cache exists, and why it is not a duplicate memory system

`memory_refs` (§2.5) stores a copy of each memory's statement text alongside its `hindsight_memory_id`. This is a deliberate, bounded compromise, and it is worth being precise about why it is not the "duplicate the memory system in PostgreSQL" mistake the brief warns against:

- **It is never read during reasoning.** The agent path is `recall` → Groq. `memory_refs` is read only to render the Memory Timeline and to resolve a conflict's "old statement" for display.
- **Hindsight is always the authority.** Every row carries `hindsight_memory_id`. On any disagreement, Hindsight wins.
- **It buys correctness the API cannot give us.** The timeline must show *supersession edges* ("this replaced that") and *which interaction produced which memory*. Hindsight has no supersession relation and, per the developer docs, offers **no server-side metadata filtering** — only tag filtering. The relational edges have to live somewhere relational.
- **It buys demo reliability.** The timeline renders from one indexed local query instead of a network round trip, so a slow or rate-limited Hindsight cannot stall the screen the judges are looking at.

If the cache is stale, the timeline is stale. Recommendations are not, because they never touch it.

---

## 2. Application Data — PostgreSQL

Plain SQL migrations over `pg`. No ORM: the schema is nine small tables, and an ORM would add dependency weight and a learning surface for no benefit inside an 8-hour build.

### 2.1 `users`

Minimal, present so interactions and confirmations have an actor. **No authentication in the MVP** (`CURRENT_PROJECT_AUDIT.md` §8.4, decision 1) — one seeded demo user.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `email` | `text` | UNIQUE NOT NULL | |
| `name` | `text` | NOT NULL | |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |

### 2.2 `clients`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `slug` | `text` | UNIQUE NOT NULL | `vive-studio` — used to build tags |
| `name` | `text` | NOT NULL | `Vive Studio` |
| `hindsight_bank_id` | `text` | UNIQUE NOT NULL | `client-vive-studio` — **the link to Hindsight** |
| `industry` | `text` | NULL | display only |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |

`hindsight_bank_id` is the join between the two systems. One bank per client (`HINDSIGHT_INTEGRATION_MAP.md` §3.1).

### 2.3 `projects`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `client_id` | `uuid` | FK → `clients(id)` ON DELETE CASCADE, NOT NULL | |
| `slug` | `text` | NOT NULL | `premium-website-redesign` → tag `project:premium-website-redesign` |
| `name` | `text` | NOT NULL | `Premium Website Redesign` |
| `status` | `text` | NOT NULL default `'active'` | `active` · `paused` · `complete` |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |

UNIQUE `(client_id, slug)`.

### 2.4 `interactions`

Metadata for a client interaction. **The raw text is kept** — it is what was retained, and the timeline links each memory back to its wording. It is *evidence provenance*, not memory.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `client_id` | `uuid` | FK → `clients(id)`, NOT NULL | denormalised for query simplicity |
| `project_id` | `uuid` | FK → `projects(id)` ON DELETE CASCADE, NOT NULL | |
| `label` | `text` | NOT NULL | **`Revision #3`** — verbatim from `docs/DEMO_DATA.md`; drives evidence strings |
| `label_slug` | `text` | NOT NULL | `revision-3` → tag `source:revision-3` |
| `source` | `text` | NOT NULL | `meeting` · `design-review` · `revision` · `email` · `note` |
| `content` | `text` | NOT NULL | the raw client statement |
| `occurred_at` | `timestamptz` | NOT NULL | → Hindsight `timestamp`; orders the timeline |
| `retain_status` | `text` | NOT NULL default `'pending'` | `pending` · `retained` · `failed` · `awaiting_confirmation` |
| `retain_error` | `text` | NULL | last error, for the retry action |
| `hindsight_document_id` | `text` | NULL | `interaction:{id}` |
| `created_by` | `uuid` | FK → `users(id)`, NULL | |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |

UNIQUE `(project_id, label)` — prevents the duplicate-submission case named in `ARCHITECTURE.md` §7.

`retain_status` is what lets the UI tell the truth about whether memory was actually written. Because Hindsight's SDK never auto-retries writes (`HINDSIGHT_INTEGRATION_MAP.md` §1.2), `failed` is a real state with a user-visible retry, not a logged warning.

### 2.5 `memory_refs`

Pointer + display cache. See §1.1 for why this is not a second memory system.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `client_id` | `uuid` | FK → `clients(id)`, NOT NULL | |
| `project_id` | `uuid` | FK → `projects(id)`, NULL | NULL for `scope:client` / `scope:future` memories |
| `interaction_id` | `uuid` | FK → `interactions(id)` ON DELETE SET NULL, NULL | origin |
| `hindsight_memory_id` | `text` | NULL, UNIQUE when present | **authority pointer**; NULL until Hindsight returns an id |
| `hindsight_document_id` | `text` | NULL | |
| `memory_type` | `text` | NOT NULL | `preference` · `approval` · `rejection` · `constraint` · `decision` · `outcome` |
| `statement` | `text` | NOT NULL | cached text — display only |
| `scope` | `text` | NOT NULL | `interaction` · `revision` · `project` · `client` · `future` |
| `tags` | `jsonb` | NOT NULL default `'[]'` | exact tag array sent to Hindsight — makes the write auditable |
| `state` | `text` | NOT NULL default `'valid'` | `valid` · `superseded` · `invalidated` — mirrors Hindsight curation state |
| `confidence` | `numeric(3,2)` | NULL | extractor confidence; drives the durability gate |
| `source_quote` | `text` | NULL | the verbatim span the extractor based this on |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |

> `hindsight_memory_id` is nullable by necessity: `retain` returns `{ success, bank_id, items_count, async, operation_id?, usage? }` — **it does not return per-memory ids**, because Hindsight extracts facts from content rather than storing rows verbatim. Ids are reconciled after the fact by `listMemories({ documentId })`. See §5.

### 2.6 `memory_links`

The supersession graph Hindsight does not model. Delivers the "old memory preserved, new memory current" story on the timeline.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `from_memory_ref_id` | `uuid` | FK → `memory_refs(id)` ON DELETE CASCADE, NOT NULL | the **new** memory |
| `to_memory_ref_id` | `uuid` | FK → `memory_refs(id)` ON DELETE CASCADE, NOT NULL | the **superseded** memory |
| `relation` | `text` | NOT NULL default `'supersedes'` | `supersedes` · `refines` · `contradicts` |
| `scope` | `text` | NOT NULL | the scope the supersession applies at |
| `conflict_id` | `uuid` | FK → `preference_conflicts(id)`, NULL | audit trail back to the confirmation |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |

UNIQUE `(from_memory_ref_id, to_memory_ref_id, relation)`. CHECK `from_memory_ref_id <> to_memory_ref_id`.

### 2.7 `preference_conflicts`

Workflow state for a detected conflict awaiting confirmation. Necessarily relational: it is a pending decision, not a memory. Nothing is retained until it is resolved.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `client_id` | `uuid` | FK → `clients(id)`, NOT NULL | |
| `project_id` | `uuid` | FK → `projects(id)`, NOT NULL | |
| `interaction_id` | `uuid` | FK → `interactions(id)`, NULL | the interaction that raised it |
| `new_statement` | `text` | NOT NULL | *"Brighter accent colors are acceptable"* |
| `new_memory_type` | `text` | NOT NULL | usually `preference` |
| `old_memory_ref_id` | `uuid` | FK → `memory_refs(id)`, NULL | NULL if the contradicted memory has no local ref |
| `old_statement` | `text` | NOT NULL | *"Avoid bright colors"* — cached so the UI renders without a recall |
| `old_hindsight_memory_id` | `text` | NULL | the memory to invalidate in branch B |
| `explanation` | `text` | NOT NULL | why the LLM judged these to conflict |
| `status` | `text` | NOT NULL default `'pending'` | `pending` · `resolved` · `dismissed` |
| `resolved_scope` | `text` | NULL | `interaction` · `project` · `client` · `future` |
| `resolution` | `text` | NULL | `new_preference` · `keep_existing` · `dismissed` |
| `resolved_by` | `uuid` | FK → `users(id)`, NULL | |
| `resolved_at` | `timestamptz` | NULL | |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |

### 2.8 `recommendations`

Audit of agent outputs. Makes "Why?" re-openable without re-running the LLM, and makes the demo's three states inspectable after the fact.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `client_id` | `uuid` | FK → `clients(id)`, NOT NULL | |
| `project_id` | `uuid` | FK → `projects(id)`, NOT NULL | |
| `request_text` | `text` | NOT NULL | *"Create the next homepage direction."* |
| `items` | `jsonb` | NOT NULL | `[{ id, text, rationale, evidenceMemoryIds[] }]` |
| `evidence` | `jsonb` | NOT NULL default `'[]'` | recall snapshot: id, text, tags, `source:` label, `mentioned_at` |
| `memory_used` | `boolean` | NOT NULL | **false when recall returned nothing or Hindsight failed** |
| `memory_count` | `integer` | NOT NULL default `0` | |
| `hindsight_ok` | `boolean` | NOT NULL | honesty flag — never claim memory when false |
| `model` | `text` | NOT NULL | Groq model id used |
| `latency_ms` | `integer` | NULL | |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |

`memory_used` + `hindsight_ok` exist to satisfy the project restriction *"do not claim that memory was used if Hindsight failed"* (`MASTER_SPEC` §2) at the data layer, not just in UI copy.

The `evidence` snapshot is a **point-in-time record of what was recalled**, which is why it is a jsonb blob rather than a join: it must not change when memory later changes, or the audit is worthless.

### 2.9 `recommendation_feedback`

Closes the learning loop — the `Outcome` category in `MASTER_SPEC` §8.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `recommendation_id` | `uuid` | FK → `recommendations(id)` ON DELETE CASCADE, NOT NULL | |
| `verdict` | `text` | NOT NULL | `accepted` · `rejected` · `corrected` |
| `comment` | `text` | NULL | the correction, if any |
| `retained_memory_ref_id` | `uuid` | FK → `memory_refs(id)`, NULL | the outcome memory written to Hindsight |
| `created_by` | `uuid` | FK → `users(id)`, NULL | |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |

### 2.10 `hindsight_directives`

Local record of tag-scoped directives created in Hindsight, so the UI can show which hard rules are active at which scope and the demo reset can clean them up.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `client_id` | `uuid` | FK → `clients(id)`, NOT NULL | |
| `project_id` | `uuid` | FK → `projects(id)`, NULL | NULL = client-wide |
| `hindsight_directive_id` | `text` | NOT NULL | returned by `createDirective` |
| `name` | `text` | NOT NULL | |
| `content` | `text` | NOT NULL | the rule text |
| `scope` | `text` | NOT NULL | `project` · `client` |
| `tags` | `jsonb` | NOT NULL default `'[]'` | |
| `conflict_id` | `uuid` | FK → `preference_conflicts(id)`, NULL | |
| `is_active` | `boolean` | NOT NULL default `true` | |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |

### 2.11 `demo_state`

Single-row table controlling which history stage is loaded. This is what makes the three-state demo (`DEMO_SCRIPT.md`) reproducible on stage instead of dependent on manual setup.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `boolean` | PK, CHECK `id = true` | single-row guard |
| `stage` | `text` | NOT NULL default `'empty'` | `empty` · `history` · `post_conflict` |
| `updated_at` | `timestamptz` | NOT NULL default `now()` | |

Stages map exactly to the demo beats: `empty` = Scene 1 (no memory, generic answer) · `history` = Scenes 2–4 (seven interactions retained) · `post_conflict` = Scene 6 (Revision #6 conflict resolved at project scope).

### 2.12 Indexes

```sql
CREATE UNIQUE INDEX idx_clients_slug              ON clients(slug);
CREATE UNIQUE INDEX idx_clients_bank              ON clients(hindsight_bank_id);
CREATE UNIQUE INDEX idx_projects_client_slug      ON projects(client_id, slug);
CREATE        INDEX idx_projects_client           ON projects(client_id);

CREATE UNIQUE INDEX idx_interactions_project_label ON interactions(project_id, label);
CREATE        INDEX idx_interactions_timeline      ON interactions(project_id, occurred_at DESC);
CREATE        INDEX idx_interactions_retain_status ON interactions(retain_status) WHERE retain_status <> 'retained';

CREATE        INDEX idx_memory_refs_project        ON memory_refs(project_id, created_at DESC);
CREATE        INDEX idx_memory_refs_client         ON memory_refs(client_id, created_at DESC);
CREATE UNIQUE INDEX idx_memory_refs_hs_id          ON memory_refs(hindsight_memory_id) WHERE hindsight_memory_id IS NOT NULL;
CREATE        INDEX idx_memory_refs_type_state     ON memory_refs(project_id, memory_type, state);
CREATE        INDEX idx_memory_refs_interaction    ON memory_refs(interaction_id);

CREATE        INDEX idx_memory_links_from          ON memory_links(from_memory_ref_id);
CREATE        INDEX idx_memory_links_to            ON memory_links(to_memory_ref_id);

CREATE        INDEX idx_conflicts_open             ON preference_conflicts(project_id, status) WHERE status = 'pending';
CREATE        INDEX idx_recommendations_project    ON recommendations(project_id, created_at DESC);
CREATE        INDEX idx_directives_client          ON hindsight_directives(client_id) WHERE is_active;
```

The partial indexes on `retain_status` and `status = 'pending'` matter: both are polled by the UI (retry banner, open-conflicts badge) and are overwhelmingly skewed toward the uninteresting value.

### 2.13 Relationships

```
users ──< interactions
        └─< preference_conflicts.resolved_by
        └─< recommendation_feedback.created_by

clients ──< projects ──< interactions ──< memory_refs
    │           │                            │
    │           ├──< preference_conflicts ───┤ (old_memory_ref_id)
    │           ├──< recommendations ──< recommendation_feedback
    │           └──< hindsight_directives
    └──< memory_refs (client-scoped, project_id NULL)

memory_refs ──< memory_links >── memory_refs      (supersedes)

clients.hindsight_bank_id ─────────────→ Hindsight bank  (the cross-system join)
memory_refs.hindsight_memory_id ───────→ Hindsight memory unit
interactions.hindsight_document_id ────→ Hindsight document
hindsight_directives.hindsight_directive_id → Hindsight directive
```

---

## 3. Hindsight Memory — the experiential layer

Full detail in `HINDSIGHT_INTEGRATION_MAP.md` §3. Summarised here for the split.

| ClientOS concept | Stored in Hindsight as | Scope mechanism |
|---|---|---|
| Preference | memory tagged `type:preference` | `scope:` tag |
| Approval | `type:approval` | `scope:` tag |
| Rejection | `type:rejection` | `scope:` tag |
| Constraint | `type:constraint` (+ directive if it must bind hard) | `scope:` tag / directive tags |
| Decision | `type:decision` | `scope:` tag |
| Outcome | `type:outcome` | `scope:` tag |
| Preference change | new memory + tag-scoped directive + conditional invalidation of the old | branch by confirmed scope |
| Standing preference | Hindsight `observation` (auto-consolidated) | inherited from sources |
| Client brief (P1) | mental model | `tagGroups` on refresh |

**Never stored in Hindsight:** user accounts, client/project rows, UI state, pending (unconfirmed) conflicts, recommendation audit rows.
**Never authoritative in PostgreSQL:** memory semantics, recall relevance, consolidated observations.

---

## 4. Demo Seed Data

One fictional client, per `MASTER_SPEC` §16 and `docs/DEMO_DATA.md` — **no invented additions** beyond the one flagged fix below.

`clients`: `Vive Studio` / `vive-studio` / bank `client-vive-studio`
`projects`: `Premium Website Redesign` / `premium-website-redesign`
`users`: one demo user

`interactions` — labels verbatim, because they become evidence strings:

| # | `label` | `label_slug` | `source` | Content (from `docs/DEMO_DATA.md`) | Expected memories |
|---|---|---|---|---|---|
| 1 | `Meeting #1` | `meeting-1` | `meeting` | "We want the website to feel premium and minimal." | `preference`: premium positioning; `preference`: minimal visual style |
| 2 | `Design Review #1` | `design-review-1` | `design-review` | "Keep the layouts clean and avoid unnecessary visual elements." | `preference`: minimal, clean layouts |
| 3 | `Design Review #2` | `design-review-2` | `design-review` | "The serif heading direction works well. Let's keep it." | `approval`: serif typography |
| 4 | `Revision #2` | `revision-2` | `revision` | "The blue-heavy version doesn't feel right." | `rejection`: blue-heavy visual direction |
| 5 | `Revision #3` | `revision-3` | `revision` | "The animations are too much. Keep movement subtle." | `rejection`: heavy animation; `preference`: restrained animation |
| 6 | `Revision #4` | `revision-4` | `revision` | "Keep the headlines shorter." | `preference`: short headlines |
| 7 | `Revision #5` | `revision-5` | `revision` | "Put customer proof closer to the top of the page." | `approval`: customer proof above the fold |
| 8 | `Revision #6` | `revision-6` | `revision` | "We're now open to brighter accent colors." | **conflict candidate** — not retained until confirmed |

Stage `history` loads rows 1–7. Row 8 is submitted live on stage to trigger conflict detection. Stage `post_conflict` loads 1–7 plus the resolved project-scoped outcome.

### 4.1 Required fix — the conflict has no source memory

**`docs/DEMO_DATA.md` Revision #6 presents the conflict as "Avoid bright colors" → "Brighter accent colors are acceptable," but no interaction in rows 1–7 ever establishes "avoid bright colors."** Rows 1–7 yield premium positioning, minimal/clean layouts, serif approved, *blue-heavy rejected*, heavy animation rejected, short headlines, customer proof above the fold. "Blue-heavy" is a hue rejection, not a brightness one.

A genuine recall will therefore surface nothing to conflict with, and Scene 5 — the demo's climax and Definition-of-Done item 8 — will produce no conflict. Full analysis in `CURRENT_PROJECT_AUDIT.md` §8.1.

**Recommended minimal fix, pending approval:** extend interaction 1 or 2 with one clause establishing a restrained palette, e.g. Design Review #1 becomes:

> "Keep the layouts clean and avoid unnecessary visual elements. Keep the colour palette restrained and muted — avoid bright, saturated colour."

One clause, consistent with the already-specified premium/minimal positioning, and it makes the conflict real rather than staged. **This changes specified demo data, so it is flagged rather than applied.**

### 4.2 Reset and staging

`POST /api/demo/reset` — truncate application tables, `deleteBank('client-vive-studio')`, `createBank` with missions, reseed to the requested stage, `retainBatch` the interactions with `async: false`, then reconcile memory ids (§5). Guarded by `DEMO_RESET_TOKEN` because it is destructive.

Being able to return to a known state in one call is the difference between a demo that can be rehearsed and one that cannot.

---

## 5. Reconciling Hindsight memory ids

A real constraint that shapes the schema, not an incidental detail.

`retain` returns `{ success, bank_id, items_count, async, operation_id?, operation_ids?, usage? }`. It does **not** return ids for the memories it created, because Hindsight extracts facts from content rather than storing submitted text verbatim — one retained interaction may yield several facts, or none.

Consequence: ClientOS cannot know `hindsight_memory_id` at write time. The reconciliation step:

1. `retain` with `documentId = interaction:{id}` and the full tag set.
2. `listMemories(bankId, { documentId: 'interaction:{id}', limit: 100 })`.
3. Match returned units to the pending `memory_refs` rows for that interaction (by `documentId`, then by text similarity against `statement`).
4. Write back `hindsight_memory_id`; set `retain_status = 'retained'`.

Implications the schema already accommodates:
- `memory_refs.hindsight_memory_id` **must** be nullable.
- Hindsight may extract a different number of facts than ClientOS predicted. Unmatched Hindsight units are inserted as new `memory_refs` rows (memory Hindsight found that we did not anticipate); unmatched local rows are marked `state = 'invalidated'` with `hindsight_memory_id` NULL and are **excluded from the timeline**, so the UI never shows a memory that does not exist in Hindsight.
- Branch B of conflict resolution needs `old_hindsight_memory_id` to invalidate the old memory — which is why `preference_conflicts` caches it directly rather than relying on a join.

---

## 6. Migrations

```
backend/src/db/migrations/
  001_init.sql        -- pgcrypto; users, clients, projects, interactions
  002_memory.sql      -- memory_refs, memory_links, hindsight_directives
  003_agent.sql       -- preference_conflicts, recommendations, recommendation_feedback
  004_demo.sql        -- demo_state
  005_indexes.sql     -- all indexes from §2.12
```

Applied by a small `migrate.ts` runner that tracks applied filenames in a `schema_migrations` table. Forward-only — adequate and appropriate for a hackathon; no down-migrations.

---

## 7. Data Volumes and Safety

Demo scale: 1 user, 1 client, 1 project, 8 interactions, ~12–20 memory refs, 1 conflict, a handful of recommendations. No table exceeds a few dozen rows, so the indexes in §2.12 are for correctness of the polled queries and future headroom, not present performance.

Per `MASTER_SPEC` §23 and `docs/PRODUCT_DECISIONS.md` Decision 7: **all seed data is synthetic.** Vive Studio is fictional. No real client data enters either system. `DATABASE_URL`, `HINDSIGHT_API_KEY` and `GROQ_API_KEY` are backend-only and gitignored — and `.gitignore` does not yet exist, so creating it is Phase 1 step 1.
