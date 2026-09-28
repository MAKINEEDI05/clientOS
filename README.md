# ClientOS — Client Decision Memory Agent

> **AI that remembers why your clients decide.**

ClientOS remembers client preferences, approvals, rejections, constraints and changing
requirements, then uses that persistent experience to make the next recommendation more accurate.

Memory lives in **Hindsight**. Reasoning runs on **Groq**. PostgreSQL holds application
metadata only — it is never a substitute for the memory layer.

---

## The core idea

A normal AI answers the current request. ClientOS answers using

**current request + recalled client history + the evidence for it**

```
Client feedback
      ↓  extract only durable decisions
Hindsight Retain
      ↓
Hindsight Recall  ──►  Groq reasoning  ──►  Recommendation + Why/evidence
      ↓                                            ↓
      └──────────── outcome / new feedback ────────┘
```

The proof is behavioural: the same question produces a different answer once the client's
history exists, and changes again when a preference is confirmed as changed.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Start PostgreSQL (Docker)
npm run db:up

# 3. Configure credentials
cp .env.example backend/.env
#    then edit backend/.env and set:
#      HINDSIGHT_API_KEY   (from Hindsight Cloud → Organization → API Keys, starts with hsk_)
#      GROQ_API_KEY        (from console.groq.com)

# 4. Create the schema
npm run db:migrate

# 5. Prove the memory loop works end to end (recommended before anything else)
npm run verify:memory

# 6. Seed the demo client
npm run db:seed

# 7. Run both apps
npm run dev
#    frontend → http://localhost:5173
#    backend  → http://localhost:5000
```

`npm run verify:memory` makes live Hindsight and Groq calls and checks retain → recall →
reason → evidence, plus tag scoping and memory invalidation. It uses a throwaway bank and
deletes it afterwards. If it fails, fix that before using the app — the product has no
meaning without it.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Frontend and backend together |
| `npm run build` | Type-check and build both |
| `npm test` | Backend (98, real PostgreSQL + live Hindsight isolation) + frontend (213) |
| `npm run db:up` / `db:down` | Start/stop the PostgreSQL container |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:seed` | Seed the demo client (needs Hindsight — writes real memory) |
| `npm run db:seed -- empty` | Seed with no history (demo Scene 1) |
| `npm run verify:memory` | Live end-to-end check of the memory loop |
| `npm run typecheck` | Strict TypeScript across both workspaces |

---

## Using it

1. **Add a client.** ClientOS provisions that client's decision memory as part of creating
   them — there is no separate setup step, and nothing about the memory layer is exposed.
2. **Add a project.** A stream of work. Feedback and decisions are recorded against it, and a
   client can have several.
3. **Add feedback.** Write what the client actually said. You never pick a category —
   ClientOS works out what is worth remembering and shows you exactly what it understood.
4. **Ask for a direction.** Every claim about the client cites the decision it came from.

## What it does

### 1. Extracts only durable decisions

Feedback goes through an extraction pass that keeps preferences, approvals, rejections,
decisions, constraints, outcomes and confirmed changes — and discards greetings, logistics
and vague remarks.

> "Make it better." → **nothing retained.** The UI shows it was discarded, with the reason.

Every candidate must quote the source text verbatim; a candidate whose quote is not literally
present is dropped. That is the primary defence against invented preferences.

After each submission ClientOS shows what it took from the feedback — the memory type, how
widely it applies, and which interaction it came from — so the step from *what the client said*
to *what is now remembered* is visible rather than implied. One message can yield several
distinct signals: "the serif treatment is right, but drop the shadows" becomes an approval and
a rejection, separately.

### 2. Recalls with real scope isolation

```text
ONE CLIENT
   ↓
ONE HINDSIGHT BANK                       (client-{slug})
   ↓
MULTIPLE PROJECTS                        (tags, never separate banks)
   ↓
PROJECT-SCOPED MEMORY + CLIENT-WIDE MEMORY
   ↓
ACTIVE-PROJECT RECALL                    (project ∪ client ∪ future, any_strict)
   ↓
GROQ RECOMMENDATION
```

One **Hindsight bank per client**, with project/scope/type/source carried as tags. Recall uses
compound tag filters with `any_strict` matching, so one project's memory cannot leak into
another, and one client's bank is invisible to another. A client-wide memory is stored **once**
with no project tag, so it reaches every project without being copied into any of them.

**Hindsight holds the experiential memory; PostgreSQL holds application metadata and a display
cache.** Recall is the agent's only source of client history — no recommendation reads memory
content from PostgreSQL. `reflect` is deliberately not used; see
[HINDSIGHT_MEMORY.md §4.2](HINDSIGHT_MEMORY.md).

