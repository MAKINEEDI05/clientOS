# ClientOS — Agent Implementation

**Status:** design document. **No agent, LLM client, or prompt exists today** (`CURRENT_PROJECT_AUDIT.md` §6).

---

## 1. The Pipeline

`MASTER_SPEC` §19 defines the agent workflow. Mapped to concrete modules — all of which are new files, since nothing exists:

| # | Step | Module | Hindsight / LLM |
|---|---|---|---|
| 1 | Receive request | `routes/agent.routes.ts` | — |
| 2 | Identify client | `services/clients.service.ts` → `hindsight_bank_id` | — |
| 3 | Identify project | `services/projects.service.ts` → `project:{slug}` tag | — |
| 4 | **Recall relevant memories** | `hindsight/recall.ts` | **`recall`** |
| 5 | Analyse request | `agent/recommend.ts` | — |
| 6 | Identify applicable preferences | `agent/classify.ts` | — (tag partition) |
| 7 | Identify rejected approaches | `agent/classify.ts` | — (tag partition) |
| 8 | Detect conflicts | `agent/conflict.ts` | **`recall`** + Groq |
| 9 | Generate recommendation | `agent/recommend.ts` | Groq structured output |
| 10 | Generate evidence / Why | `agent/evidence.ts` | — (deterministic binding) |
| 11 | Return response | `routes/agent.routes.ts` | — |
| 12 | User confirms / corrects | `routes/agent.routes.ts` · `conflicts.routes.ts` | — |
| 13 | **Retain new information** | `agent/extract.ts` → `hindsight/retain.ts` | **`retain`** (+ `createDirective`, `updateMemory`) |
| 14 | Future requests use updated memory | — | next `recall` |

Steps 6, 7 and 10 are **deliberately not LLM steps.** Partitioning recalled memories by their `type:` tag, and binding evidence to memory ids, are mechanical operations. Doing them in code rather than in a prompt is what makes the Why/evidence feature trustworthy: a citation can only ever point at a memory that was actually recalled.

---

## 2. Module Layout

Every file below is **new**. Nothing is modified, because nothing exists.

```
backend/src/
├── llm/
│   ├── groq.ts                  -- THE single Groq client (§3)
│   ├── schemas.ts               -- zod schemas + JSON Schemas for structured output
│   └── prompts/
│       ├── extract.prompt.ts    -- durable memory extraction (§4)
│       ├── conflict.prompt.ts   -- contradiction adjudication (§5)
│       └── recommend.prompt.ts  -- memory-aware recommendation (§6)
├── hindsight/
│   ├── client.ts                -- singleton HindsightClient
│   ├── tags.ts                  -- tag vocabulary builders
│   ├── banks.ts                 -- ensureBank, missions, disposition
│   ├── retain.ts                -- retain + id reconciliation
│   ├── recall.ts                -- scoped recall via tagGroups
│   ├── reflect.ts               -- P1 standing brief
│   ├── curate.ts                -- updateMemory / invalidate wrapper
│   └── directives.ts            -- createDirective wrapper
└── agent/
    ├── extract.ts               -- interaction text → durable candidates
    ├── conflict.ts              -- candidate → conflict or clear
    ├── classify.ts              -- recalled memories → partitioned context
    ├── recommend.ts             -- orchestration (steps 2–11)
    ├── evidence.ts              -- bind bullets to memory ids
    └── resolve.ts               -- conflict resolution branches
```

---

## 3. LLM Integration

**One provider, one client module, one place where a model id appears.** `MASTER_SPEC` §12 locks Groq. `SETUP.md` §4's provider-neutral `LLM_API_KEY`/`LLM_MODEL` names are superseded by `GROQ_API_KEY`/`GROQ_MODEL` for clarity.

`backend/src/llm/groq.ts` is the **only** module that constructs a Groq client. Every LLM call in the system goes through its two exported functions. This is stated explicitly because the brief warns against duplicate LLM integrations — the guard is architectural, not a convention.

```ts
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
export const MODEL = process.env.GROQ_MODEL!;

/** Structured JSON call — the only path used by extraction, conflict and recommendation. */
export async function completeJSON<T>(args: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> { /* response_format: { type: 'json_object' }; parse; validate; one repair retry */ }

/** Plain text call. Reserved; not on any P0 path. */
export async function completeText(args: {...}): Promise<string>;
```

