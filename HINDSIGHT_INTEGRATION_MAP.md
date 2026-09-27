# ClientOS — Hindsight Integration Map

**Status:** design document. **No Hindsight integration exists in the repository today** (see `CURRENT_PROJECT_AUDIT.md` §6).

---

## 0. Provenance of the facts in this document

Every endpoint, SDK method, field name, and response shape below was verified against one of:

1. **Hindsight Cloud documentation** — `https://docs.hindsight.vectorize.io/` (pages: `/api-integration`, `/retain`, `/recall`, `/reflect`, `/memory-banks`, `/curl-examples`, `/api-keys`, `/api-reference/hindsight-cloud-api`).
2. **Hindsight developer API documentation** — `https://hindsight.vectorize.io/developer/api/*` (pages: `retain`, `recall`, `memories`, `memory-banks`).
3. **The published TypeScript SDK's own type declarations** — `@vectorize-io/hindsight-client@0.10.1`, `dist/index.d.ts` (11,878 lines), downloaded from the npm registry and read directly.

Source (3) is treated as the highest authority for request/response shapes, because it is generated from the API and is more complete than the prose docs. Two places where it materially corrects the prose docs are flagged inline as **[SDK corrects docs]**.

Nothing in this document is inferred or invented. Where something could not be verified it is marked **[TO VERIFY]**.

---

## 1. Hindsight Instance

| Property | Value |
|----------|-------|
| Product | Hindsight™ by Vectorize — agent memory system (Retain / Recall / Reflect) |
| Cloud base URL | `https://api.hindsight.vectorize.io` |
| Path convention | `/v1/{tenant_id}/banks/{bank_id}/...`, default tenant `default` → `/v1/default/banks/{bank_id}/...` |
| Authentication | `Authorization: Bearer <api-key>`; Cloud keys are prefixed `hsk_` |
| Key provisioning | Hindsight Cloud UI → Organization → API Keys. Expiry 1 hour – 1 year. Bank-scoped keys supported. |
| SDK (chosen) | `@vectorize-io/hindsight-client` — latest `0.10.1`, MIT, zero runtime dependencies |
| Config source in ClientOS | backend-only env vars `HINDSIGHT_BASE_URL`, `HINDSIGHT_API_KEY` (see §6) |
| **Current connection status** | **NOT CONNECTED.** No key, no SDK dependency, no client, no call site exists. |

### 1.1 Credentials required (not currently present)

Nothing is invented here — these are the two values the SDK constructor requires:

