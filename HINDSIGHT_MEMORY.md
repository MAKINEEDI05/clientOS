# ClientOS — Hindsight Memory Design

## 1. Purpose

Hindsight is the central memory layer of ClientOS.

The product should not merely store chat history. It should use persistent memory to influence future recommendations.

## 2. Memory Principle

The key product behavior is:

```text
Experience
   ↓
Memory
   ↓
Recall
   ↓
Reasoning
   ↓
Decision
   ↓
New Experience
```

## 3. What Should Become Memory?

ClientOS should retain meaningful information such as:

### Preferences

What the client likes or generally prefers.

Examples:

- Premium visual style
- Minimal layouts
- Serif headings
- Short headlines

### Rejections

Explicitly rejected approaches.

Examples:

- Blue-heavy visual direction
- Heavy animations
- Playful copy
- Crowded layouts

### Approvals

Explicitly accepted directions.

Examples:

- Customer proof above the fold
- Specific CTA wording
- Approved typography

### Constraints

Rules that restrict future work.

Examples:

- Use approved brand colors
- Mobile-first requirement
- Legal wording requirement

### Changes

A new preference that modifies an older one.

Example:

```text
Previous:
Avoid bright colors.

New:
Bright accent colors are acceptable.
```

## 4. Memory Lifecycle

### Retain

When a meaningful interaction occurs, identify the durable information and retain it in Hindsight.

### Recall

When the user asks for a recommendation, retrieve memories relevant to:

- Current client
- Current project
- Current task
- Relevant design/content domain

### Reflect

Use accumulated experience to identify patterns and improve future recommendations.

The implementation should follow the current Hindsight SDK/API documentation.

## 5. Memory Object Concept

A useful conceptual memory record contains:

```text
Type
Statement
Source interaction
Date
Project
Evidence
Scope
Status
Related memory
Superseded memory
```

Example:

```json
{
  "type": "rejection",
  "statement": "Client rejected blue-heavy visual direction",
  "project": "Website Redesign",
  "source": "Design Review #2",
  "scope": "project",
  "status": "active"
}
```

## 6. Scope

A memory should not automatically become universal.

Possible scopes:

- This interaction
- This revision
- This project
- This client
- Future projects

When scope is unclear, ask the user.

## 7. Conflict Handling

Client preferences can change.

Example:

```text
Historical memory:
Avoid bright colors.

New statement:
We are now open to brighter accent colors.
```

ClientOS should:

1. Detect the conflict.
2. Show the old memory.
3. Show the new statement.
4. Ask for scope.
5. Keep historical information.
6. Mark the new information as current when confirmed.

## 8. Avoiding Bad Memory

Do not turn every conversational sentence into durable memory.

Durable memory should represent meaningful:

- Decisions
- Preferences
- Constraints
- Rejections
- Approvals
- Outcomes

## 9. Evidence

Recommendations should expose the memories that influenced them.

Example:

```text
Recommendation:
Use restrained animation.

Why:
Heavy animation was rejected during Revision #2.

Evidence:
Revision #2 — Design Review
```

## 10. The Critical Demo

The strongest memory demonstration is:

```text
Request
  ↓
Generic recommendation

Add historical interactions
  ↓
Same request
  ↓
Different recommendation

Add new confirmed preference
  ↓
Same request again
  ↓
Recommendation changes again
```

That proves that memory is affecting behavior rather than merely being displayed.
