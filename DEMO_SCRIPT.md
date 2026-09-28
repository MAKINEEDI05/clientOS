# ClientOS — Demo Script

**Target: 90 seconds.** One idea: *the agent gets better because it remembers what this client
decided before — and you can check that it really did.*

## Before you start

```bash
npm run db:up
npm run verify:memory     # must report CORE MEMORY LOOP VERIFIED
npm run db:seed           # 11 interactions, 13 memories across two clients
npm run dev
```

Open <http://localhost:5173> → **Vive Studio → AI Workspace**.

Wait for the header badge to read **Memory connected** and the switch to read
**Client memory ON** — the memory check takes a few seconds, and the switch stays disabled
until it passes.

**Do not** pre-submit Revision #6. It is submitted live in Scene 4 so the conflict is real.

---

## 0:00–0:10 · Scene 1 — the problem

> "Clients change their minds. Teams forget why. So the same rejected idea comes back three
> revisions later."

---

## 0:10–0:25 · Scene 2 — without memory

Switch **Client memory OFF**. Ask:

> Create the next homepage direction.

A competent, generic answer. Point at two things and move on:

```
Memory off
Client memory was off for this request, so no previous decision from Vive Studio
was recalled or used.

CLIENT EVIDENCE
0 client memories informed this recommendation
```

> "Nothing about this client. It says so."

---

## 0:25–0:50 · Scene 3 — the same question, with memory · **THE PROOF**

Switch **Client memory ON**. Ask the *identical* question.

The header already reads **Using Vive Studio's Hindsight memory · 10 memories available to this
project · 9 project decisions + 1 client-wide**.

Because the same question was just asked without memory, ClientOS puts both real answers side by
side — **do not skip this, it is the shortest proof in the demo**:

```
MEMORY CHANGES THE DIRECTION
Without client memory          │  With Hindsight memory
<the generic answer you just   │  <the grounded answer>
 saw, verbatim>                │  Grounded in 10 recalled memories.
```

> "Same question, thirty seconds apart. The only thing that changed is whether it could
> remember."

Below it, the result itself:

```
Recommendation                     Grounded in 10 recalled memories
Recalled 10 memories from Vive Studio's Hindsight memory bank for this request.
```

The direction is specific: muted palette, serif typography, concise headlines, customer proof
above the fold, restrained motion — and an **Avoid** list covering heavy animation, bright
saturated colour and the blue-heavy direction.

**Why this direction** is labelled **From recalled client decisions** — with memory off it reads
*General practice only*. That label is not decoration: it follows what recall actually returned.

Now prove it is not talk. Click **Why?** on *restrained motion*, then open
**Memory provenance** on the memory underneath:

```
Stored in    Hindsight memory
Memory ID    e68176fd-f958-4416-8916-cceab2f134ea   (a real id — yours will differ)
Scope        This project
Type         Rejection
Source       Revision #3
Tags         client:vive-studio  project:premium-website-redesign
             scope:project  type:rejection
```

> "That's a real memory id in this client's Hindsight bank, with the tags that scope it. If the
> agent can't point at a memory, we drop the claim."

*(Optional, 3 seconds: open **Memory system details** in the header — `Hindsight bank:
client-vive-studio`. One bank per client.)*

---

## 0:50–1:05 · Scene 4 — the client changes their mind

**Client Workspace → Add client feedback.** It says *Adding feedback to Premium Website
Redesign*. Label `Revision #6`, source *Revision*:

> We're now open to brighter accent colours.

ClientOS stops:

```
PROJECT                  Premium Website Redesign
CLIENT PREFERENCE CHANGED

Previous decision   The client wants to avoid bright, saturated colours.  (Design Review #1)
New decision        The client is now open to brighter accent colours.    (Revision #6)

How should this change apply?
( ) This interaction   ( ) This project   ( ) All future projects
```

> "It caught a contradiction with a decision from four months ago — and it hasn't written
> anything yet."

---

## 1:05–1:15 · Scene 5 — scope

Choose **This project**. Apply.

> "This changes the preference for this project. Their other work is untouched. The old
> preference isn't deleted — it's kept as history, marked superseded."

---

## 1:15–1:30 · Scene 6 — the answer changes

Ask the *same* homepage question a third time.

> "Use a muted, restrained colour palette **with brighter accent colours for highlights**"

And in **Avoid**, note the wording has narrowed:

> "Bright, saturated colours **as primary palette**"

> "Brighter accents are allowed now. The restraint survived. It learned the difference."

---

## 1:30–1:40 · Scene 7 — nothing leaks

Switch the project selector to **Mobile App**.

Header: **3 memories available to this project · 2 project decisions + 1 client-wide**.

Ask a mobile question, open any **Memory provenance**:

```
Tags   client:vive-studio  project:mobile-app  scope:project
```

> "Same client, same bank, different project. The website's decisions are not in here — and the
> one client-wide preference is, because it belongs to the relationship, not the project."

---

## Close

> "It remembers what the client decided, knows how far each decision reaches, and shows you the
> memory behind every line."

---

## If asked: another client

**Northwind Labs → AI Workspace**, same question. Bold, saturated colour and playful motion —
the opposite direction. **Memory system details** reads `client-northwind-labs`.

> "A separate bank. Northwind's memory cannot reach Vive Studio's, and vice versa."

## If asked: is the seeded history real memory?

Yes — it was written through the same retain path the live app uses, and it is in the bank. The
*statements* were authored for a deterministic demo rather than extracted by the model. The
feedback typed in Scene 4 is the live path: extraction, the verbatim-quote check, conflict
detection, then retain. See [docs/DEMO_DATA.md](docs/DEMO_DATA.md).

## If asked: what if Hindsight is down?

The badge turns red, the switch disables, and a memory-backed request is refused with
*"Memory unavailable."*

> "It won't answer as if it remembered."

## If asked: does it use Hindsight Reflect?

No. Retain, recall, memory curation and directives — reflect is deliberately not used, because
recall returns every memory with its id, which is what makes the per-line citations exact. See
[HINDSIGHT_MEMORY.md §4.2](HINDSIGHT_MEMORY.md).

## Recovery

| Problem | Fix |
|---|---|
| Demo state is wrong | `npm run db:seed` — recreates both banks |
| Conflict already resolved | Re-seed; Revision #6 is not seeded by default |
| Switch greyed out | The memory probe is still running or failed — wait, or reload |
| Badge red | Check `HINDSIGHT_API_KEY`; `npm run verify:memory` |
| Need the post-conflict state directly | `npm run db:seed -- post_conflict` |

If live memory fails, say so plainly. **Do not claim a live memory operation occurred if it did
not.**
