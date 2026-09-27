# ClientOS — Hindsight Memory Design

> The memory layer as implemented. Every operation listed here is used by running code.

## 1. Instance

| | |
|---|---|
| Service | Hindsight Cloud (Vectorize) |
| Base URL | `https://api.hindsight.vectorize.io` |
| Auth | `Authorization: Bearer hsk_…` |
| Path shape | `/v1/{tenant}/banks/{bank_id}/…`, tenant defaults to `default` |
| SDK | `@vectorize-io/hindsight-client@0.10.1` |
| Config | `HINDSIGHT_BASE_URL`, `HINDSIGHT_API_KEY`, `HINDSIGHT_TENANT_ID` — backend only |

There is **no local memory implementation anywhere in this codebase.** If Hindsight is
unavailable, ClientOS reports that and refuses to answer from history.

## 2. Bank strategy — one bank per client

`bank_id = client-{slug}` (e.g. `client-vive-studio`).

Banks are completely isolated — data in one is invisible to another — which is the strongest
guarantee available for client confidentiality, and it is what makes cross-client leakage
structurally impossible rather than a matter of query discipline.

Per-project banks were rejected: ClientOS needs `client` and `future` scopes, which require
recalling across a client's projects. Project separation is therefore a **filter**, not an
isolation boundary.

Banks are created with missions that steer extraction and reasoning:

```ts
createBank(bankId, {
  retainMission:  'Extract durable client decisions … ignore greetings, scheduling, casual conversation.',
  reflectMission: 'You hold the decision history for "<client>" … if memory does not cover something, say so.',
  observationsMission: 'Consolidate repeated client signals into durable standing preferences …',
  enableObservations: true,
})
```

Deprecated SDK options (`name`, `mission`, `background`, `disposition`, `getBankProfile` —
which answers HTTP 410) are deliberately avoided.

## 3. Tags are how scope is represented

Per the Hindsight docs, memories only return if their tags intersect the recall filter. That
makes tags the real mechanism behind ClientOS's scope model.

| Tag | Values |
|---|---|
| `client:{slug}` | owning client |
| `project:{slug}` | owning project — omitted for client/future scope so those apply everywhere |
| `type:{kind}` | `preference` · `approval` · `rejection` · `decision` · `constraint` · `outcome` · `preference_change` |
| `scope:{level}` | `interaction` · `revision` · `project` · `client` · `future` |
| `source:{slug}` | originating interaction, e.g. `source:revision-3` — **this produces the evidence citation** |
| `status:superseded` | applied when a memory is overridden but deliberately left valid |

### Recall filter

```ts
tagGroups: [{ or: [
  { tags: [`project:${projectSlug}`], match: 'any_strict' },
  { tags: ['scope:client'],           match: 'any_strict' },
  { tags: ['scope:future'],           match: 'any_strict' },
]}]
```

`any_strict` is mandatory. The SDK default (`any`) *also returns untagged memories*, which
would let unrelated memory cross a project boundary.

## 4. Operations used

| Operation | SDK call | Where |
|---|---|---|
| Connection probe | `sdk.listBanks` (authenticated) | `GET /api/health/hindsight` |
| Create/update bank | `createBank` | client creation, demo reset |
| **Retain** | `retain` (`async: false`) | every confirmed durable memory |
| Batch retain | `retainBatch` | reserved for bulk seeding |
| **Recall** | `recall` with `tagGroups`, `preferObservations` | every recommendation, conflict check |
| List / reconcile | `listMemories({ documentId })` | resolving real memory ids |
| **Curate** | `sdk.updateMemory` → `state: 'invalidated'` | client-wide preference change |
| **Directives** | `createDirective` with tags | scoped preference changes |
| Reflect | `reflect` with `includeFacts` | standing-brief module (not on the demo path) |
| Delete bank | `deleteBank` | demo reset only |

`sdk.updateMemory` and `sdk.listBanks` are generated functions reached through our own
`createClient`, because `HindsightClient` does not expose them and keeps its transport private.

### 4.1 Verified HTTP reference

The SDK is what ClientOS calls; these are the endpoints behind it. Base
`https://api.hindsight.vectorize.io`, header `Authorization: Bearer hsk_…`.

| Method | Path | Operation |
|---|---|---|
| GET | `/v1/default/banks` | list banks (used as the authenticated health probe) |
| GET | `/v1/default/banks/{bank}` | bank config |
| POST | `/v1/default/banks/{bank}/memories` | **retain** |
| POST | `/v1/default/banks/{bank}/memories/recall` | **recall** |
| POST | `/v1/default/banks/{bank}/reflect` | **reflect** |
| GET | `/v1/default/banks/{bank}/memories/list` | list memories |
| GET | `/v1/default/banks/{bank}/memories/{id}` | get one memory |
| PATCH | `/v1/default/banks/{bank}/memories/{id}` | **curate / invalidate** |

### 4.2 Why recall + Groq, and not reflect, for recommendations

