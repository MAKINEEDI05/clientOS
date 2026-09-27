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