### 3. Grounds every claim in real memory — and lets you check it

Each recommendation line carries the memory ids it came from. The backend **drops any citation
that does not correspond to a memory actually returned by recall**, and drops any line that
asserts client history while citing nothing. The "Why?" text is assembled from the memory's own
words and its source interaction — it is not generated.

That is checkable from the UI rather than taken on trust. Every piece of evidence carries a
collapsed **Memory provenance** disclosure showing the memory's real Hindsight id, scope, type,
source interaction and tags; the client context bar discloses the **Hindsight bank** backing the
client. Both stay collapsed by default — the decision is the content, the identifier is the
proof.

Two counts, deliberately worded apart so they cannot be mistaken for each other:

| Shown | Means |
|---|---|
| "10 memories available to this project" | stored and in scope: the project's own + client-wide |
| "Grounded in 10 recalled memories" | what recall actually returned for *this* request |

### 4. Handles changed preferences without erasing history

When new feedback contradicts an existing memory, ClientOS stops, shows both statements, and
asks how widely the change applies. Nothing is written to memory until a human confirms.

| Chosen scope | What happens in Hindsight |
|---|---|
| Temporary exception | New memory at interaction scope. Old memory untouched. |
| This project | New memory + a **project-tagged directive**. Old memory stays valid — it still applies to the client's other work — and is marked superseded here. |
| All future projects | New memory at client scope + a client-tagged directive. Old memory is **invalidated** — removed from recall, but auditable and restorable. |

Nothing is ever deleted. The timeline shows the old preference struck through with its
replacement linked, marked **Superseded**, alongside the **Current** one.

A memory can also be retired by hand from the timeline. That stops it shaping recommendations
but keeps it visible as history, and it can be restored.

### 5. Tells the truth when it cannot remember

If Hindsight is unreachable, the request **fails** with `MEMORY_UNAVAILABLE` rather than
quietly answering without history. The header badge shows live memory status, verified with an
authenticated call.

---

## Screens

| Screen | Route | Purpose |
|---|---|---|
| Dashboard | `/` | Clients with decision counts and open confirmations |
| Client Workspace | `/clients/:id` | Switch project; record feedback against it; current preferences, approvals, rejections |
| AI Workspace | `/clients/:id/ai` | Ask ClientOS; recommendation → Why → evidence → memory provenance; resolve conflicts |
| Memory Timeline | `/clients/:id/memory` | How decisions evolved — this project, client-wide, or all projects |

The active project is shared across all three via `?project=<slug>`, so switching it changes what
is recalled everywhere. It is not the same thing as a memory's *scope* — see
[ARCHITECTURE.md §3.2](ARCHITECTURE.md).

---

## Architecture

```
React + TypeScript + Vite + Tailwind        (frontend — holds no credentials)
        │  /api
Express + TypeScript                        (backend)
        ├── controllers → services → repositories → PostgreSQL   (metadata)
        ├── agents/  extraction · conflict · recommendation · evidence
        ├── hindsight/  retain · recall · curate · directives · tags · banks
        └── llm/  one Groq client, schema-validated output
```

**PostgreSQL** stores users, clients, projects, interactions, memory pointers, conflicts and
recommendation audit. **Hindsight** stores the memory itself. No recommendation ever reads
memory content from PostgreSQL.

See [ARCHITECTURE.md](ARCHITECTURE.md), [HINDSIGHT_MEMORY.md](HINDSIGHT_MEMORY.md) and
[docs/API.md](docs/API.md).

---

## Demo

**Vive Studio** with two projects in one memory bank — *Premium Website Redesign* (8
interactions, 9 decisions) and *Mobile App* (2 interactions, 2 decisions) — plus one client-wide
preference that reaches both. A second client, **Northwind Labs**, has its own bank and wants
bold saturated colour, so asking it the same question returns the opposite direction.

Seeded statements are authored for a deterministic demo and retained through the real Hindsight
path; feedback added live goes through the full extraction pipeline. Counts are verified in
[docs/DEMO_DATA.md](docs/DEMO_DATA.md).

Walkthrough in [DEMO_SCRIPT.md](DEMO_SCRIPT.md). Demo data is synthetic; no real client
information is used.

---

## Documentation

- [Setup](SETUP.md) · [Architecture](ARCHITECTURE.md) · [Hindsight memory design](HINDSIGHT_MEMORY.md)
- [API reference](docs/API.md) · [Demo data](docs/DEMO_DATA.md) · [Demo script](DEMO_SCRIPT.md)
- [Edge case results](EDGE_CASE_TEST_CHECKLIST.md) · [Product decisions](docs/PRODUCT_DECISIONS.md)
- [Hackathon spec](HACKATHON_MASTER_SPEC.md)
