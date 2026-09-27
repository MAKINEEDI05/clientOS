# ClientOS — Demo Dataset

All data is **synthetic**. No real client information is used.

Seeded by `npm run db:seed`. Seeding writes through the same Hindsight retain path the live
application uses, so seeded memory is real memory — not a fixture.

## Client

**Vive Studio** (`vive-studio`) — design studio repositioning upmarket.
Hindsight bank: `client-vive-studio`

## Project

**Premium Website Redesign** (`premium-website-redesign`)

## Interactions

Interactions 1–7 are seeded as history. **Revision #6 is deliberately NOT seeded** — it is
submitted live during the demo so conflict detection genuinely runs.

| # | Label | Source | What the client said | Memory produced |
|---|---|---|---|---|
| 1 | Meeting #1 | meeting | "Premium positioning is important for the brand." | preference — premium positioning |
| 2 | Design Review #1 | design-review | "Keep the colour palette restrained and muted — avoid bright, saturated colours." | preference — restrained, muted palette · **rejection — avoid bright, saturated colours** |
| 3 | Design Review #2 | design-review | "Serif typography feels premium. Approved." | approval — serif typography |
| 4 | Revision #2 | revision | "The blue-heavy version doesn't feel right." | rejection — blue-heavy direction |
| 5 | Revision #3 | revision | "The animations feel too heavy. Keep motion restrained." | rejection — heavy animation · preference — restrained motion |
| 6 | Revision #4 | revision | "Headlines should be shorter." | preference — shorter headlines |
| 7 | Revision #5 | revision | "Customer proof should appear above the fold." | approval — customer proof above the fold |
| — | **Revision #6** | revision | **"We're now open to brighter accent colours."** | **submitted live → triggers the conflict** |

Total seeded: 7 interactions, 9 memories for Vive Studio.

> Design Review #1 carries the colour restriction deliberately. It is what Revision #6
> contradicts — without it the conflict would have nothing to detect, and the demo's
> centrepiece would not run.

Hindsight additionally consolidates these raw facts into **observations** of its own, so the
bank typically holds more units than we retained. Those are derived memory, not duplicates.

## Second project — multi-project proof

Vive Studio has a **second project in the same memory bank**, so project scoping
is demonstrable rather than described.

**Mobile App** (`mobile-app`) — companion app for existing customers.

| # | Label | Source | What the client said | Memory produced |
|---|---|---|---|---|
| 1 | UX Review #1 | design-review | "Navigation has to stay simple — people should reach any screen in two taps." | preference — simple navigation |
| 2 | UX Review #2 | design-review | "Accessibility is a priority for us. Text must scale and contrast has to pass WCAG." | constraint — accessibility standards |

And one **client-wide** memory, which belongs to the relationship rather than a
project:

| # | Label | Source | What the client said | Memory produced |
|---|---|---|---|---|
| — | Relationship Review #1 | meeting | "Across everything we do together, premium positioning and clear communication matter most." | preference (**scope: client**) — premium positioning and clear communication |

Total for Vive Studio: 9 website memories + 2 mobile memories + 1 client-wide = 12.

### What this demonstrates

Ask the **website** project for a homepage direction → 10 memories (its 9 plus the
client-wide one). Ask the **Mobile App** "How should we approach the next product
screen?" → 3 memories (its 2 plus the same client-wide one). Neither sees the
other's work, and the client-wide memory is **one stored memory**, not a copy per
project.

## Second client — isolation proof

**Northwind Labs** (`northwind-labs`), project **Marketing Site**, bank `client-northwind-labs`.

| Label | What the client said |
|---|---|
| Kickoff #1 | "We want bold, saturated colours and playful motion throughout the site." |

Asking Northwind the *same* question returns the *opposite* direction — bold and saturated —
because its memory lives in a separate Hindsight bank. This makes isolation demonstrable rather
than merely asserted.

## The demo request

> **Create the next homepage direction.**

## Observed results

### Without memory (`useMemory: false`)

> "Develop a premium homepage concept that emphasizes clear brand messaging, strong visual
> hierarchy, and seamless usability…"

0 citations. `memoryUsed: false`. Notes state that no relevant client history was found.

### With memory, before the conflict

9 memories recalled, 10 citations.

> "Design a premium homepage that feels elegant and refined, using muted colours, serif
> typography, and concise messaging while showcasing customer proof above the fold."

**Avoid:** heavy animation · bright, saturated colour treatments · blue-heavy direction

### After confirming the change at "This project" scope

10 memories recalled.

> "Use a muted, restrained colour palette with brighter accent colours for highlights"

**Avoid:** heavy animation · blue-heavy direction · **bright, saturated colours *as primary
palette***

The distinction is the point: brighter *accents* are now permitted, while the underlying
preference for restraint survives. Neither statement was hardcoded — both came out of recall
plus reasoning.

## Why examples

All assembled from the memory's own text plus its source interaction — never generated.

| Question | Answer |
|---|---|
| Why restrained animation? | "The client rejected heavy animation." (Revision #3) |
| Why serif typography? | "The client approved serif typography." (Design Review #2) |
| Why short headlines? | "The client wants shorter headlines." (Revision #4) |
| Why customer proof high up? | "The client approved placing customer proof above the fold." (Revision #5) |
| Why brighter accents now? | "The client is now open to brighter accent colours." (Revision #6, project scope) |

## Stages

| Stage | Contents |
|---|---|
| `empty` | Client and project only — no history |
| `history` | Interactions 1–7 (default) |
| `post_conflict` | 1–7 plus the resolved project-scoped preference change |

```bash
npm run db:seed -- empty
npm run db:seed                   # history
npm run db:seed -- post_conflict
```

Reset deletes and recreates the Hindsight banks first, so the demo can be run repeatedly
without accumulating duplicate memory.
