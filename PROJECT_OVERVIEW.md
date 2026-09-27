# ClientOS — Project Overview

## 1. Product definition

**ClientOS** is a Client Decision Memory Agent.

It keeps persistent memory of client decisions in Hindsight and uses that history to make the
next recommendation more accurate.

> ClientOS remembers client preferences, decisions, rejections and revisions, so every new
> client task starts with what the team already learned.

## 2. The problem

Client work is iterative. A decision made in one meeting shapes work weeks later, but the
reasoning behind it is usually lost. The result:

- Rejected ideas get proposed again.
- Nobody remembers *why* something was rejected.
- Context evaporates between meetings.
- New team members start with no history.
- Old preferences are treated as current forever.
- Questions already answered get asked again.

The deeper problem is **loss of decision context**, not a shortage of documents.

## 3. Target persona

A creative or digital agency team working with clients on website and design revisions. The
product is deliberately narrow: one persona, one workflow.

## 4. Value proposition

Instead of answering *"what did the client say?"*, ClientOS answers
*"what does this client's history tell us to do now, and why?"* — with the evidence attached.

## 5. Core loop

```text
Client feedback
      ↓  extract only durable decisions
Hindsight Retain
      ↓
Hindsight Recall  ──►  Groq reasoning  ──►  Recommendation + Why/evidence
      ↓                                            ↓
      └──────────── outcome / new feedback ────────┘
```

## 6. What is built

| Capability | How it works |
|---|---|
| **Selective memory** | Feedback is filtered to durable decisions only. Every retained memory must quote the source text verbatim, so vague input cannot become an invented preference. Discards are shown with reasons. |
| **Scoped recall** | One Hindsight bank per client; project, scope, type and source carried as tags. Compound tag filters with `any_strict` matching keep projects and clients isolated. |
| **Multi-project memory** | One client can have many projects. Each recalls its own decisions plus the client-wide ones; a sibling project's decisions are never recalled. A client-wide memory is stored once, not copied per project. |
| **Grounded recommendations** | Each line is bound to the memory ids it came from. Citations that were not recalled are dropped; lines claiming client history with no citation are removed. |
| **Why / evidence** | Assembled from the memory's own words and its source interaction — never generated, so it cannot drift from what memory says. |
| **Preference conflicts** | A contradiction halts the write, shows both statements, and asks how widely the change applies. Nothing reaches memory until a human confirms. |
| **Preserved history** | No memory is ever deleted. Project-scoped changes mark the old preference superseded; client-wide changes invalidate it, which keeps it auditable and restorable. |
| **Honest failure** | If Hindsight is unreachable the request fails rather than answering without history. The header badge reflects live, authenticated memory status. |
| **Self-service setup** | Adding a client provisions their memory automatically; adding a project and recording feedback need no configuration. The memory layer is never exposed as a concept the user has to manage. |
| **Visible extraction** | After each piece of feedback, ClientOS shows what it understood, how widely it applies and where it came from — including what it chose *not* to store, and why. |

### Screens

| Screen | Route | Shows |
|---|---|---|
| Dashboard | `/` | Clients, decision counts, open confirmations |
| Client Workspace | `/clients/:id` | Switch or add projects; record feedback against the active project; current preferences, approvals, rejections |
| AI Workspace | `/clients/:id/ai` | Pick the project, ask ClientOS; recommendation → Why → evidence; resolve conflicts |
| Memory Timeline | `/clients/:id/memory` | How decisions evolved — this project, client-wide, or all projects; current, superseded and retired entries, with replacements linked |

The active project is shared across all three (held in the URL as `?project=<slug>`),
so switching it changes what is recalled everywhere at once. It is not the same
thing as a memory's scope — see
[ARCHITECTURE.md §3.2](ARCHITECTURE.md#active-project-vs-memory-scope).

## 7. Non-goals

ClientOS is not a CRM, a project-management suite, an email or billing platform, a document
manager, a general chatbot, or an autonomous client-communication tool. Each was excluded
because it would dilute the memory-learning demonstration rather than strengthen it.

## 8. Success criteria

Observable in three steps:

1. **Before memory** — a generic answer, with no citations and an explicit note that no history
   was found.
2. **After memory** — the same question, a personalised answer, every claim citing a real
   recalled memory.
3. **After a confirmed change** — the same question again, and the answer changes to match.

All three are reproducible from a clean state via `npm run db:seed`.

## 9. Future scope

Email and meeting integrations · cross-project questions ("what has this client always
wanted?") · team handoff · approval workflows · client communication drafting ·
analytics on recurring revision patterns · authentication and multi-tenancy.

---

See [README.md](README.md) to run it, [ARCHITECTURE.md](ARCHITECTURE.md) for how it is built,
[HINDSIGHT_MEMORY.md](HINDSIGHT_MEMORY.md) for the memory design, and
[docs/PRODUCT_DECISIONS.md](docs/PRODUCT_DECISIONS.md) for why.
