# ClientOS — API Integration Plan

---

## A. Existing Application APIs

**Count: 0.**

No API exists. No Express app, no route file, no handler, no server entry point (`CURRENT_PROJECT_AUDIT.md` §4). `docs/API.md` contains an 8-endpoint *conceptual sketch*, hedged in its own opening line: "This document defines the conceptual API contract. Exact routes can be adapted during implementation."

The sketch, and how each item is carried forward:

| # | Sketched (`docs/API.md`) | Disposition |
|---|---|---|
| 1 | `GET /api/clients` | **kept as-is** |
| 2 | `GET /api/clients/:clientId` | **kept as-is** |
| 3 | `POST /api/clients/:clientId/interactions` | **moved** to `/api/projects/:projectId/interactions` — an interaction always belongs to a project, and the sketch passed `projectId` in the body anyway |
| 4 | `POST /api/agent/respond` | **renamed** `POST /api/agent/recommend` — the product output is a recommendation, not a chat reply (`docs/PRODUCT_DECISIONS.md` Decision 6: keep chat secondary) |
| 5 | `GET /api/clients/:clientId/memory` | **kept**, plus a project-scoped sibling |
| 6 | `POST /api/clients/:clientId/memory/confirm` | **merged** into `POST /api/conflicts/:conflictId/resolve` — the sketch had two overlapping confirmation paths, which would have produced duplicate write logic |
| 7 | `GET /api/clients/:clientId/conflicts` | **kept**, plus a project-scoped sibling |
| 8 | `POST /api/conflicts/:conflictId/resolve` | **kept as the single confirmation path** |

Gaps in the sketch that the plan closes: no response schemas for four of the eight endpoints, no error contracts, no validation rules, no health/readiness endpoint, no way to capture a recommendation outcome (so the learning loop could not close), and **no way to reset or stage the demo dataset** — which the three-state demo in `DEMO_SCRIPT.md` structurally requires.

---

## B. Required ClientOS APIs

**Count: 16** (13 P0, 1 P1, 2 demo-support).

Conventions for all endpoints:

- Base path `/api`. JSON in, JSON out.
- **Authentication: none in the MVP** (`CURRENT_PROJECT_AUDIT.md` §8.4). A single seeded demo user is resolved server-side. The one exception is `POST /api/demo/reset`, guarded by `x-demo-token` because it is destructive.
- Validation via `zod` at the route boundary; `400` with `{ error: { code: 'VALIDATION_ERROR', message, details } }`.
- Uniform error envelope: `{ error: { code, message, details? } }`.
- Codes: `VALIDATION_ERROR` (400) · `NOT_FOUND` (404) · `CONFLICT` (409) · `HINDSIGHT_UNAVAILABLE` (503) · `LLM_UNAVAILABLE` (503) · `INTERNAL` (500).
- **`HINDSIGHT_UNAVAILABLE` is never downgraded into a successful response.** Per `ARCHITECTURE.md` §7, a memory-dependent request that cannot reach Hindsight fails loudly rather than returning an answer that silently used no memory.

---

### 1. `GET /api/health`

| | |
|---|---|
| Purpose | liveness; DB reachability |
| Auth | none |
| Request | — |
| Validation | — |
| Logic | `SELECT 1` |
| Hindsight | none |
| DB | trivial read |
| Response | `200 { status: 'ok', db: true, uptimeMs }` |
| Errors | `503` if DB unreachable |
| Consumer | deployment health checks (Render) |

### 2. `GET /api/health/hindsight`

| | |
|---|---|
| Purpose | verify Hindsight credentials and reachability — required by `SETUP.md` §5 before the demo |
| Auth | none |
| Request | — |
| Validation | — |
| Logic | call `getVersion()`; map errors to a connected/disconnected verdict |
| **Hindsight** | **`getVersion()`** |
| DB | none |
| Response | `200 { connected: true, version, bankId }` · `200 { connected: false, reason }` |
| Errors | returns `200` with `connected: false` rather than `503` — the badge must always render |
| Consumer | memory-status badge in the app header |

This endpoint is the honesty mechanism for the whole product: the UI shows a live memory-connected state, so no scene can imply memory worked when it did not.

