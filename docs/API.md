# ClientOS — API Reference

Base path `/api`. All responses are JSON.

**Implemented and verified.** Nothing below is aspirational.

## Response envelope

```jsonc
// success
{ "success": true, "data": { /* ... */ } }

// failure
{ "success": false, "error": { "code": "…", "message": "…", "details": [], "requestId": "…" } }
```

`details` appears only for `VALIDATION_ERROR` and contains field-level messages. Internal
errors never leak stack traces, SQL, or credentials. Every response carries `x-request-id`.

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request failed validation |
| `UNAUTHORIZED` | 401 | Demo token missing or wrong |
| `NOT_FOUND` | 404 | Unknown client, project, conflict, recommendation, or route |
| `CONFLICT` | 409 | Duplicate label, or an already-resolved conflict |
| `PAYLOAD_TOO_LARGE` | 413 | Body over 256 kB |
| `MEMORY_UNAVAILABLE` | 503 | Hindsight unreachable/unconfigured. **No recommendation is returned.** |
| `LLM_UNAVAILABLE` | 503 | Groq unreachable, rate-limited, misconfigured, or output unusable |
| `DATABASE_UNAVAILABLE` | 503 | PostgreSQL unreachable |
| `INTERNAL` | 500 | Unexpected fault |

`MEMORY_UNAVAILABLE` and `LLM_UNAVAILABLE` are deliberately distinct: the UI must be able to
say which layer failed, and a memory failure must never be presented as a successful answer.

## Authentication

The MVP has no user authentication (a single seeded demo user acts for all requests).
Client/project boundaries are still enforced server-side: `POST /agent/recommend` resolves both
ids and rejects a project that does not belong to the given client. Services take a `userId`
so real auth can be added without reshaping them.

`POST /demo/reset` and `POST /demo/stage` require `x-demo-token` because they are destructive.

---

## Health

### `GET /api/health`
`200 { status, db, uptimeMs }` · `503 DATABASE_UNAVAILABLE`

### `GET /api/health/hindsight`
Always `200` so the UI badge can always render.

```json
{ "connected": true, "version": "…", "configured": true,
  "baseUrl": "https://api.hindsight.vectorize.io", "tenant": "default",
  "llmConfigured": true, "model": "openai/gpt-oss-120b", "demoStage": "history" }
```

When disconnected: `{ "connected": false, "reason": "credentials rejected by memory service" }`.

Verified with an **authenticated** Hindsight call, not a version ping — an unauthenticated
probe would report "connected" while every real operation failed with 401.

---

## Clients

### `GET /api/clients`
`{ clients: [{ id, slug, name, industry, context, projectCount, interactionCount, openConflicts, lastInteractionAt, counts }] }`
where `counts` is per memory type.

### `GET /api/clients/:clientId`
Accepts a uuid or slug. → `{ client: { …, hindsightBankId }, projects: [...] }` · `404`

### `GET /api/clients/:clientId/memory`
Query: `type`, `state`, `limit`, `offset`. Client-wide timeline.

### `GET /api/clients/:clientId/conflicts`
Query: `status` = `pending` (default) · `resolved` · `dismissed` · `all`.

### `POST /api/clients`

Creates a client **and provisions its memory**. The caller never supplies or sees anything
about the memory layer.

```json
{ "name": "Vive Studio", "description": "Premium design studio.", "firstProjectName": "Premium Website Redesign" }
```

`name` required, ≤ 80 chars. `description` and `firstProjectName` optional, ≤ 500 / ≤ 80.

`201 { client: { id, slug, name, industry, context }, projectId, projectSlug, memoryReady }`

The memory bank is created **before** the database row, so a client row only exists once its
memory exists — there is no way to end up with a client that looks usable but cannot store
memory. Errors: `400` invalid name · `409` name already taken · **`503 MEMORY_UNAVAILABLE`, in
which case nothing is created at all**.

### `POST /api/clients/:clientId/projects`

```json
{ "name": "Premium Website Redesign", "description": "Full redesign of the marketing site." }
```

`201 { project: { id, slug, name, description, status, interactionCount, memoryCount, openConflicts } }`

A project is a tag inside the client's existing bank, not a bank of its own, so this path does
no memory-layer work and cannot fail on it. Errors: `400` · `404` unknown client · `409`
duplicate name for that client.

---

