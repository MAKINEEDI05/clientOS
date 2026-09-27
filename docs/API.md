# ClientOS — API Design

This document defines the conceptual API contract. Exact routes can be adapted during implementation.

## Clients

### GET /api/clients

Returns available clients.

### GET /api/clients/:clientId

Returns client/project information.

---

## Interactions

### POST /api/clients/:clientId/interactions

Records a new client interaction.

Example request:

```json
{
  "projectId": "website-redesign",
  "source": "design-review",
  "content": "The client rejected heavy animations and wants shorter headlines."
}
```

Response should include an interaction identifier and memory-processing status.

---

## Agent

### POST /api/agent/respond

Generates a memory-aware recommendation.

Example:

```json
{
  "clientId": "vive-studio",
  "projectId": "website-redesign",
  "message": "Create the next homepage direction."
}
```

Conceptual response:

```json
{
  "answer": "...",
  "memories": [
    {
      "source": "Revision #3",
      "reason": "Heavy animation was rejected."
    }
  ]
}
```

---

## Memory

### GET /api/clients/:clientId/memory

Returns memory information suitable for the memory timeline.

### POST /api/clients/:clientId/memory/confirm

Confirms a newly detected preference or decision and its scope.

Example:

```json
{
  "statement": "Bright accent colors are acceptable.",
  "scope": "project"
}
```

---

## Conflicts

### GET /api/clients/:clientId/conflicts

Returns unresolved preference conflicts.

### POST /api/conflicts/:conflictId/resolve

Resolves a detected conflict.

Example:

```json
{
  "resolution": "new_preference",
  "scope": "project"
}
```

## API Principles

- Validate all inputs.
- Keep API keys server-side.
- Return useful error messages.
- Never claim memory was used when Hindsight failed.
- Keep Hindsight operations behind a backend service layer.
