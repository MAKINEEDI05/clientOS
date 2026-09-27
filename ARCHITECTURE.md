# ClientOS — Technical Architecture

## 1. Architecture Goal

The architecture should keep the application simple while making Hindsight central to the agent's reasoning loop.

## 2. High-Level Architecture

```text
                    CLIENTOS
                       │
             ┌─────────┴─────────┐
             │                   │
        Current Request      Hindsight
             │                   │
             │          Client Decision Memory
             │          Preferences
             │          Rejections
             │          Constraints
             │          Outcomes
             │                   │
             └─────────┬─────────┘
                       ↓
                   AI Agent
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
       Recommendation        Explanation
             │
             ↓
       User Feedback
             │
             ↓
          Hindsight
```

## 3. Application Layers

### Frontend

Responsibilities:

- Client dashboard
- Client workspace
- AI conversation
- Memory timeline
- Recommendation cards
- Why/evidence display
- Preference conflict UI

### Backend

Responsibilities:

- Authentication/session handling if required
- Client/project APIs
- Agent orchestration
- Hindsight calls
- LLM calls
- Memory extraction
- Conflict handling
- Recommendation generation

### Hindsight

Responsibilities:

- Persistent client experience memory
- Recall of relevant historical context
- Long-term memory used by the agent

### Database

Optional application database for structured metadata such as:

- Users
- Clients
- Projects
- Interaction IDs
- UI state
- Hindsight reference metadata

The database should not replace Hindsight as the core memory mechanism.

## 4. Agent Flow

```text
User request
    ↓
Identify client/project
    ↓
Recall relevant Hindsight memories
    ↓
Build reasoning context
    ↓
LLM generates recommendation
    ↓
Attach evidence / memory references
    ↓
Return recommendation
    ↓
User approves/corrects
    ↓
Retain meaningful outcome in Hindsight
```

## 5. New Interaction Flow

```text
New client feedback
       ↓
LLM identifies possible durable memory
       ↓
Check for conflicting memory
       ↓
If scope is ambiguous → ask user
       ↓
If confirmed → retain in Hindsight
```

## 6. Main Components

Suggested conceptual modules:

```text
client/
project/
interaction/
memory/
agent/
recommendation/
conflict/
```

## 7. Error Handling

The system should handle:

- Hindsight unavailable
- LLM timeout
- Invalid LLM response
- Missing client/project
- Empty memory recall
- Conflicting preferences
- Duplicate interaction submission

If Hindsight is temporarily unavailable, the UI should clearly indicate that the memory-aware response could not be completed rather than silently pretending memory was used.

## 8. Security

Do not expose API keys in the frontend.

Use server-side environment variables.

Avoid exposing unnecessary client information in logs.

Use appropriate authentication if the deployed MVP handles real user data.

For the hackathon demo, use synthetic client data unless permission exists to use real client information.

## 9. Deployment

A simple deployment can use:

```text
Frontend
   ↓
Hosted web application

Backend
   ↓
Hosted API

Hindsight
   ↓
Hindsight Cloud / self-hosted instance

LLM
   ↓
Configured provider
```

Exact providers should be selected during implementation.