### 3. `GET /api/clients`

| | |
|---|---|
| Purpose | dashboard client list with decision counts |
| Request | — |
| Logic | clients + aggregate counts of interactions and `memory_refs` by type |
| Hindsight | none — counts come from `memory_refs` (display cache) |
| DB | `clients` ⋈ `projects` ⋈ `interactions` ⋈ `memory_refs` |
| Response | `200 { clients: [{ id, slug, name, projectCount, interactionCount, counts: { preference, approval, rejection, constraint, decision, outcome }, openConflicts, lastInteractionAt }] }` |
| Errors | `500` |
| Consumer | **Client Dashboard** |

### 4. `GET /api/clients/:clientId`

| | |
|---|---|
| Purpose | client detail + projects |
| Validation | `clientId` uuid-or-slug |
| Hindsight | none |
| DB | `clients` + `projects` |
| Response | `200 { client: { id, slug, name, hindsightBankId, industry }, projects: [{ id, slug, name, status, interactionCount, openConflicts }] }` |
| Errors | `404 NOT_FOUND` |
| Consumer | **Client Workspace** header |

### 5. `GET /api/projects/:projectId`

| | |
|---|---|
| Purpose | project detail with grouped current memory state |
| Hindsight | none (cache read) |
| DB | `projects` + `memory_refs` grouped by `memory_type`, `state = 'valid'` |
| Response | `200 { project, client, memory: { preferences[], approvals[], rejections[], constraints[], decisions[], outcomes[] }, openConflicts: n }` |
| Errors | `404` |
| Consumer | **Client Workspace** panels ("Preferences", "Rejected ideas", "Open conflicts") |

### 6. `GET /api/projects/:projectId/interactions`

| | |
|---|---|
| Purpose | interaction history |
| Request | `?limit=50&offset=0` |
| DB | `interactions` ordered by `occurred_at DESC` |
| Response | `200 { interactions: [{ id, label, source, content, occurredAt, retainStatus, retainError, memoryCount }], total }` |
| Errors | `404` |
| Consumer | Client Workspace; Memory Timeline scaffold |

`retainStatus` / `retainError` surface the retry affordance for failed writes (Hindsight never auto-retries writes).

### 7. `POST /api/projects/:projectId/interactions` ⭐

The **write path of the product**. Records an interaction, extracts durable memory, checks for conflicts, and retains what is unambiguous.

| | |
|---|---|
| Auth | none (demo user) |
| Request | `{ label, source, content, occurredAt? }` |
| Validation | `label` 1–80 chars; `source` ∈ `meeting\|design-review\|revision\|email\|note`; `content` 1–5000 chars; `occurredAt` ISO-8601, defaults `now()`; **`(projectId, label)` must be unique** |
| Business logic | 1. insert `interactions` (`retain_status='pending'`) → 2. **extract** durable candidates via Groq structured output → 3. discard non-durable (§`AGENT_IMPLEMENTATION.md` §4) → 4. for each candidate, targeted **recall** + LLM adjudication for contradiction → 5. **if conflict:** insert `preference_conflicts` (`pending`), set `retain_status='awaiting_confirmation'`, **retain nothing** → 6. **if no conflict:** `retain` each candidate with full tags, insert `memory_refs`, reconcile ids via `listMemories({documentId})`, set `retain_status='retained'` |
| **Hindsight** | **`recall`** (conflict check) → **`retain`** (`async:false`) → **`listMemories`** (id reconciliation) |
| DB | insert `interactions`; insert `memory_refs`; insert `preference_conflicts` |
| Response | `201 { interaction, extracted: [{ type, statement, scope, confidence, sourceQuote }], discarded: [{ text, reason }], retained: n, conflicts: [{ id, newStatement, oldStatement, oldMemoryId, explanation }], retainStatus }` |
| Errors | `400` · `404` · `409 CONFLICT` duplicate label · `503 HINDSIGHT_UNAVAILABLE` (interaction row is still persisted, `retain_status='failed'`, retryable) · `503 LLM_UNAVAILABLE` |
| Consumer | Client Workspace "Add interaction"; **Scene 5** of the demo |