### 3.1 Model choice

`MASTER_SPEC` §12 says "LLM selected from the available/recommended models" but **never selects one** (`CURRENT_PROJECT_AUDIT.md` §8.4). Groq's current production models are `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b` (plus Whisper speech models, irrelevant here).

**Recommendation: `llama-3.3-70b-versatile`** as `GROQ_MODEL`. All three ClientOS calls require reliable JSON adherence and careful instruction-following — especially "never state client history that is not in the supplied memories," which is the hardest constraint in the system and the one a smaller model is most likely to break. `llama-3.1-8b-instant` is a documented fallback if latency becomes a demo problem, changeable via one env var since the id appears in exactly one place.

**[TO VERIFY]** Groq's docs list structured outputs and tool use as platform features but do not publish a per-model capability matrix. ClientOS uses JSON-object response format plus zod validation and a single repair retry, which does not depend on strict schema enforcement — so it degrades safely if a given model lacks it.

### 3.2 The non-negotiable prompt constraint

Every prompt that touches client history carries this rule, and it is the single most important line in the agent:

> You know nothing about this client except the memories supplied below. Never state, imply, or infer any client preference, decision, approval, or rejection that is not present in those memories. If the memories do not cover something, say so explicitly.

`MASTER_SPEC` §19: *"The agent must not hallucinate client history. If no memory exists, it must say that."* Enforced three ways:

1. **Prompt constraint** (above).
2. **Structural** — the recommendation schema requires `evidenceMemoryIds` on every bullet that claims a client preference, and the backend **drops any bullet citing an id that was not in the recall result** (§7).
3. **Empty-memory branch** — zero recalled memories takes a different code path with a different prompt that produces an explicitly generic answer flagged `memoryUsed: false`.

Point 2 is what makes this more than a hope: a fabricated preference cannot survive, because it cannot cite a real memory id.

---

## 4. Memory Extraction

Implements `MASTER_SPEC` §9 and §8.4 of the audit: *do not automatically retain everything.*

### 4.1 Durable vs non-durable

| **DURABLE** — retain | **NON-DURABLE** — discard |
|---|---|
| Explicit preference (*"keep headlines shorter"*) | Greetings, pleasantries, small talk |
| Explicit approval (*"the serif direction works, keep it"*) | Scheduling and logistics |
| Explicit rejection (*"the animations are too much"*) | Restatements of what the agency said |
| Important decision | Temporary wording with no decision content |
| Constraint (*"must be mobile-first"*) | Speculation (*"maybe we'd consider…"*) |
| Meaningful outcome | Unconfirmed assumptions the agency inferred |
| Confirmed preference change | Questions carrying no preference |

### 4.2 Extraction call

`agent/extract.ts` — one Groq call per interaction, `temperature: 0.1`, validated by zod:

```ts
{
  candidates: [{
    type: 'preference'|'approval'|'rejection'|'constraint'|'decision'|'outcome',
    statement: string,        // third person, self-contained, no interaction number
    sourceQuote: string,      // VERBATIM span from the input
    scopeHint: 'interaction'|'revision'|'project'|'client'|'unknown',
    confidence: number,       // 0..1
  }],
  discarded: [{ text: string, reason: string }]
}
```

Prompt requirements that do real work:

- **`statement` must be self-contained** — *"The client rejected heavy animation"*, not *"too much"*. A recalled memory is read months later with no surrounding context.
- **`sourceQuote` must be verbatim.** Post-validated with a substring check against the interaction content; a candidate whose quote is not literally present is **dropped**. This is a cheap, hard anti-fabrication gate at the extraction boundary.
- **`statement` must not embed the interaction label.** Provenance lives in the `source:` tag, so the same statement stays comparable across interactions.
- **`discarded` must be populated** with a reason, so the UI can show selectivity.

### 4.3 Durability gate (deterministic, post-LLM)

A candidate is retained only if **all** hold:

