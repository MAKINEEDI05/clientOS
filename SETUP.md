# ClientOS — Setup Guide

## 1. Prerequisites

Install:

- Node.js
- npm/pnpm/yarn
- Git

You also need:

- Hindsight access
- An LLM API key
- Any database required by the implementation

## 2. Clone

```bash
git clone <repository-url>
cd ClientOS
```

## 3. Install Dependencies

Use the package manager selected by the project.

Example:

```bash
npm install
```

## 4. Environment Variables

Create a local environment file based on the implementation.

Conceptually:

```env
HINDSIGHT_API_KEY=
HINDSIGHT_BASE_URL=

LLM_API_KEY=
LLM_MODEL=

DATABASE_URL=

PORT=5000
```

Do not commit real credentials.

## 5. Hindsight

Create/configure a Hindsight instance according to the current official Hindsight documentation.

The application should verify the connection before the demo.

## 6. LLM

Configure the selected LLM provider and model.

The agent should be able to:

- Interpret user requests
- Extract durable memories
- Generate recommendations
- Explain recommendations
- Detect preference conflicts

## 7. Run

Example:

```bash
npm run dev
```

Run frontend and backend according to the project's actual scripts.

## 8. Demo Data

Load the prepared fictional client dataset described in:

`docs/DEMO_DATA.md`

## 9. Verification Checklist

Before the demo:

- [ ] Frontend loads
- [ ] Backend responds
- [ ] Hindsight connection works
- [ ] Memory can be retained
- [ ] Relevant memory can be recalled
- [ ] Recommendation uses recalled memory
- [ ] Why/evidence display works
- [ ] Preference conflict detection works
- [ ] New confirmed preference changes future recommendation
- [ ] No API keys are exposed
- [ ] Demo data is loaded

## 10. Production/Hackathon Note

Use synthetic client information for the public demo unless you have permission to use real client data.