| Variable | Required | Value | How obtained |
|----------|----------|-------|--------------|
| `HINDSIGHT_API_KEY` | **yes** | a `hsk_…` key | Hindsight Cloud → Organization → API Keys → Create API Key |
| `HINDSIGHT_BASE_URL` | **yes** | `https://api.hindsight.vectorize.io` for Cloud | fixed for Cloud; differs for self-hosted |
| `HINDSIGHT_TENANT_ID` | no | `default` | only needed if the account uses a non-default tenant **[TO VERIFY — whether the hackathon's Hindsight accounts use a non-default tenant]** |

The SDK reads **no environment variables of its own** — the constructor takes explicit values. The names `HINDSIGHT_API_KEY` / `HINDSIGHT_BASE_URL` are **our project's convention** (already used in `SETUP.md` §4), not an SDK requirement. The Hindsight docs deliberately name no variable, advising only "use environment variables or secret managers."

> **Blocker:** until a `hsk_` key exists, none of P0 can be integration-tested. Obtaining it is Phase 0, step 1.

### 1.2 Client construction

```ts
// backend/src/hindsight/client.ts
import { HindsightClient } from '@vectorize-io/hindsight-client';

export const hindsight = new HindsightClient({
  baseUrl: process.env.HINDSIGHT_BASE_URL!,   // https://api.hindsight.vectorize.io
  apiKey:  process.env.HINDSIGHT_API_KEY!,    // hsk_...
  maxAttempts: 3,                             // retries 429/503 only; writes are never retried
});
```

Verified constructor surface (`HindsightClientOptions`): `baseUrl` (required), `apiKey`, `userAgent`, `headers`, `maxAttempts`.

`maxAttempts` behaviour, quoted from the SDK typings: retries when the service is at capacity (429/503), honours `Retry-After`, jittered — and **"writes are never retried."** This is load-bearing for ClientOS: a failed `retain` will not be silently duplicated, but it also will not be silently retried, so retain failures must be surfaced and made re-runnable. Handled in §4.1.

Errors surface as `HindsightError extends Error` with `statusCode?: number` and `details?: unknown`.

---

## 2. Available Operations

**Only operations verified to exist are listed.** ClientOS uses a deliberately small subset; the rest of the API (knowledge pages, documents, bank transfer/clone, webhooks, audit, memory defense, scoped keys) is real but out of scope.

### 2.1 Connection check — `getVersion`

| | |
|---|---|
| Purpose | verify credentials and reachability; read deployment feature flags |
| SDK | `hindsight.getVersion()` |
| Returns | `VersionResponse` |
| Errors | `HindsightError` with `statusCode` 401 (bad key) / network error (bad URL) |
| **ClientOS use** | `GET /api/health/hindsight`. Powers the connection badge in the UI. Satisfies `SETUP.md` §5 ("verify the connection before the demo") and `ARCHITECTURE.md` §7 (never pretend memory was used). |

### 2.2 Retain — store memories

| | |
|---|---|
| Purpose | persist client decisions as durable memory; Hindsight extracts facts, entities and temporal data rather than storing text verbatim |
| HTTP | `POST /v1/default/banks/{bank_id}/memories` |
| SDK | `retain(bankId, content, options?)` · `retainBatch(bankId, items, options?)` |
| Response | `{ success, bank_id, items_count, async, operation_id?, operation_ids?, usage? }` |
| Errors | `HindsightError`; **not auto-retried** (write) |
| **ClientOS use** | seeding the demo dataset; every confirmed durable memory; recommendation outcomes |

Verified `retain` options (camelCase in SDK): `timestamp`, `context`, `metadata` (`Record<string,string>`), `documentId`, `async`, `operationId`, `entities`, `resolveEntities`, **`tags`**, `updateMode` (`'replace' | 'append'`), `observationScopes`, `strategy`.

Verified `retainBatch` item shape (`MemoryItemInput`, snake_case): `content`, `timestamp`, `context`, `metadata`, `document_id`, `entities`, `resolve_entities`, **`tags`**, `observation_scopes`, `strategy`, `update_mode`. Batch-level options: `documentId`, `documentTags`, `async`, `operationId`.

**[SDK corrects docs]** The Cloud prose docs' retain page lists only `content`/`context`/`timestamp`/`metadata`/`async`. The SDK and the developer docs confirm **`tags`** is a first-class retain field. This matters enormously — see §3.

Bank creation is implicit: per the developer docs, **"Banks are created automatically on first write operation."** Reading a nonexistent bank returns `404` rather than an empty result. ClientOS still calls `createBank` explicitly (§2.6) to set the mission and disposition.

### 2.3 Recall — retrieve memories

| | |
|---|---|
| Purpose | retrieve memories relevant to a query, for use as evidence and LLM context |
| HTTP | `POST /v1/default/banks/{bank_id}/memories/recall` |
| SDK | `recall(bankId, query, options?)` |
| Retrieval | four parallel strategies (TEMPR): semantic, keyword (BM25), graph (entity traversal), temporal |
| **ClientOS use** | **the core read path** — every recommendation, the memory timeline, and conflict detection |

Verified options: `types` (`'world' | 'experience' | 'observation'`), `preferObservations`, `maxTokens` (default 4096), `budget` (`'low' | 'mid' | 'high'`), `trace`, `queryTimestamp`, `includeEntities`, `maxEntityTokens`, `includeChunks`, `maxChunkTokens`, `includeSourceFacts`, `maxSourceFactsTokens`, **`tags`**, **`tagsMatch`**, **`tagGroups`**, `minScores`, `temporalWindow`.

Verified `RecallResult` — this is the exact shape the Why/evidence UI renders:

```ts
{ id, text, type?, entities?, context?, occurred_start?, occurred_end?,
  mentioned_at?, document_id?, metadata?, chunk_id?, tags?,
  source_fact_ids?, scores?, attachments? }
```

`scores` carries `final`, `reranker`, `semantic`, `keyword`. The developer docs warn these are **relative within one query, not absolute confidence** — so ClientOS must not render them as a confidence percentage. Results are ordered by `final` descending.

Two behavioural notes that shape the design:

- **`temporalWindow` ranks, it does not filter.** Quoting the SDK: it "Ranks memories dated inside the window higher; it does NOT drop memories dated outside it, so it is not a way to restrict results to a period." Timeline filtering must therefore use `listMemories` (§2.5), not recall.
- **`tagsMatch: 'any'` is the default and *includes untagged memories*.** Since ClientOS tags every memory it writes, the `_strict` variants are required for true scope isolation. See §3.3.

### 2.4 Reflect — reason over memories

| | |
|---|---|
| Purpose | agentic reasoning over retrieved memories, guided by the bank's mission, directives and disposition |
| HTTP | `POST /v1/default/banks/{bank_id}/reflect` |
| SDK | `reflect(bankId, query, options?)` |
| Response | `{ text, based_on?, structured_output?, structured_output_error?, usage?, trace? }` |
| **ClientOS use** | **P1** — the "Client Standing Brief" panel. Not the primary recommendation path (§5) |

Verified options: `context`, `budget`, **`tags`**, **`tagsMatch`**, **`tagGroups`**, **`applyAllDirectives`**, **`responseSchema`** (JSON Schema → `structured_output`), `factTypes`, `excludeMentalModels`, `excludeMentalModelIds`, `reflectSearchObservationsMaxTokens`, `reflectSearchObservationsIncludeEntities`, **`includeFacts`** (populates `based_on`), `includeToolCalls`, `includeToolCallOutput`.

Verified evidence shape:

```ts
based_on: { memories?: ReflectFact[], mental_models?: ReflectMentalModel[], directives?: ReflectDirective[] }
ReflectFact      = { id?, text, type?, context?, occurred_start?, occurred_end? }
ReflectDirective = { id, name, content }
```

**[SDK corrects docs]** The Cloud prose docs describe `reflect` as accepting only `query`/`context`/`budget`/`max_tokens`/`response_schema`. The SDK confirms tag scoping, directive control, and `includeFacts` are all available. Also note: `based_on` is populated **only when `includeFacts: true`** — the docs' example shows `"based_on": []` without explaining why.

An important nuance for how ClientOS uses directives: by default **directives are tag-scoped exactly like memories** — untagged directives always apply, tagged ones apply only when the request's tags match. `applyAllDirectives: true` overrides this. This is the mechanism that makes project-scoped preference changes work (§4.3).

### 2.5 Memory listing and curation

| Operation | HTTP | SDK | ClientOS use |
|---|---|---|---|
| List / filter memories | `GET /v1/default/banks/{bank}/memories/list` | `listMemories(bankId, options?)` | **Memory Timeline** — chronological, filterable, paginated |
| Get one memory | `GET /v1/default/banks/{bank}/memories/{id}` | *(generated fn)* | deep-link a single evidence item |
| Observation history | `GET /v1/default/banks/{bank}/memories/{id}/history` | *(generated fn)* | P2 |
| **Curate: edit / invalidate / restore** | `PATCH /v1/default/banks/{bank}/memories/{id}` | **`updateMemory` (generated fn, not on `HindsightClient`)** | **superseding an outdated preference** (§4.3) |

Verified `listMemories` options: `limit`, `offset`, `type`, `q`, `consolidationState`, `state` (`'valid' | 'invalidated'`), `documentId`, `entityId`, `timeField` (`created_at` / `updated_at` / `mentioned_at` / `occurred_start` / `occurred_end`), `startDate`, `endDate`.

Verified `UpdateMemoryRequest` fields: `text`, `context`, `occurred_start`, `occurred_end`, `fact_type`, `entities`, **`state`** (`'invalidated' | 'valid'`), **`reason'`** (free text).

**The invalidation model is exactly what ClientOS needs**, quoting the developer docs: an invalidated memory *"disappears from recall, consolidation, and the knowledge graph"* while remaining *"auditable and restorable"* — reversible, and *"kept for audit."* This satisfies `docs/PRODUCT_DECISIONS.md` Decision 3 (preserve historical decisions) **without** deleting anything: the superseded preference stops influencing recommendations but remains visible on the timeline.

Constraint: **only `world` and `experience` facts can be curated; `observation` facts are derived** and cannot be directly invalidated.

> **Integration note:** `updateMemory` and `listBanks` are **not** methods on `HindsightClient`. They are exported generated SDK functions. ClientOS wraps them in `backend/src/hindsight/curate.ts` so call sites stay uniform.

### 2.6 Bank configuration

| Operation | SDK | ClientOS use |
|---|---|---|
| Create / update bank | `createBank(bankId, options?)` | one-time setup per client bank |
| Get config | `getBankConfig(bankId)` | health/diagnostics |
| Update config | `updateBankConfig(bankId, options)` | tune extraction after first seed run |
| Delete bank | `deleteBank(bankId)` | demo reset **(destructive — token-guarded)** |
| List banks | `listBanks` (generated fn) | diagnostics |

Relevant `createBank` options, verified: `reflectMission`, `retainMission`, `retainExtractionMode` (`'concise'` default / `'verbose'` / `'custom'` / `'verbatim'` / `'chunks'`), `retainCustomInstructions`, `retainChunkSize`, `enableObservations`, `observationsMission`, `enableTextSearch`, `enableTemporalRetrieval`, `enableGraphRetrieval`, `enableReranking`, plus disposition traits (scale 1–5) `dispositionSkepticism` / `dispositionLiteralism` / `dispositionEmpathy`.

⚠️ **Deprecations to avoid** (all flagged `@deprecated` in the SDK typings): `name`, `mission`, `background`, `disposition` object, and the three `disposition*` args on `createBank` — use `updateBankConfig` for disposition. **`getBankProfile` is removed server-side and answers HTTP 410** — use `getBankConfig`. The Cloud prose docs and the TypeScript SDK guide both still show `getBankProfile` and `background`; following them would break. Use `reflectMission` + `getBankConfig`.

### 2.7 Directives

| Operation | SDK |
|---|---|
| Create | `createDirective(bankId, name, content, { priority?, isActive?, tags? })` |
| List / get / update / delete | `listDirectives` · `getDirective` · `updateDirective` · `deleteDirective` |

Directives are **hard rules applied during `reflect`**, tag-scoped by default, with a `priority`. The developer docs contrast them with disposition: directives are hard rules (compliance, guardrails); disposition softly influences reasoning style.

**ClientOS use:** a confirmed preference change is written as a tag-scoped directive, so it binds at the exact scope the user chose (§4.3).

### 2.8 Mental models — P1

`createMentalModel(bankId, name, sourceQuery, options?)`, plus list/get/refresh/dryRunRefresh/clear/update/delete/history.

Pre-computed reflections that auto-refresh on `refreshAfterConsolidation` or a `refreshCron`. Trigger options include `tagsMatch` and `tagGroups`.

**ClientOS use (P1):** one mental model per project — *"Vive Studio — Standing Design Preferences"* — that refreshes as new memories consolidate. This is the cleanest demonstration of Hindsight's **Reflect** pillar.

Two documented costs to respect: a model rebuilds **at most once a minute**, and `refresh_after_consolidation` refreshes are **billable (~$0.05 per model refresh)**. During an 8-hour build with repeated demo reseeding this can add up, so ClientOS seeds with `async: false` and creates mental models **after** seeding completes, not before.

### 2.9 Operations not used by ClientOS

Real, verified to exist, deliberately out of scope: Knowledge Base (tree/folders/pages/search/export), Documents (list/get/update/delete/export), Bank Transfer (export/import/clone), Entities listing, Webhooks & SIEM, Audit logs, LLM traces, Scoped API keys, Memory Defense, Privacy events, `retainFiles`.

Excluded per `MASTER_SPEC` §24 and the project rule against unnecessary integrations. `deleteBank` + re-seed covers demo reset more simply than bank transfer.

---

## 3. ClientOS Memory Mapping

### 3.1 Bank strategy — one bank per client

**Decision: one Hindsight bank per client, `bank_id = client-{slug}`.** For the demo: `client-vive-studio`.

This is the most consequential Hindsight decision in the project, and the documentation never made it (`CURRENT_PROJECT_AUDIT.md` §8.4). Reasoning:

- Banks are **completely isolated** — "data stored in one is invisible to another." So bank granularity fixes the outer boundary of what can ever be recalled together.
- ClientOS requires a **`client` scope and a `future projects` scope** (`MASTER_SPEC` §10). Both demand recall *across projects for one client*. A per-project bank makes that structurally impossible.
- A per-client bank keeps the client's decision history as one accumulating body of experience, which is precisely the product thesis.
- Cross-client leakage is prevented by the strongest isolation Hindsight offers, which is the right default for client confidentiality.
- Project separation is a *filter*, not an isolation boundary — and Hindsight provides exactly that via tags.

Rejected alternatives: **one bank per project** (breaks client/future-project scope, and splits a client's history); **one global bank** (client data would co-mingle — unacceptable); **one bank per client+project pair** (same defect as per-project, plus bank sprawl).

Bank setup for the demo client:

```ts
await hindsight.createBank('client-vive-studio', {
  retainMission:
    'Extract durable client decisions about design and web projects: explicit preferences, ' +
    'approvals, rejections, constraints, decisions and outcomes. Record what was decided and ' +
    'which interaction it came from. Ignore greetings, scheduling and casual conversation.',
  reflectMission:
    'You hold the decision history for the client Vive Studio. Answer only from retained ' +
    'memory about what this client has approved, rejected, preferred or constrained. ' +
    'If memory does not cover something, say so rather than guessing.',
  enableObservations: true,
  observationsMission:
    'Consolidate repeated client signals into durable standing preferences, noting when a ' +
    'preference supersedes an earlier one.',
});
```

Both missions directly encode `MASTER_SPEC` §9 (memory rules) and §19 ("The agent must not hallucinate client history. If no memory exists, it must say that").

### 3.2 Tag vocabulary — how scope is physically represented

`MASTER_SPEC` §10 names five scopes with no storage mechanism. **Hindsight tags are that mechanism**, and they are a genuine feature: per the developer docs, tags *"control visibility scoping during recall — memories only return if tags intersect with recall filters."*

Fixed, namespaced vocabulary. Every memory ClientOS writes carries a `client:`, `project:`, `type:` and `scope:` tag, plus a `source:` tag where an interaction exists.

| Tag | Values | Meaning |
|---|---|---|
| `client:{slug}` | `client:vive-studio` | owning client (redundant within a per-client bank, but makes exports and any future re-banking safe) |
| `project:{slug}` | `project:premium-website-redesign` | owning project |
| `type:{kind}` | `preference` · `approval` · `rejection` · `constraint` · `decision` · `outcome` | ClientOS memory category (`MASTER_SPEC` §8) |
| `scope:{level}` | `interaction` · `revision` · `project` · `client` · `future` | durability scope (`MASTER_SPEC` §10) |
| `source:{label}` | `source:revision-3` | originating interaction — **this is what makes evidence citations exact** |
| `status:superseded` | — | applied when a memory has been superseded but deliberately left valid (project-scoped override case, §4.3) |

`source:` is what turns a recalled memory into the citation *"Heavy animation was rejected during Revision #3."* Slugs must match the interaction labels in `docs/DEMO_DATA.md` exactly, or evidence strings will be wrong.

Note `metadata` (`Record<string,string>`) is also carried on every retain — it round-trips through recall and is *"included in the fact extraction prompt."* But per the developer docs there is **no server-side metadata filtering** — only tag filtering. So **scope lives in tags, not metadata.** Metadata carries display-only detail (interaction id, occurred date, project name).

### 3.3 Scope → recall filter

Because `tagsMatch: 'any'` (the default) *includes untagged memories*, ClientOS uses `tagGroups` with `_strict` matching for real isolation.

Standard project-context recall — *"memories for this project, plus client-wide and future-scope memories, but not other projects' memories"*:

```ts
await hindsight.recall(bankId, query, {
  budget: 'mid',
  types: ['world', 'experience', 'observation'],
  preferObservations: true,
  includeEntities: true,
  maxTokens: 3000,
  tagGroups: [{
    or: [
      { tags: ['project:premium-website-redesign'], match: 'any_strict' },
      { tags: ['scope:client'],                     match: 'any_strict' },
      { tags: ['scope:future'],                     match: 'any_strict' },
    ],
  }],
});
```

`preferObservations: true` makes consolidated observations supersede the raw facts they were built from, avoiding duplicate content in the LLM context — verified SDK behaviour.

### 3.4 ClientOS concept → Hindsight mapping

| ClientOS concept | Hindsight representation | Mechanism |
|---|---|---|
| **Client** | **one bank** — `client-{slug}` | strongest isolation boundary; `createBank` |
| **Project** | **tag** — `project:{slug}` | filter within the client's bank, via `tagGroups` |
| **Interaction** | **one `retain` call → a document** | `documentId = interaction:{uuid}`, `context` = the interaction label, `timestamp` = when it occurred. Hindsight classifies it as an `experience`. |
| **Preference** | durable memory, `type:preference` | `retain` with `scope:` tag from user-confirmed scope |
| **Rejection** | durable memory, `type:rejection` | as above — the highest-value category for the demo |
| **Approval** | durable memory, `type:approval` | as above |
| **Decision** | durable memory, `type:decision` | as above |
| **Constraint** | durable memory, `type:constraint` + **directive** for hard rules | `createDirective(..., { tags })` when it must bind absolutely |
| **Outcome** | learning memory, `type:outcome` | retained after the user accepts/corrects a recommendation — this closes the learning loop |
| **Preference change** | **new memory + tag-scoped directive + (conditionally) invalidation of the old memory** | see §4.3 — the mechanism differs by chosen scope |
| **Evidence / "Why"** | `RecallResult.tags['source:*']` + `text` + `mentioned_at`; or `reflect`'s `based_on` | never synthesised by the LLM |
| **Consolidated standing preference** | `observation` fact type | produced by Hindsight's auto-consolidation |
| **Standing client brief** (P1) | **mental model** | `createMentalModel` with `refreshAfterConsolidation` |

Hindsight's four native types (`world`, `experience`, `observation`, `mental_model`) and ClientOS's six categories are **orthogonal**: Hindsight decides the native type during extraction; ClientOS asserts its category via `type:` tags. They are not forced onto each other.

### 3.5 Hindsight remains the memory system

To be explicit, because the brief calls for it: PostgreSQL stores **no memory content as a source of truth**. It stores identifiers, labels, timestamps and UI state, and a *cache* of memory text for fast timeline rendering — always with `hindsight_memory_id` as the authority. Recommendations read memory **only** from Hindsight recall. If Hindsight is unreachable, ClientOS reports that and declines to claim memory was used (`ARCHITECTURE.md` §7). Full split in `DATA_MODEL.md`.

---

## 4. Where ClientOS Uses Each Operation

### 4.1 Retain path

Triggered by: demo seeding, a new interaction whose extracted memory needs no confirmation, a confirmed conflict resolution, and recommendation feedback.

```ts
await hindsight.retain(bankId, statement, {
  context: 'Revision #3 — Design Review',
  timestamp: interaction.occurredAt,
  documentId: `interaction:${interaction.id}`,
  tags: [
    'client:vive-studio',
    'project:premium-website-redesign',
    'type:rejection',
    'scope:project',
    'source:revision-3',
  ],
  metadata: { interactionId: interaction.id, projectName: 'Premium Website Redesign' },
  async: false,
});
```

`async: false` is deliberate: the UI must be able to say truthfully that the memory was stored before the next recall runs. Because **writes are never auto-retried** (§1.2), retain failures are recorded in PostgreSQL as `interactions.retain_status = 'failed'` and are re-runnable from the UI — never silently swallowed.

Seeding uses `retainBatch` with `documentTags`, one item per interaction, so the eight demo interactions land in one call.

### 4.2 Recall path

Triggered by: every recommendation, the memory timeline, and conflict detection. Filter as §3.3.

- **Recommendation:** `budget: 'mid'`, `preferObservations: true` → results become LLM context *and* the evidence list.
- **Conflict detection:** a targeted recall per extracted candidate, `types: ['world', 'observation']`, query = the candidate statement.
- **Timeline:** `listMemories` (not recall) — chronological order and true date filtering, which recall's `temporalWindow` cannot provide (§2.3).

### 4.3 Preference change — the three scope branches

When the user confirms a detected conflict, the chosen scope determines the Hindsight operations. This is the heart of the feature and each branch uses only verified operations.

**Branch A — "This project" (the demo choice):** the old client-wide preference stays true in general; it is only overridden here.
1. `retain` the new preference with `scope:project`, `project:{slug}`, `type:preference`.
2. `createDirective(bankId, 'brighter-accents-premium-redesign', '<rule text>', { tags: ['project:premium-website-redesign'], priority: 10 })` — binds *only* when recall/reflect is scoped to this project.
3. Tag the old memory `status:superseded` but **leave it `valid`** — it must still apply to the client's other projects.
4. Record the supersession edge in PostgreSQL (`memory_links`) for the timeline.

**Branch B — "All future projects" / client-wide:**
1. `retain` the new preference with `scope:client`.
2. `createDirective` with `tags: ['client:vive-studio']`.
3. **`updateMemory`** on the old memory: `{ state: 'invalidated', reason: 'Superseded by confirmed preference change on <date> (interaction <label>)' }` — it stops influencing recall everywhere, but stays auditable and restorable.
4. Record the supersession edge.

**Branch C — "This design direction only":**
1. `retain` with `scope:interaction`. No directive, no invalidation — a one-off exception.

This directly implements `docs/PRODUCT_DECISIONS.md` Decision 4 and the `MASTER_SPEC` §2 restriction *"do not turn one historical exception into a permanent universal rule"*: the narrowest branch is a plain memory, and only an explicit client-wide confirmation invalidates prior memory.

### 4.4 Reflect path — P1

`reflect(bankId, 'Summarise this client's standing design preferences and what they have rejected.', { tags: [...], tagsMatch: 'any_strict', includeFacts: true, responseSchema: {...} })` → "Client Standing Brief" panel, with `based_on.memories` and `based_on.directives` rendered as its sources. Not on the critical demo path.

---

## 5. Recommendation generation: recall + Groq, not reflect

A real choice exists here, so it is stated rather than assumed.

Hindsight's `reflect` could generate recommendations directly — with `responseSchema` for structure and `includeFacts` for evidence, in a single call. **ClientOS instead uses `recall` for retrieval and Groq for synthesis.** Reasons:

1. **The locked stack requires Groq** (`MASTER_SPEC` §12); `reflect` uses Hindsight's own server-side LLM.
2. **Exact citation mapping.** With recall, the backend holds every `RecallResult` — id, text, tags, `source:` label — and can bind each recommendation bullet to a specific memory id. `reflect`'s `based_on` is a flat list for the whole answer, so per-bullet "Why?" would be approximate. `MASTER_SPEC` §18 wants per-recommendation evidence.
3. **Prompt control** over the "never invent client history" constraint, which is the project's hardest safety requirement.
4. **Cost and latency** — recall is cheaper and faster than an agentic reflect loop.

`reflect` is still used, for the P1 standing-brief panel and mental models, so all three Hindsight pillars — Retain, Recall, Reflect — are genuinely exercised rather than name-dropped.

---

## 6. Configuration and Security

Backend-only variables (names only — no values in any document, and `.env` must be gitignored before the first commit):

| Variable | Purpose |
|---|---|
| `HINDSIGHT_BASE_URL` | `https://api.hindsight.vectorize.io` |
| `HINDSIGHT_API_KEY` | `hsk_…` — **backend only, never exposed to the frontend** |
| `HINDSIGHT_TENANT_ID` | optional; defaults to `default` |

All Hindsight calls originate in `backend/src/hindsight/*`. The frontend never holds a Hindsight key and never calls `api.hindsight.vectorize.io` — it talks only to the ClientOS backend. This satisfies `MASTER_SPEC` §23 and `ARCHITECTURE.md` §8.

A bank-scoped key is preferable to an org-wide key for the demo, since Hindsight supports bank-scoped keys (§1).

---

## 7. Failure Behaviour

Per `ARCHITECTURE.md` §7, the rule is absolute: **never claim memory was used if Hindsight failed.**

| Failure | Detection | ClientOS behaviour |
|---|---|---|
| Bad/expired key | `HindsightError` 401 | health endpoint reports disconnected; UI shows a red memory badge; recommendation requests are refused with an explicit reason |
| Unreachable base URL | network error | as above |
| Bank does not exist | **404 on read** (documented: banks are not auto-created on read) | treat as "no memory yet"; seed or create the bank; never report a bank as empty when it is actually missing |
| Recall returns zero results | `results.length === 0` | the agent must say no relevant memory exists — **it may not invent history** (`MASTER_SPEC` §19) |
| Retain fails | non-2xx; **not auto-retried** | persist `retain_status='failed'`; surface a retry action; the interaction row still exists |
| 429 / 503 | SDK retries up to `maxAttempts`, honouring `Retry-After` | transparent for reads; for writes the SDK does **not** retry, so the failure path above applies |
| Reflect `structured_output_error` | field present on `ReflectResponse` | fall back to rendering `text`; never silently drop the answer |
| Slow consolidation | observations appear late | seed with `async: false`; create mental models only after seeding finishes |

---

## 8. Verified Endpoint Reference

Quick reference for everything ClientOS touches. Base `https://api.hindsight.vectorize.io`, header `Authorization: Bearer hsk_…`.

| Method | Path | Operation | SDK |
|---|---|---|---|
| GET | `/v1/default/banks` | list banks | `listBanks` (generated) |
| GET | `/v1/default/banks/{bank}` | get bank | `getBankConfig` |
| POST | `/v1/default/banks/{bank}/memories` | **retain** | `retain` / `retainBatch` |
| POST | `/v1/default/banks/{bank}/memories/recall` | **recall** | `recall` |
| POST | `/v1/default/banks/{bank}/reflect` | **reflect** | `reflect` |
| GET | `/v1/default/banks/{bank}/memories/list` | list memories | `listMemories` |
| GET | `/v1/default/banks/{bank}/memories/{id}` | get memory | *(generated)* |
| PATCH | `/v1/default/banks/{bank}/memories/{id}` | **curate / invalidate** | `updateMemory` (generated) |
| POST | `/v1/default/banks/{bank}/mental-models` | create mental model | `createMentalModel` |
| GET | `/v1/default/banks/{bank}/mental-models` | list | `listMentalModels` |
| POST | `/v1/default/banks/{bank}/mental-models/{id}/refresh` | refresh | `refreshMentalModel` |
| — | *(directives — paths not individually verified; SDK methods confirmed)* | directives CRUD | `createDirective` etc. **[TO VERIFY — exact HTTP paths]** |

Verified auth detail: Cloud API keys start with `hsk_`; the API reference describes "Bearer Auth with Hindsight API keys (starting with `hsk_`)".

---

## 9. Open Items

| # | Item | Impact |
|---|---|---|
| 1 | **No `hsk_` API key exists yet.** | **Blocks all of P0.** Phase 0 step 1. |
| 2 | Whether the hackathon account uses a non-`default` tenant | low — one env var |
| 3 | Exact HTTP paths for directive endpoints | low — SDK methods are confirmed and are what ClientOS calls |
| 4 | Real-world recall quality for the demo's eight memories | medium — needs one end-to-end test against a live bank; tune `budget` / `minScores` / `retainExtractionMode` after seeing real output |
| 5 | Hindsight Cloud credit consumption over ~8 hours of repeated reseeding | medium — mental-model refreshes are billable (~$0.05 each); create them only after seeding |
| 6 | Whether consolidated `observation` facts appear fast enough to be shown during the demo | medium — fall back to `world`/`experience` facts if not |
