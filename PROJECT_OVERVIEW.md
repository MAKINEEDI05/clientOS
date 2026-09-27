# ClientOS — Project Overview

## 1. Product Definition

**ClientOS** is a Client Decision Memory Agent.

It maintains persistent memory of client decisions and uses that history to improve future recommendations.

### One-line description

> ClientOS remembers client preferences, decisions, rejections, and revisions so every new client task starts with what the team already learned.

## 2. Problem

Client work is iterative. A decision made during one meeting may affect work weeks later, but the reasoning behind that decision is often lost.

Common failures:

- Repeating rejected ideas.
- Forgetting why an idea was rejected.
- Losing context between meetings.
- New team members lacking client history.
- Treating old preferences as current forever.
- Repeatedly asking questions already answered.

The deeper problem is **loss of decision context**, not simply lack of documents.

## 3. Target Persona

Primary persona:

**Creative/digital agency team working with clients on website or design revisions.**

The MVP should remain focused on this persona.

## 4. Value Proposition

ClientOS turns historical client feedback into reusable decision intelligence.

Instead of:

> "What did the client say?"

it answers:

> "What does the client's history tell us to do now, and why?"

## 5. Core Workflow

```text
Receive feedback
      ↓
Identify decision/preference/rejection
      ↓
Persist memory
      ↓
Recall relevant memories later
      ↓
Generate recommendation
      ↓
Explain recommendation
      ↓
Capture outcome
      ↓
Improve future recommendation
```

## 6. MVP Features

### Client Dashboard

Displays:

- Client
- Project
- Decision count
- Preference count
- Rejection count
- Recent interactions

### Client Workspace

Displays:

- Current project
- Ask ClientOS
- Recent decisions
- Preferences
- Rejected ideas
- Open conflicts

### AI Workspace

Allows users to ask questions and receive memory-aware recommendations.

### Memory Timeline

Displays the evolution of client decisions over time.

### Why?

Every important recommendation can show the historical evidence behind it.

### Preference Conflict

When a new statement conflicts with historical memory, ClientOS asks the user to confirm the scope of the change.

## 7. Non-Goals

The MVP is not:

- A full CRM
- A project-management suite
- An email client
- A billing system
- A generic document-management product
- A generic ChatGPT clone
- An autonomous client communication platform

## 8. Success Criteria

The product succeeds if a judge can immediately observe:

**Before memory:** generic answer.

**After memory:** personalized answer.

**After learning:** future answer changes because of new confirmed information.

## 9. Future Scope

Possible future extensions:

- Email and meeting integrations
- Multi-project client memory
- Team handoff
- Approval workflows
- Client communication drafting
- Analytics on recurring revision patterns
- Decision confidence and provenance