1. `type` is in the allowed enum.
2. `confidence >= 0.6`.
3. `sourceQuote` is a verbatim substring of `interaction.content`.
4. `statement` is 10–300 characters.
5. It is not a near-duplicate of an existing valid `memory_refs` statement for the same project (normalised comparison).

Failures are recorded in `discarded` with a reason and shown in the response — never silently dropped.

### 4.4 Scope assignment

`scopeHint` is a **hint, not a decision**, per `docs/PRODUCT_DECISIONS.md` Decision 4:

| `scopeHint` | Resulting `scope:` tag | Confirmation |
|---|---|---|
| `interaction` / `revision` | `scope:interaction` / `scope:revision` | none — inherently narrow |
| `project` | `scope:project` | none — the safe default |
| `client` | **held** — `scope:project` provisionally | **asked**, because client-wide is a strong claim |
| `unknown` | **held** | **asked** |

Defaulting to project scope is the conservative choice: a memory that should have been client-wide merely under-applies, whereas a wrongly client-wide memory silently contaminates every future project. That asymmetry is exactly the `MASTER_SPEC` §2 restriction *"do not turn one historical exception into a permanent universal rule."*

---

## 5. Preference Conflict System

The feature the demo turns on. Implements `MASTER_SPEC` §11 and `HINDSIGHT_MEMORY.md` §7.

### 5.1 Detection

For each surviving candidate, in `agent/conflict.ts`:

**Step 1 — targeted recall.** Query = the candidate statement (not the raw interaction text — the statement is normalised and scopes the search tightly):

```ts
await hindsight.recall(bankId, candidate.statement, {
  types: ['world', 'observation'],   // established facts and consolidated beliefs
  budget: 'mid',
  maxTokens: 1500,
  preferObservations: true,
  tagGroups: [{ or: [
    { tags: [`project:${projectSlug}`], match: 'any_strict' },
    { tags: ['scope:client'],           match: 'any_strict' },
    { tags: ['scope:future'],           match: 'any_strict' },
  ]}],
});
```

`types` excludes `experience` on purpose: an experience is *"the client said X on date Y"*, which cannot be contradicted — it happened. Only standing facts and consolidated beliefs can be superseded.

**Step 2 — adjudication.** One Groq call, `temperature: 0`:

```ts
{
  conflicts: boolean,
  oldMemoryId: string | null,   // MUST be one of the supplied ids
  explanation: string,          // why they contradict, one or two sentences
  confidence: number,
}
```

Reported as a conflict only when `conflicts && confidence >= 0.65 && oldMemoryId` is one of the recalled ids. A returned id that was not in the recall set is discarded — the same anti-fabrication gate as §3.2 point 2.

Distinguishing a **contradiction** from a **refinement** is the substance of this prompt: *"shorter headlines"* refines *"minimal style"* (no conflict); *"brighter accents are acceptable"* contradicts *"avoid bright colours"* (conflict). Refinements are retained immediately with no confirmation.

### 5.2 Detected → nothing is retained

On detection the backend inserts a `pending` row in `preference_conflicts`, sets `interactions.retain_status = 'awaiting_confirmation'`, and **writes nothing to Hindsight.** This is the mechanism behind Decision 4: memory does not change until a human confirms the scope.

### 5.3 Frontend flow

1. `POST /api/projects/:id/interactions` returns `conflicts: [...]`.
2. The AI Workspace opens the **Preference Conflict modal**, rendering exactly the layout in `MASTER_SPEC` §11 / `DEMO_SCRIPT.md` Scene 5:

```
Preference Change Detected

Previous:  Avoid bright colors          [Design Review #1 · 12 Mar]
New:       Brighter accent colors are acceptable   [Revision #6]

Apply to:
  ( ) This design direction only
  (•) This project
  ( ) All future projects
                                    [Confirm]  [Keep existing]
```

3. `POST /api/conflicts/:id/resolve` with `{ resolution, scope }`.
4. On success the timeline gains a supersession edge and the AI Workspace invites a re-run of the same request.

Scope options are presented **unselected by default in the real UI** — a pre-selected default would undermine the point that the human decides. (The demo selects "This project", per `docs/DEMO_DATA.md`.)

### 5.4 Backend flow — three branches

