# ClientOS — Demo Script

**Target: 2–3 minutes.** One idea: *ClientOS gets better because it remembers what the client
decided before.*

## Before you start

```bash
npm run db:up
npm run verify:memory     # must report CORE MEMORY LOOP VERIFIED
npm run db:seed           # stage: history (7 interactions, 9 memories)
npm run dev
```

Open <http://localhost:5173>. Confirm the header badge reads **Memory connected**.

**Do not** pre-submit Revision #6 — it is submitted live in Scene 3 so the conflict is real.

---

## 0:00–0:20 · The problem

> "AI can generate a website concept. But if it doesn't remember why the client rejected the
> last one, it starts from zero every time."

Open **Vive Studio → AI Workspace**.

---

## 0:20–0:50 · Scene 1 — without memory

Untick **Use client memory**. Ask:

> Create the next homepage direction.

A competent, generic answer appears. Point at the banner:

> "No client history was used."

Every point reads **General practice** — no citations. Don't linger.

---

## 0:50–1:20 · Scene 2 — the memory

Open **Memory Timeline**. Nine decisions across five months: premium positioning, a muted
palette, serif approved, blue-heavy rejected, heavy animation rejected, shorter headlines,
customer proof above the fold.

> "These aren't chat logs. ClientOS extracted the durable decisions and stored them in
> Hindsight — and it's selective. Vague feedback like *make it better* is deliberately not
> stored."

---

## 1:20–1:50 · Scene 3 — the same question, with memory

Back to **AI Workspace**. Tick **Use client memory**. Ask the *identical* question.

> **Grounded in 9 recalled memories.**

The answer is now specific to this client: muted palette, serif typography, concise headlines,
customer proof above the fold, restrained motion — and an **Avoid** list covering heavy
animation, bright saturated colour, and the blue-heavy direction.

> "Same question. Different answer — because the agent remembers."

---

## 1:50–2:10 · Scene 4 — the Why

Click **Why?** on *restrained motion*.

```
Why:  The client rejected heavy animation. (Revision #3)
Supporting memories:  ✕ Rejection · Revision #3 · 13 Aug 2026
```

> "It doesn't just remember — it shows you the decision it came from. That citation is a real
> memory id from Hindsight. If the agent can't point to a memory, we drop the claim."

---

## 2:10–2:30 · Scene 5 — the client changes their mind

**Client Workspace → Record client feedback.**

Label `Revision #6`, source *Revision*:

> We're now open to brighter accent colours.

ClientOS stops:

```
PREFERENCE CHANGE DETECTED
Previously:  The client wants to avoid bright, saturated colours.   (Design Review #1)
New:         The client is now open to brighter accent colours.     (Revision #6)

Apply to:  ( ) Temporary exception   ( ) This project   ( ) All future projects
```

> "It noticed this contradicts a decision from four months ago — and it hasn't written anything
> yet. One exception shouldn't silently become a permanent rule, so it asks."

Choose **This project**. Confirm.

---

## 2:30–2:50 · Scene 6 — the answer changes again

**AI Workspace.** Ask the *same* question a third time.

> "Use a muted, restrained colour palette **with brighter accent colours for highlights**"

And in Avoid — note the wording:

> "Bright, saturated colours **as primary palette**"

> "Brighter accents are allowed now. Restraint survives. It understood the difference."

Open **Memory Timeline**: the old preference is still there, struck through, linked to its
replacement.

> "Nothing was deleted. It learned that the preference changed — for this project."

---

## 2:50–3:00 · Close

> "ClientOS doesn't just remember what the client said. It remembers what the client decided,
> why they decided it, and uses that experience in the next decision."

---

## If asked: isolation

Open **Northwind Labs → AI Workspace**, same question. The answer is bold, saturated colour and
playful motion — the opposite direction, from a separate Hindsight bank.

> "One bank per client. Northwind's memory cannot reach Vive Studio's, and vice versa."

## If asked: what if Hindsight is down?

The badge turns red and the request is refused with *"Memory unavailable. We could not safely
use client history."*

> "It won't answer as if it remembered. If memory isn't available, it says so."

## Recovery

| Problem | Fix |
|---|---|
| Demo state is wrong | `npm run db:seed` — deletes and recreates the banks |
| Conflict already resolved | Re-seed; Revision #6 is not seeded by default |
| Badge red | Check `HINDSIGHT_API_KEY`; `npm run verify:memory` |
| Need the post-conflict state directly | `npm run db:seed -- post_conflict` |

If live memory fails, say so plainly and show the prepared dataset. **Do not claim a live
memory operation occurred if it did not.**