Returning `discarded` is deliberate: it lets the UI *show* that ClientOS is selective rather than retaining everything, which is the `MASTER_SPEC` §9 rule made visible.

### 8. `POST /api/interactions/:interactionId/retry-retain`

| | |
|---|---|
| Purpose | re-run retain after a Hindsight failure — necessary because the SDK never auto-retries writes |
| Validation | interaction exists; `retain_status ∈ {failed, pending}` |
| Hindsight | **`retain`** + **`listMemories`** |
| DB | update `interactions`; insert `memory_refs` |
| Response | `200 { retainStatus, retained: n }` |
| Errors | `404` · `409` if already `retained` · `503` |
| Consumer | retry button on a failed interaction |

### 9. `GET /api/projects/:projectId/memory` ⭐

| | |
|---|---|
| Purpose | **Memory Timeline** data |
| Request | `?type=&scope=&state=valid&from=&to=&limit=100&offset=0` |
| Validation | enums for `type`/`scope`/`state`; ISO dates |
| Logic | read `memory_refs` joined to `interactions` and `memory_links`, chronological, including supersession edges |
| Hindsight | **none by default.** `?verify=true` cross-checks against `listMemories` and flags drift |
| DB | `memory_refs` ⋈ `interactions` ⋈ `memory_links` |
| Response | `200 { memories: [{ id, hindsightMemoryId, type, statement, scope, state, tags, occurredAt, interaction: { id, label, source }, supersedes: [{ id, statement }], supersededBy: { id, statement } | null }], total, verified? }` |
| Errors | `404` · `503` only when `verify=true` |
| Consumer | **Memory Timeline**; Why/evidence drawer |

Reading the cache rather than Hindsight is a deliberate demo-reliability choice (`DATA_MODEL.md` §1.1) — the timeline must render instantly and must not stall if Hindsight is rate-limited mid-demo. `?verify=true` exists so the claim "this mirrors Hindsight" is checkable, not asserted.

### 10. `GET /api/clients/:clientId/memory`