Detailed in `HINDSIGHT_INTEGRATION_MAP.md` §4.3 and `API_INTEGRATION_PLAN.md` §15. In `agent/resolve.ts`:

| Scope | `retain` | `createDirective` | Old memory |
|---|---|---|---|
| `interaction` | `scope:interaction` | — | untouched |
| `project` | `scope:project` | tagged `project:{slug}` | tagged `status:superseded`, **left valid** |
| `client` / `future` | `scope:client` | tagged `client:{slug}` | **`updateMemory` → `state:'invalidated'`** with reason |

Why the project branch does not invalidate: the old preference is still true for the client's *other* projects. Invalidating it would let a narrow exception silently become a universal rule — the exact failure mode `MASTER_SPEC` §2 prohibits. The tag-scoped **directive** is what makes the override bind only where confirmed, and it works because Hindsight directives are tag-scoped by default (verified, `HINDSIGHT_INTEGRATION_MAP.md` §2.7).

Every branch preserves history: nothing is ever deleted, and invalidation is reversible and auditable.

### 5.5 Historical preservation in the UI

`memory_links` gives the timeline:

```
Design Review #1 · Preference · Avoid bright colors          [superseded ⟶]
    └─ superseded for project "Premium Website Redesign" on 27 Sep
Revision #6 · Preference · Brighter accent colors acceptable  [scope: project]
```

The old memory stays visible and legible. `DEMO_SCRIPT.md` Scene 6's line — *"The old memory wasn't deleted"* — is therefore literally true and visibly so.

---

## 6. Recommendation Generation

`agent/recommend.ts`, behind `POST /api/agent/recommend`.

### 6.1 Recall and partition

Recall as `HINDSIGHT_INTEGRATION_MAP.md` §3.3. Then `agent/classify.ts` partitions by `type:` tag — **no LLM**:

- **applicable preferences** — `type:preference`, `type:constraint`, `type:decision`, state valid
- **rejected approaches** — `type:rejection`
- **approvals** — `type:approval`
- **outcomes** — `type:outcome`
- **caveats** — any `pending` conflicts for this project

### 6.2 Synthesis

One Groq call, `temperature: 0.3`, with memories supplied as an id-labelled list:

```
MEMORY (the only source of client history you may use):
[m1] (rejection, Revision #3, 2026-06-12) The client rejected heavy animation.
[m2] (approval,  Design Review #2, 2026-05-03) The client approved serif typography.
...
```

Structured output:

```ts
{
  items: [{ text: string, rationale: string, evidenceMemoryIds: string[] }],
  avoid: [{ text: string, evidenceMemoryIds: string[] }],
  notes: string[],   // e.g. "No memory covers imagery style."
}
```

`avoid` is separated from `items` so rejected approaches get their own UI treatment — the most persuasive part of the demo is the agent *declining* a direction and citing why.

### 6.3 Empty memory

Zero recalled memories takes a **different prompt** that produces a frankly generic answer and sets `memoryUsed: false`, `memoryCount: 0`. It must not pretend to client knowledge — this path is what powers Scene 1 honestly. It is distinct from `503 HINDSIGHT_UNAVAILABLE`, which means memory should have been there and was not.

---

## 7. Evidence / "Why" — deterministic

`agent/evidence.ts`. **No LLM.** Implements `MASTER_SPEC` §18.

1. For each returned item, map `evidenceMemoryIds` → the `RecallResult` objects actually recalled.
2. **Drop any id not present in the recall set** (the §3.2 anti-fabrication gate).
3. **Drop any item that claims a client preference but cites nothing.**
4. Build each citation from real fields: `text`, the `source:` tag → interaction label, `type:` tag, `mentioned_at`.

Rendered:

```
Recommendation:  Use restrained animation
Why:             Heavy animation was rejected during Revision #3.
Evidence:        Revision #3 — Revision · 12 Jun 2026
                 "The client rejected heavy animation."
```

The "Why" string is assembled from the memory's own text and its `source:` label, not generated. This is why evidence cannot drift from what memory actually says — and why the interaction labels in `docs/DEMO_DATA.md` must be seeded verbatim (`DATA_MODEL.md` §4).