## Projects

### `GET /api/projects/:projectId`
Project, client, and current memory grouped by category, plus `memoryCount` and `openConflicts`.

### `GET /api/projects/:projectId/interactions`
`{ interactions: [{ id, label, source, content, occurredAt, retainStatus, retainError, memoryCount }], total }`

`retainStatus`: `pending` · `retained` · `failed` · `awaiting_confirmation` · `not_durable`.

### `POST /api/projects/:projectId/interactions` ⭐

The write path. Records feedback, extracts durable memory, checks each candidate against
existing memory, and retains only what is unambiguous.

```json
{ "label": "Revision #6", "source": "revision",
  "content": "We're now open to brighter accent colours.", "occurredAt": "2026-09-27T10:00:00Z" }
```

`source` ∈ `meeting | design-review | revision | email | note`. `label` ≤ 80 chars,
`content` ≤ 5000. `(projectId, label)` is unique.

`201`:
```json
{ "interaction": { "id": "…", "retainStatus": "awaiting_confirmation" },
  "extracted": [{ "memoryType": "preference_change", "statement": "…", "scope": "project",
                  "confidence": 0.95, "sourceQuote": "…", "retained": false,
                  "needsScopeConfirmation": false }],
  "discarded": [{ "text": "…", "reason": "vague statements with no usable content" }],
  "retained": 0,
  "conflicts": [{ "id": "…", "newStatement": "…", "oldStatement": "…",
                  "oldMemoryId": "…", "explanation": "…", "confidence": 0.95 }],
  "warnings": [] }
```

**When a conflict is detected, nothing is written to Hindsight.** `retained` is 0 and the
interaction sits at `awaiting_confirmation` until the scope is confirmed.

Errors: `400` · `404` · `409` duplicate label · `503 MEMORY_UNAVAILABLE` / `LLM_UNAVAILABLE`
(the interaction row is still persisted and retryable).

### `GET /api/projects/:projectId/memory`
Query: `type`, `scope`, `state`, `from`, `to`, `limit`, `offset`.

Returns this project's memories **plus the client-wide ones**, which is what recall for this
project draws on.

Each memory carries `hindsightMemoryId`, `memoryType`, `statement`, `scope`, `state`, `tags`,
`confidence`, `sourceQuote`, `occurredAt`, `interaction`, `supersedes[]`, `supersededBy`, and
`project`.

`project` is `{ id, slug, name }` for a memory owned by a project, and **`null` for a client-wide
memory** — that null is how the UI tells the two apart, so a client-wide decision is never
attributed to whichever project happens to be open.

### `GET /api/projects/:projectId/conflicts`
As the client-level endpoint, scoped to one project.

---

## Interactions

### `POST /api/interactions/:interactionId/retry-retain`
Re-runs retain after a failure — necessary because the Hindsight SDK never auto-retries writes.
`200 { retainStatus, retained, discarded }` · `409` if already retained or awaiting confirmation.

---

## Memory curation

### `POST /api/memories/:memoryId/invalidate`

Retires a memory from active reasoning. Optional `{ "reason": "…" }`.

`200 { memoryRefId, statement, state: "invalidated", retiredInMemoryService, warnings }`

**Nothing is deleted.** The memory disappears from recall and stops shaping recommendations,
but remains on the timeline as history and can be restored. `retiredInMemoryService` is `false`
when the memory had no resolved memory-service id, and the reason is returned in `warnings`
rather than the result being reported as a clean success.

Errors: `400` malformed id · `404` · `409` already retired.

### `POST /api/memories/:memoryId/restore`

Reverses the above. `200` with `state: "valid"` · `409` if the memory is not retired.

---

## Agent

### `POST /api/agent/recommend` ⭐⭐

```json
{ "clientId": "…", "projectId": "…", "message": "Create the next homepage direction.", "useMemory": true }
```

`message` ≤ 1000 chars. `useMemory` defaults `true`; `false` skips recall entirely and produces
an explicitly generic answer.

`200`:
```json
{ "recommendationId": "…", "memoryUsed": true, "memoryCount": 9, "hindsightOk": true,
  "summary": "…",
  "items": [{ "id": "item-1", "text": "…", "rationale": "…",
              "why": "The client rejected heavy animation. (Revision #3)",
              "evidence": [{ "memoryId": "…", "statement": "…", "memoryType": "rejection",
                             "scope": "project", "sourceLabelDisplay": "Revision #3",
                             "occurredAt": "…", "tags": [] }] }],
  "avoid": [ /* same shape */ ],
  "notes": [], "caveats": [], "model": "openai/gpt-oss-120b", "latencyMs": 4492 }
```