As §9 but client-wide across projects (`scope:client` / `scope:future` plus every project's memories). Consumer: client-level memory view. Preserves the sketched endpoint from `docs/API.md`.

### 11. `POST /api/agent/recommend` ⭐⭐

**The core read path — the endpoint the entire demo turns on.**

| | |
|---|---|
| Auth | none |
| Request | `{ clientId, projectId, message, useMemory?: boolean }` |
| Validation | `message` 1–1000 chars; client and project exist and are related; `useMemory` defaults `true` |
| Business logic | 1. resolve client → `hindsight_bank_id`, project → `project:{slug}` tag → 2. **recall** with `tagGroups` scoping (project ∪ client ∪ future), `budget:'mid'`, `preferObservations:true` → 3. classify recalled memories into applicable preferences / rejected approaches / constraints → 4. surface any `pending` conflicts as caveats → 5. **Groq** synthesis with memory as the *only* permitted source of client history → 6. bind each bullet to `evidenceMemoryIds` → 7. persist `recommendations` |
| **Hindsight** | **`recall`** (skipped entirely when `useMemory: false`) |
| LLM | Groq, structured JSON output |
| DB | read `clients`/`projects`/`preference_conflicts`; insert `recommendations` |
| Response | `200 { recommendationId, memoryUsed, memoryCount, hindsightOk, items: [{ id, text, rationale, evidence: [{ memoryId, statement, sourceLabel, type, occurredAt }] }], avoid: [{ text, evidence[] }], caveats: [], model, latencyMs }` |
| Errors | `400` · `404` · **`503 HINDSIGHT_UNAVAILABLE`** when `useMemory:true` and recall fails — **the request fails; it does not fall back to a memoryless answer** · `503 LLM_UNAVAILABLE` |
| Consumer | **AI Workspace** — Scenes 1, 3 and 6 |

`useMemory: false` is what produces the honest **Scene 1** generic answer: it skips recall entirely and the response carries `memoryUsed: false`. The same request with `useMemory: true` produces Scene 3. **Same endpoint, same message, different memory state** — which is exactly the claim the demo makes, demonstrated rather than narrated.

When recall legitimately returns zero memories, the response is `200` with `memoryUsed: false, memoryCount: 0`, and the agent states that no relevant history exists (`MASTER_SPEC` §19). That is distinct from `503`, which means memory *should* have been available and was not.

### 12. `GET /api/agent/recommendations/:id`

Re-open a past recommendation with its evidence snapshot, without re-running the LLM. Reads `recommendations`. `200 { recommendation }` · `404`. Consumer: Why/evidence drawer; demo re-runs.

### 13. `POST /api/agent/recommendations/:id/feedback`

Closes the learning loop (`MASTER_SPEC` §7: outcome → retained learning).

| | |
|---|---|
| Request | `{ verdict: 'accepted'\|'rejected'\|'corrected', comment? }` |
| Validation | verdict enum; `comment` required when `corrected`, ≤1000 chars |
| Logic | insert `recommendation_feedback`; **retain** an outcome memory (`type:outcome`, `scope:project`); for `corrected`, run extraction on the comment and conflict-check it as in §7 |
| **Hindsight** | **`retain`** (+ **`recall`** when `corrected`) |
| DB | insert `recommendation_feedback`, `memory_refs` |
| Response | `200 { feedbackId, retained: n, conflicts: [] }` |
| Errors | `400` · `404` · `503` |
| Consumer | accept/correct controls on a recommendation |

### 14. `GET /api/projects/:projectId/conflicts` *(and `GET /api/clients/:clientId/conflicts`)*

| | |
|---|---|
| Purpose | list conflicts, default `status=pending` |
| Request | `?status=pending\|resolved\|dismissed\|all` |
| DB | `preference_conflicts` ⋈ `memory_refs` ⋈ `interactions` |
| Response | `200 { conflicts: [{ id, status, newStatement, newMemoryType, oldStatement, oldMemoryId, explanation, interaction: { id, label }, createdAt, resolvedScope, resolution }] }` |
| Errors | `404` |
| Consumer | "Open conflicts" panel; conflict badge |

### 15. `POST /api/conflicts/:conflictId/resolve` ⭐⭐

**The preference-conflict confirmation path.** Single, unified confirmation endpoint (replacing the two overlapping paths in `docs/API.md`).

| | |
|---|---|
| Request | `{ resolution: 'new_preference'\|'keep_existing'\|'dismissed', scope?: 'interaction'\|'project'\|'client'\|'future' }` |
| Validation | conflict exists and `status='pending'` (else `409`); `scope` **required** when `resolution='new_preference'`; scope enum enforced |
| Business logic | branch on scope — the three branches from `HINDSIGHT_INTEGRATION_MAP.md` §4.3: **`project`** → retain new memory `scope:project`; `createDirective` tagged `project:{slug}`; mark old ref `status:superseded` but leave it **valid**; insert `memory_links` · **`client` / `future`** → retain `scope:client`; `createDirective` tagged `client:{slug}`; **`updateMemory` → `state:'invalidated'`** with a reason on the old memory; insert `memory_links` · **`interaction`** → retain `scope:interaction` only; no directive, no invalidation · **`keep_existing` / `dismissed`** → no Hindsight write; close the conflict |
| **Hindsight** | **`retain`** → **`createDirective`** → **`updateMemory`** (client/future branch only) → **`listMemories`** (reconciliation) |
| DB | update `preference_conflicts`; insert `memory_refs`, `memory_links`, `hindsight_directives`; update `interactions.retain_status='retained'` |
| Response | `200 { conflictId, status: 'resolved', resolvedScope, newMemory: { id, hindsightMemoryId, statement, scope }, supersededMemory: { id, statement, state } | null, directive: { id, scope } | null }` |
| Errors | `400` missing scope · `404` · `409` already resolved · `503` |
| Consumer | **Preference Conflict modal** — Scene 5 |

The old memory is **never deleted** in any branch. Client-wide changes invalidate it — which per the Hindsight developer docs removes it from recall while keeping it *"auditable and restorable."* That is `docs/PRODUCT_DECISIONS.md` Decision 3 satisfied by a real platform capability rather than by convention.

### 16. `POST /api/demo/reset` and `POST /api/demo/stage`

Not in `docs/API.md`, and **demo-critical**: the three-state narrative is unrunnable without a one-call return to a known state.

| | `POST /api/demo/reset` | `POST /api/demo/stage` |
|---|---|---|
| Purpose | full reset + reseed | switch history stage |
| Auth | **`x-demo-token`** header (destructive) | `x-demo-token` |
| Request | `{ stage: 'empty'\|'history'\|'post_conflict' }` | `{ stage }` |
| Logic | truncate app tables → `deleteBank` → `createBank` with missions → seed client/project/user → `retainBatch` interactions for the stage (`async:false`) → reconcile ids | reseed interactions to the target stage without recreating the bank |
| **Hindsight** | **`deleteBank`** → **`createBank`** → **`retainBatch`** → **`listMemories`** | **`retainBatch`** / **`updateMemory`** |
| DB | truncate + reseed | insert/update |
| Response | `200 { stage, clientId, projectId, interactionsSeeded, memoriesRetained, bankId }` | `200 { stage, ... }` |
| Errors | `401` bad token · `503` |
| Consumer | pre-demo setup; a hidden "Reset demo" control |

Stage mapping: `empty` → Scene 1 · `history` → interactions 1–7, Scenes 2–4 · `post_conflict` → 1–7 plus the resolved project-scoped change, Scene 6.

---

## C. Summary

| # | Method | Route | Priority | Hindsight op |
|---|---|---|---|---|
| 1 | GET | `/api/health` | P0 | — |
| 2 | GET | `/api/health/hindsight` | P0 | `getVersion` |
| 3 | GET | `/api/clients` | P0 | — |
| 4 | GET | `/api/clients/:clientId` | P0 | — |
| 5 | GET | `/api/projects/:projectId` | P0 | — |
| 6 | GET | `/api/projects/:projectId/interactions` | P0 | — |
| 7 | POST | `/api/projects/:projectId/interactions` | **P0** | `recall` → `retain` → `listMemories` |
| 8 | POST | `/api/interactions/:id/retry-retain` | P1 | `retain` → `listMemories` |
| 9 | GET | `/api/projects/:projectId/memory` | **P0** | *(cache; `?verify` → `listMemories`)* |
| 10 | GET | `/api/clients/:clientId/memory` | P0 | *(cache)* |
| 11 | POST | `/api/agent/recommend` | **P0** | `recall` |
| 12 | GET | `/api/agent/recommendations/:id` | P0 | — |
| 13 | POST | `/api/agent/recommendations/:id/feedback` | P0 | `retain` (+`recall`) |
| 14 | GET | `/api/projects/:projectId/conflicts` | **P0** | — |
| 15 | POST | `/api/conflicts/:conflictId/resolve` | **P0** | `retain` → `createDirective` → `updateMemory` |
| 16 | POST | `/api/demo/reset` · `/api/demo/stage` | **P0** | `deleteBank` → `createBank` → `retainBatch` |

**13 P0 · 1 P1 · 2 demo-support.** Every Hindsight operation referenced is verified in `HINDSIGHT_INTEGRATION_MAP.md` §8. No endpoint is invented beyond what the MVP scope in `MASTER_SPEC` §14 and the Definition of Done in §27 require.

### Route files

```
backend/src/routes/
  health.routes.ts        -- 1, 2
  clients.routes.ts       -- 3, 4, 10, 14(client)
  projects.routes.ts      -- 5, 6, 7, 9, 14(project)
  interactions.routes.ts  -- 8
  agent.routes.ts         -- 11, 12, 13
  conflicts.routes.ts     -- 15
  demo.routes.ts          -- 16
```

### Frontend consumers

| Screen | Endpoints |
|---|---|
| Client Dashboard | 3 |
| Client Workspace | 4, 5, 6, 7, 14 |
| AI Workspace | 11, 12, 13, 15 |
| Memory Timeline | 9, 10 |
| App shell (memory badge) | 2 |
| Conflict modal | 14, 15 |
| Hidden demo controls | 16 |