Note the cross-check against `CURRENT_PROJECT_AUDIT.md` §8.2: `README.md` and `HINDSIGHT_MEMORY.md` misattribute heavy animation to Revision #2. **Revision #3 is canonical.** With deterministic evidence the UI will show whatever was seeded — so a seeding error would produce a *wrong but confident* citation on stage. Worth one verification pass before the demo.

---

## 8. End-to-End Data Flow

```
USER: "Create the next homepage direction."
  │
  ▼  AI Workspace — POST /api/agent/recommend { clientId, projectId, message, useMemory: true }
  │
  ▼  agent.routes.ts → zod validation
  │
  ▼  clients.service → hindsight_bank_id = 'client-vive-studio'
     projects.service → tag 'project:premium-website-redesign'
  │
  ▼  hindsight/recall.ts — HINDSIGHT RECALL
     POST /v1/default/banks/client-vive-studio/memories/recall
     tagGroups: project ∪ scope:client ∪ scope:future, budget 'mid', preferObservations
  │
  ▼  RecallResult[] — premium positioning · minimal layouts · serif approved ·
     blue-heavy rejected · heavy animation rejected · short headlines ·
     customer proof above fold
  │
  ▼  agent/classify.ts — partition by type: tag (no LLM)
  │
  ▼  agent/recommend.ts — GROQ, memory as the only source of client history
  │
  ▼  { items[], avoid[], notes[] } with evidenceMemoryIds
  │
  ▼  agent/evidence.ts — bind ids → recalled memories; drop uncited claims
  │
  ▼  persist `recommendations` (items, evidence snapshot, memoryUsed, hindsightOk)
  │
  ▼  FRONTEND — recommendation cards + "Why?" drawer + memory badge
  │
  ▼  USER FEEDBACK — accept / correct, or submit "We're now open to brighter accent colors."
  │
  ▼  POST /api/projects/:id/interactions → extract → conflict-check → CONFLICT DETECTED
     (nothing retained yet)
  │
  ▼  Conflict modal → POST /api/conflicts/:id/resolve { new_preference, scope: 'project' }
  │
  ▼  HINDSIGHT RETAIN (new, scope:project) + createDirective(tags: project:*)
     + old memory tagged status:superseded (left valid) + memory_links edge
  │
  ▼  SAME REQUEST AGAIN → recall now returns the new preference and the
     project-scoped directive applies → RECOMMENDATION CHANGES
```

Definition of Done steps 1–10 (`MASTER_SPEC` §27) are each observable in this trace.

---

## 9. Frontend Implementation Plan

**No frontend exists** — every component is new. There is nothing to reuse, so the discipline is the opposite of the brief's usual one: build the *fewest* components that cover four screens, and share aggressively between them.

Shared primitives built once and reused across all screens: `MemoryCard`, `EvidenceList`, `LoadingState`, `EmptyState`, `ErrorState`, `ScopeBadge`, `TypeBadge`, `MemoryStatusBadge`.

State/data: `@tanstack/react-query` — loading/error/refetch states are required on every screen by the brief, and hand-rolling them for 16 endpoints inside 8 hours is a poor trade. `react-router-dom` for routing. No global store needed.

### Screen 1 — Client Dashboard · `/`

| | |
|---|---|
| Reuse | *(nothing exists)* |
| New | `pages/Dashboard.tsx`, `components/ClientCard.tsx` |
| API | `GET /api/clients` |
| Hindsight data | per-client counts of preferences / rejections / approvals (from cache) |
| Actions | open a client |
| Loading | skeleton cards |
| Empty | "No clients yet" + a "Load demo data" action → `POST /api/demo/reset` |
| Error | inline error + retry |

### Screen 2 — Client Workspace · `/clients/:clientId`

| | |
|---|---|
| Reuse | `MemoryCard`, `TypeBadge`, `ScopeBadge`, states |
| New | `pages/ClientWorkspace.tsx`, `components/ProjectSelector.tsx`, `MemoryPanel.tsx`, `InteractionList.tsx`, `AddInteractionForm.tsx` |
| API | `GET /api/clients/:id`, `GET /api/projects/:id`, `GET /api/projects/:id/interactions`, `POST /api/projects/:id/interactions`, `GET /api/projects/:id/conflicts` |
| Hindsight data | current preferences, approvals, rejections, constraints; open conflicts |
| Actions | select project · add interaction · open conflict · retry a failed retain |
| Loading | panel skeletons; submit spinner |
| Empty | per-panel ("No rejections recorded yet") |
| Error | per-panel; **failed retain shows an explicit "memory not stored" warning + retry** |