Guarantees:
- Every `evidence` entry corresponds to a memory Hindsight actually returned. Citations that do
  not are **dropped**, as are lines that assert client history while citing nothing.
- `why` is assembled from the memory's own text and source label — not generated.
- With no memory, `memoryUsed` is `false`, evidence is empty, and `notes` says so explicitly.
- `caveats` lists unresolved preference changes affecting this project.

Errors: `400` · `404` (including a project belonging to another client) ·
**`503 MEMORY_UNAVAILABLE` — the request fails; it does not silently answer without memory** ·
`503 LLM_UNAVAILABLE`.

### `GET /api/agent/recommendations/:id`
Rehydrates a stored recommendation from its evidence snapshot without re-running the LLM.

### `POST /api/agent/recommendations/:id/feedback`
`{ "verdict": "accepted" | "rejected" | "corrected", "comment": "…" }` — `comment` required for
`corrected`. Retains an outcome memory, closing the learning loop.
`200 { feedbackId, retained, warnings }`. If the outcome cannot be stored, it is reported in
`warnings` rather than claimed as learned.

---

## Conflicts

### `GET /api/conflicts/:conflictId`

### `POST /api/conflicts/:conflictId/resolve` ⭐⭐

```json
{ "resolution": "new_preference", "scope": "project" }
```

`resolution` ∈ `new_preference | keep_existing | dismissed`. `scope` is **required** for
`new_preference`, one of `interaction | project | client | future`.

| Scope | Hindsight operations | Old memory |
|---|---|---|
| `interaction` | retain at interaction scope | untouched |
| `project` | retain + `createDirective` tagged `project:…` | marked superseded, **stays valid** |
| `client` / `future` | retain at client scope + `createDirective` tagged `client:…` | **invalidated** (removed from recall, kept auditable) |

`200`:
```json
{ "conflictId": "…", "status": "resolved", "resolvedScope": "project",
  "newMemory": { "memoryRefId": "…", "hindsightMemoryId": "…", "statement": "…", "scope": "project" },
  "supersededMemory": { "memoryRefId": "…", "statement": "…", "state": "superseded" },
  "directive": { "id": "…", "scope": "project" }, "warnings": [] }
```

Nothing is deleted in any branch. Resolution is atomic — a concurrent double-submit yields
exactly one memory write; the loser receives `409`.

---

## Demo

### `GET /api/demo/state` → `{ stage, demoRequest }`

### `POST /api/demo/reset` · `POST /api/demo/stage`
Header `x-demo-token` required. Body `{ "stage": "empty" | "history" | "post_conflict" }`.

Truncates application tables, deletes and recreates the Hindsight banks, reseeds through the
normal retain path. This is what makes the demo repeatable without duplicate-memory pollution.

`200 { stage, clientId, projectId, clientSlug, projectSlug, interactionsSeeded, memoriesRetained, bankId, warnings }`

---

## Which screen uses what

| Screen | Endpoints |
|---|---|
| App shell (memory badge) | `GET /health/hindsight` |
| Dashboard | `GET /clients` |
| Client Workspace | `GET /clients/:id` · `GET /projects/:id` · `GET|POST /projects/:id/interactions` · `GET /projects/:id/conflicts` |
| AI Workspace | `POST /agent/recommend` · `GET /agent/recommendations/:id` · `POST /agent/recommendations/:id/feedback` · `POST /conflicts/:id/resolve` |
| Memory Timeline | `GET /projects/:id/memory` · `GET /clients/:id/memory` |

Route handlers live in `backend/src/routes/index.ts`; the frontend calls them only through
`frontend/src/services/clientos.ts`, so no component issues a raw `fetch`.

## Principles

- Inputs validated with zod at the route boundary; all SQL uses bound parameters.
- Credentials live server-side only; the frontend holds nothing but an API base URL.
- Error messages are written for end users and never imply memory was used when it was not.
- Hindsight is the memory system. PostgreSQL stores metadata and a display cache, and is never
  consulted for memory content during reasoning.