`reflect` could produce recommendations directly, with `responseSchema` for structure and
`includeFacts` for sources, in a single call. ClientOS deliberately does not use it that way:

- The stack commits to **Groq** for reasoning; `reflect` runs Hindsight's own model.
- **Citations have to be exact.** With `recall` the backend holds every result — id, text,
  tags, source label — and can bind each recommendation line to specific memories.
  `reflect`'s `based_on` is a flat list covering the whole answer, so per-line "Why?" would be
  approximate.
- **Prompt control** matters most for the hardest constraint in the system: never asserting
  client history that was not supplied.
- Recall is cheaper and faster than an agentic reflect loop.

`reflect` is still used for the standing-brief module, so Retain, Recall and Reflect are all
genuinely exercised rather than name-dropped.

## 5. Retain

```ts
retain(bankId, statement, {
  context: 'Revision #3 — revision',
  timestamp: occurredAt,
  documentId: 'interaction:<id>#<hash of statement>',
  tags: ['client:vive-studio', 'type:rejection', 'scope:project',
         'project:premium-website-redesign', 'source:revision-3'],
  metadata: { interactionId, interactionLabel, projectName },
  async: false,
})
```

Two implementation details that matter:

**One document per memory.** Retain defaults to `update_mode: 'replace'`, so two memories
sharing a `document_id` overwrite each other. Each memory therefore gets `base#<hash>`. The
hash is deterministic, so re-retaining the same statement replaces that document instead of
duplicating it — repeated submissions are idempotent rather than evidence-inflating.
*(Found during testing: 9 seeded memories were silently collapsing to 7 before this fix.)*

**Ids are reconciled after the fact.** Retain returns no memory ids — Hindsight extracts facts
rather than storing text verbatim, so one item may yield several facts or none. We resolve ids
with `listMemories({ documentId })` afterwards; with one memory per document the match is
unambiguous. `memory_refs.hindsight_memory_id` is therefore nullable by necessity.

Writes are **never auto-retried by the SDK**, so a failed retain is recorded as
`retain_status='failed'` with a user-visible retry — never silently lost.

## 6. What becomes memory

Retained: explicit preferences, approvals, rejections, decisions, constraints, meaningful
outcomes, confirmed preference changes.

Not retained: greetings, scheduling, pleasantries, vague remarks, speculation, restatements.

The gate is deterministic and runs **after** the LLM:

1. `confidence ≥ 0.6`
2. `sourceQuote` must be a **verbatim substring** of the feedback (typography-normalised)
3. statement 10–300 chars, self-contained, third person
4. not a near-duplicate of an existing statement for the project

Rule 2 is the primary anti-fabrication defence: a preference the model invented cannot quote
text that is not there. Discards are returned to the UI with reasons, so selectivity is
demonstrated rather than claimed.

## 7. Scope assignment is conservative

A claimed client-wide scope is **held for confirmation** and stored provisionally at project
scope. The asymmetry is deliberate: a memory that should have been client-wide merely
under-applies, whereas a wrongly client-wide memory silently contaminates every future project.

## 8. Preference conflicts

New feedback is checked against `world` and `observation` facts only — an `experience` ("the
client said X on date Y") cannot be contradicted, it happened.

When a contradiction is found, **nothing is written** until a human confirms the scope.

| Confirmed scope | Retain | Directive | Old memory |
|---|---|---|---|
| Temporary exception | `scope:interaction` | none | untouched |
| This project | `scope:project` | tagged `project:…` | `status:superseded`, **stays valid** |
| All future projects | `scope:client` | tagged `client:…` | **invalidated** |

Project scope does not invalidate, because the old preference is still true for the client's
other work. The tag-scoped **directive** is what makes the override bind only where confirmed —
Hindsight applies directives as hard rules, tag-scoped by default.

Client-wide scope uses Hindsight's invalidation model, which removes a memory from recall,
consolidation and the graph while keeping it auditable and restorable. Nothing is deleted in
any branch, and the supersession edge is recorded in PostgreSQL so the timeline can show it.

Because a conflict may be detected against a Hindsight-*consolidated observation* — which has
no pointer row of its own — the supersession target falls back to a statement-similarity match
against our own records, so the timeline link is not lost.

## 9. Evidence

Recall returns `id`, `text`, `tags`, `context`, `mentioned_at`, `scores`. ClientOS builds each
citation from those fields plus the `source:` tag. The "Why" line is **assembled, not
generated**, so it cannot drift from what memory says.

Hindsight's `scores` are relative within a single query, not absolute confidence, so they are
never rendered as a percentage.

## 10. Verifying it

`npm run verify:memory` exercises the real loop against live services — retain, id resolution,
recall, tag isolation, memory-aware reasoning, evidence grounding, the no-memory path, and
invalidation — in a throwaway bank that it deletes afterwards. It never simulates either
service. A passing run is the evidence that memory genuinely works.