### Screen 3 — AI Workspace · `/clients/:clientId/ai`

The demo's primary screen.

| | |
|---|---|
| Reuse | `MemoryCard`, `EvidenceList`, states |
| New | `pages/AIWorkspace.tsx`, `components/RequestBox.tsx`, `RecommendationCard.tsx`, `AvoidCard.tsx`, `WhyDrawer.tsx`, `ConflictModal.tsx`, `MemoryUsedBadge.tsx` |
| API | `POST /api/agent/recommend`, `GET /api/agent/recommendations/:id`, `POST .../feedback`, `POST /api/conflicts/:id/resolve` |
| Hindsight data | recalled memories as per-bullet evidence; memory count; directives applied |
| Actions | ask · toggle **Use memory** · open "Why?" · accept/correct · resolve a conflict |
| Loading | streamed-feel skeleton bullets; explicit "Recalling memory…" then "Reasoning…" |
| Empty | suggested prompt: *"Create the next homepage direction for this client."* |
| Error | **`HINDSIGHT_UNAVAILABLE` renders a distinct banner — "Memory unavailable; no recommendation generated" — and no recommendation is shown** |

The **Use memory** toggle is the demo instrument: it makes Scene 1 vs Scene 3 a single visible switch on one screen, with `memoryUsed` / `memoryCount` rendered from the response rather than asserted by the presenter.

### Screen 4 — Memory Timeline · `/clients/:clientId/memory`

| | |
|---|---|
| Reuse | `MemoryCard`, `TypeBadge`, `ScopeBadge`, states |
| New | `pages/MemoryTimeline.tsx`, `components/TimelineItem.tsx`, `SupersessionLink.tsx`, `MemoryFilters.tsx` |
| API | `GET /api/projects/:id/memory`, `GET /api/clients/:id/memory` |
| Hindsight data | every memory with type, scope, source interaction, state, supersession edges |
| Actions | filter by type/scope/state · expand to see the source quote · `?verify=true` cross-check |
| Loading | skeleton timeline |
| Empty | "No memories yet — add an interaction" |
| Error | inline + retry |

Superseded memories render struck-through-but-present with their replacement linked — the visual proof of `docs/PRODUCT_DECISIONS.md` Decision 3.

### App shell

`App.tsx` + `components/AppShell.tsx`: nav, and the **`MemoryStatusBadge`** polling `GET /api/health/hindsight`. If Hindsight is down, every screen shows it. No screen can imply memory worked when it did not.

---

## 10. Backend Implementation Plan

**Every item is CREATE.** There is no existing code to reuse, modify, or delete.

| Category | Files | Count |
|---|---|---|
| **REUSE** | *(none — no code exists)* | 0 |
| **MODIFY** | *(none — no code exists)* | 0 |
| **DELETE** | *(none — no code exists)* | 0 |
| **CREATE** | see below | ~38 backend + ~28 frontend |

The only deletion considered anywhere in this project is the duplicate repository at `/home/laksh/Documents/Hackathon/ClientOS` (`CURRENT_PROJECT_AUDIT.md` §0.1), which requires explicit approval.

```
backend/
├── package.json · tsconfig.json · .env.example
└── src/
    ├── index.ts                       -- express bootstrap, CORS, error handler
    ├── config/env.ts                  -- zod-validated env; fails fast on a missing key
    ├── db/pool.ts · migrate.ts · seed.ts · migrations/001..005.sql
    ├── hindsight/  client.ts tags.ts banks.ts retain.ts recall.ts
    │                reflect.ts curate.ts directives.ts
    ├── llm/        groq.ts schemas.ts prompts/{extract,conflict,recommend}.prompt.ts
    ├── agent/      extract.ts conflict.ts classify.ts recommend.ts evidence.ts resolve.ts
    ├── services/   clients.service.ts projects.service.ts interactions.service.ts
    │                memory.service.ts conflicts.service.ts demo.service.ts
    ├── routes/     health clients projects interactions agent conflicts demo (.routes.ts)
    └── middleware/ errorHandler.ts validate.ts asyncHandler.ts demoToken.ts
```

