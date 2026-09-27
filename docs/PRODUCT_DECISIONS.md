# ClientOS — Product Decisions

## Decision 1: Focus on Client Revisions

ClientOS intentionally focuses on website/design revision workflows instead of becoming a full CRM.

**Reason:** A narrow workflow makes the Hindsight effect easier to demonstrate.

## Decision 2: Memory Is the Core Product

Memory is not a secondary feature.

The value proposition depends on historical decisions changing future recommendations.

## Decision 3: Preserve Historical Decisions

When a preference changes, old memory should remain available.

**Reason:** Historical context explains why previous work was different and helps prevent accidental loss of context.

## Decision 4: Require Confirmation for Ambiguous Preference Changes

If the system cannot determine whether a new statement is project-specific or global, it should ask.

**Reason:** A single exception should not silently become a permanent client rule.

## Decision 5: Explain Recommendations

Recommendations should expose relevant historical evidence.

**Reason:** Users need to trust why the agent is making a recommendation.

## Decision 6: Keep Chat Secondary

The application should not look like a generic chatbot.

The main experience is:

```text
Decision → Memory → Recommendation → Evidence
```

## Decision 7: Use Synthetic Demo Data

The public hackathon demo should use fictional client information unless real-client usage is explicitly permitted.

## Decision 8: Do Not Build a Full CRM

CRM features are outside the MVP because they would dilute the memory-learning demonstration.

---

# Implementation decisions

Decisions 1–8 were taken before implementation. The following were taken during it, and are
recorded here because each one closed off a real alternative.

## Decision 9: One Hindsight bank per client

`bank_id = client-{slug}`. Project separation is a tag filter *within* that bank, not a
separate bank.

**Reason:** Hindsight banks are completely isolated — data in one is invisible to another —
which makes cross-client leakage structurally impossible rather than a matter of query
discipline. A bank per *project* was rejected because the `client` and `future` scopes require
recalling across a client's projects, which per-project banks make impossible.

## Decision 10: Recall + Groq for recommendations, not Hindsight Reflect

Hindsight's `reflect` could generate recommendations directly. ClientOS uses `recall` for
retrieval and Groq for synthesis instead.

**Reason:** three things. The stack commits to Groq. Recall returns every memory with its id,
so each recommendation line can be bound to specific memories — `reflect`'s `based_on` is a
flat list for the whole answer, which would make per-line "Why?" approximate. And prompt
control matters most for the hardest constraint in the system: never inventing client history.

`reflect` is still used for the standing-brief module, so all three Hindsight pillars are
genuinely exercised.

## Decision 11: Scope lives in tags, not in a database column

The five scopes (`interaction`, `revision`, `project`, `client`, `future`) are Hindsight tags.

**Reason:** per the Hindsight documentation, memories only return if their tags intersect the
recall filter. Tags are therefore the mechanism that actually enforces scope at retrieval time.
A database column would describe scope without enforcing it.

Recall uses `any_strict` matching, because the SDK default (`any`) *also* returns untagged
memories — which would let unrelated memory cross a project boundary.

## Decision 12: PostgreSQL caches memory text but is never authoritative

`memory_refs` stores each memory's statement alongside its `hindsight_memory_id`.

**Reason:** the timeline must show supersession edges ("this replaced that") and must render
without a network round trip during a demo. Hindsight models neither a supersession relation
nor server-side metadata filtering, so those relationships have to live somewhere relational.

**The boundary:** no recommendation ever reads memory content from PostgreSQL. The agent's only
source of client history is a live recall. If the cache is stale the timeline is stale;
recommendations are not.

## Decision 13: Evidence binding is deterministic, not generated

Mapping recommendations to their supporting memories is done in code, not by the model.

**Reason:** it is what makes the "Why?" feature trustworthy. A citation pointing at a memory
that was not recalled is dropped, and a line asserting client history while citing nothing is
removed entirely. A fabricated preference cannot survive, because it cannot cite a real memory
id. The "Why" sentence is assembled from the memory's own words and its source interaction, so
it cannot drift from what memory says.

## Decision 14: Scope defaults narrow; broad claims are held for confirmation

A statement the extractor believes is client-wide is stored provisionally at *project* scope
and surfaced for confirmation.

**Reason:** the failure modes are asymmetric. A memory that should have been client-wide merely
under-applies and can be widened later. A wrongly client-wide memory silently contaminates
every future project. This is Decision 4 applied at the point of extraction rather than only at
the point of conflict.

## Decision 15: Extraction requires a verbatim quote

Every extracted memory must quote the source text exactly; the quote is checked against the
feedback in code, and candidates that fail are discarded.

**Reason:** the primary defence against invented preferences. "Make it better" cannot become
"the client prefers minimal design", because no such words exist to quote.

## Decision 16: No authentication in the MVP

A single seeded demo user acts for all requests.

**Reason:** authentication adds no memory-learning value to the demonstration, and the hackathon
scope is one persona and one workflow. Client and project boundaries are still enforced
server-side, and services take a `userId`, so real authentication can be added without
reshaping them. The one destructive endpoint (demo reset) is token-guarded.

## Decision 17: Model selection is verified against the account, not assumed

`GROQ_MODEL` defaults to `openai/gpt-oss-120b`.

**Reason:** the originally specified `llama-3.3-70b-versatile` returns 404 on this Groq account
— it is not available. Because ClientOS depends on reliable structured JSON, the model is
treated as a verified configuration value rather than a fixed assumption, and a model missing
from the account is reported as a configuration error naming the model rather than as an
outage.

## Decision 18: A memory failure is never presented as an answer

If Hindsight is unavailable, a memory-dependent request fails with `MEMORY_UNAVAILABLE`. It does
not fall back to answering without history.

**Reason:** the product's entire claim is that memory changes the answer. Silently answering
without memory — while the UI implies memory was used — would be the single most damaging thing
the system could do. For the same reason the health check uses an *authenticated* Hindsight
call: an unauthenticated ping reports success with an invalid key.
