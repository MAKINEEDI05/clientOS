# ClientOS — Client Decision Memory Agent

> **Remember why your clients decide.**

ClientOS is an AI agent that remembers client preferences, approvals, rejections, revision feedback, and changing requirements, then uses that history to make future client work more accurate.

## The Core Idea

A normal AI responds to the current request.

ClientOS responds using:

**Current request + relevant client history + previous outcomes**

The central experience is:

> **Old decision → new request → recalled memory → better recommendation**

## Problem

Client-facing teams repeatedly lose the reasoning behind decisions. Feedback is scattered across meetings, chats, emails, and revisions. As work continues, teams can repeat rejected ideas or forget why an approach was approved.

## Solution

ClientOS creates persistent client decision memory using Hindsight.

It remembers:

- Preferences
- Approvals
- Rejections
- Constraints
- Revision feedback
- Decision history
- Preference changes
- Outcomes

It then recalls relevant memories when generating the next recommendation.

## Example

A client previously rejected:

- Blue-heavy visual direction
- Heavy animations
- Long headlines

Later, a designer asks:

> "Create the next homepage direction."

ClientOS recalls the previous decisions and recommends a minimal premium direction while avoiding the rejected approaches.

It can also explain:

> "I avoided heavy animation because it was rejected during Revision #2."

## Core Hindsight Loop

```text
Client Interaction
       ↓
Extract meaningful decision
       ↓
Hindsight memory
       ↓
Recall relevant history
       ↓
AI recommendation
       ↓
Client feedback / outcome
       ↓
Updated Hindsight memory
```

## MVP

1. Client dashboard
2. Client workspace
3. Interaction/feedback input
4. AI agent
5. Hindsight memory
6. Memory timeline
7. "Why?" explanation
8. Preference-conflict detection

## Documentation

- [Project Overview](PROJECT_OVERVIEW.md)
- [Hindsight Memory](HINDSIGHT_MEMORY.md)
- [Architecture](ARCHITECTURE.md)
- [Demo Script](DEMO_SCRIPT.md)
- [Setup](SETUP.md)
- [Product Decisions](docs/PRODUCT_DECISIONS.md)
- [API](docs/API.md)
- [Demo Data](docs/DEMO_DATA.md)

## Tech Stack

The implementation should use a web frontend, backend agent service, LLM provider, Hindsight for persistent memory, and an optional database for application metadata.

Exact technologies can be selected during implementation.

## Hackathon Focus

ClientOS is intentionally narrow. It focuses on one persona and one workflow: **client-facing teams managing website/design revisions**.

The most important feature is not chat. It is the fact that memory changes the agent's future behavior.

## Demo Goal

The judge should understand three states:

1. Generic recommendation without client history.
2. Personalized recommendation after Hindsight recall.
3. Changed recommendation after a new client preference is learned.

## Status

Hackathon MVP — ClientOS.