`config/env.ts` validating on boot is worth the ten lines: a missing `HINDSIGHT_API_KEY` should fail at startup with a clear message, not as a 401 in the middle of the demo.

---

## 11. Error Handling

Implements `ARCHITECTURE.md` §7 in full.

| Failure | Detection | Behaviour |
|---|---|---|
| Hindsight unavailable | `HindsightError` / network | `503 HINDSIGHT_UNAVAILABLE`; **no recommendation returned**; badge turns red |
| Hindsight 401 | `statusCode === 401` | health reports disconnected with a config hint |
| Bank missing (404 on read) | `statusCode === 404` | treated as "not seeded", **not** as "no memory" |
| Recall returns empty | `results.length === 0` | `200` with `memoryUsed:false`; agent says no relevant history exists |
| Retain fails | non-2xx; **never auto-retried** | `retain_status='failed'` + `retain_error`; UI retry via endpoint 8 |
| LLM timeout | `AbortSignal`, 30 s | `503 LLM_UNAVAILABLE` |
| Invalid LLM JSON | zod failure | one repair retry, then `503` |
| LLM cites unknown memory id | id not in recall set | citation dropped; uncited preference claims dropped |
| Missing client/project | DB lookup | `404 NOT_FOUND` |
| Duplicate interaction | unique `(project_id, label)` | `409 CONFLICT` |
| Unresolved conflict pending | `preference_conflicts` query | surfaced as a `caveats` entry on recommendations |

---

## 12. Demo Implementation

One fictional client — Vive Studio / Premium Website Redesign — per `MASTER_SPEC` §16. Seed data and stages in `DATA_MODEL.md` §4.

| Demo requirement (`MASTER_SPEC` §17) | Mechanism |
|---|---|
| 1. Generic response | stage `empty`, **or** `useMemory: false` on the same screen |
| 2. Historical memories added | `POST /api/demo/stage { history }` → `retainBatch` of interactions 1–7 |
| 3. Same request | identical `message` to `POST /api/agent/recommend` |
| 4. Different personalised recommendation | recall returns 7+ memories → different `items[]` / `avoid[]` |
| 5. Why / evidence | `WhyDrawer` over deterministic `evidence[]` |
| 6. Preference conflict | submit Revision #6 live → conflict detected, nothing retained |
| 7. Confirmation | conflict modal → resolve at **project** scope |
| 8. Updated recommendation | same request again → brighter accents now permitted, other preferences intact |

**Blocking demo issue:** the Revision #6 conflict has no source memory to contradict — *"avoid bright colors"* is never established by interactions 1–7. Full analysis in `CURRENT_PROJECT_AUDIT.md` §8.1; recommended one-clause fix in `DATA_MODEL.md` §4.1. **Requires approval before Phase 6**, because it changes specified demo data. Without it, step 6 above produces no conflict and steps 7–8 cannot run.

---

## 13. Verification Against the Definition of Done

`MASTER_SPEC` §27, mapped to the mechanism that satisfies each step:

| # | Requirement | Mechanism |
|---|---|---|
| 1 | Client has historical decisions | seed + `POST /api/demo/stage` |
| 2 | Hindsight stores them | `retainBatch`, `async:false`, ids reconciled via `listMemories` |
| 3 | User asks for a new task | `POST /api/agent/recommend` |
| 4 | ClientOS recalls relevant history | `recall` with `tagGroups` scoping |
| 5 | Recommendation changes because of history | `useMemory` toggle demonstrates both states on one screen |
| 6 | ClientOS explains why | deterministic `agent/evidence.ts` |
| 7 | Client changes a preference | `POST /api/projects/:id/interactions` (Revision #6) |
| 8 | Conflict detected | `agent/conflict.ts` — **depends on the §12 fix** |
| 9 | User confirms scope | conflict modal → `POST /api/conflicts/:id/resolve` |
| 10 | Future recommendation changes again | new memory + tag-scoped directive alter the next recall |
