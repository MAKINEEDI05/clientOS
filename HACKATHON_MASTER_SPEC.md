> **Status of this document.** This is the original hackathon brief for ClientOS, kept as the
> statement of project intent. Two things to know when reading it:
>
> 1. **It is written as a set of instructions, not as a finished specification.** It describes
>    what ClientOS should be and what it must not become; it was never rewritten into a spec.
>    Its product direction, MVP scope, demo dataset and Definition of Done are authoritative
>    and were followed.
> 2. **Its claims about hackathon rules are unverified.** The judging weights and submission
>    requirements stated below were not confirmed against official Hack With Hyderabad 3.0
>    material. Treat them as this project's working assumptions, not as official rules.
>
> Two details did change during implementation, and the as-built documentation is correct where
> the two disagree: the LLM is `openai/gpt-oss-120b` rather than a Llama model (the specified
> model is not available on the Groq account — see `docs/PRODUCT_DECISIONS.md` Decision 17), and
> Design Review #1 in the demo dataset carries the colour restriction that Revision #6 later
> contradicts, without which the conflict scenario has nothing to detect.
>
> For what was actually built, see `README.md`, `ARCHITECTURE.md` and `HINDSIGHT_MEMORY.md`.

---

You are the lead technical architect and documentation engineer for our Hack With Hyderabad 3.0 hackathon project.

PROJECT:
ClientOS — Client Decision Memory Agent

IMPORTANT:
We already have existing ClientOS documentation in this repository. DO NOT simply create another generic document.

Your job is to FIRST inspect the entire existing documentation and repository, understand what is already defined, and then consolidate/update it into ONE authoritative master Markdown document.

==================================================
PRIMARY TASK
==================================================

Create:

HACKATHON_MASTER_SPEC.md

This file must become the SINGLE SOURCE OF TRUTH for the entire ClientOS project.

It must combine:

1. Hackathon rules
2. Hackathon constraints/restrictions
3. Hackathon judging criteria
4. Required submissions
5. Official resources
6. Project concept
7. ClientOS product requirements
8. Hindsight memory requirements
9. Technical architecture
10. Exact tech stack
11. MVP scope
12. Features
13. Data model
14. Agent behavior
15. Memory behavior
16. Demo scenario
17. Demo script
18. Build agenda
19. Development priorities
20. Security/safety boundaries
21. Definition of Done
22. Pre-demo checklist
23. Submission checklist

The purpose is that another AI coding agent should be able to read ONLY this file and understand exactly what ClientOS is, what the hackathon requires, what it must NOT do, what technologies we are using, and what must be completed.

==================================================
SOURCE OF TRUTH RULE
==================================================

Before writing anything:

1. Inspect all existing .md documentation in the repository.
2. Inspect the uploaded/original Hack With Hyderabad 3.0 problem statement if it is available in the repository or attached project files.
3. Inspect existing ClientOS documentation.
4. Reuse correct existing decisions.
5. Remove contradictions.
6. Do not silently invent hackathon rules.
7. Do not replace official hackathon terminology with your own terminology.
8. If something is NOT explicitly confirmed by the official hackathon material, label it clearly as:
   - PROJECT DECISION
   - RECOMMENDATION
   - ASSUMPTION
   - TO VERIFY
9. Do not present our assumptions as official hackathon rules.

The official hackathon material must take priority over our project preferences.

==================================================
SECTION 1 — HACKATHON OFFICIAL REQUIREMENTS
==================================================

Create a section:

# 1. Hack With Hyderabad 3.0 — Official Requirements

Include only information supported by the official problem statement.

Include:

- Hackathon theme:
  AI Agents That Learn Using Hindsight
- Required technology:
  Hindsight
- Why Hindsight is required
- Official Hindsight resources
- LLM rules/resources
- Coding-agent information
- Official project-selection guidance
- Official important rules
- Official submission requirements
- Official judging criteria

Preserve the official judging weights:

Innovation — 30%
Use of Hindsight Memory — 25%
Technical Implementation — 20%
User Experience — 15%
Real-world Impact — 10%

Do NOT change these values.

Explain what judges are looking for under each criterion using the official wording/meaning.

==================================================
SECTION 2 — HACKATHON RESTRICTIONS
==================================================

Create:

# 2. Rules, Restrictions & Things We Must Avoid

Separate this into:

## Official Restrictions

Only include restrictions explicitly supported by the official material.

## Project-Level Restrictions

These are our own decisions for ClientOS.

Examples:

- Do not build a generic CRM.
- Do not build a generic chatbot.
- Do not make chat the primary product.
- Do not make Hindsight a decorative feature.
- Do not build unnecessary integrations.
- Do not expand beyond the core client-revision workflow.
- Do not use real client/private data without permission.
- Do not expose API keys.
- Do not claim that memory was used if Hindsight failed.
- Do not turn one historical exception into a permanent universal rule.
- Do not make autonomous high-impact decisions on behalf of clients.

Clearly label these as PROJECT-LEVEL restrictions, not official hackathon rules.

==================================================
SECTION 3 — HACKATHON RESOURCES
==================================================

Create:

# 3. Official Resources

Include the official resources from the problem statement, such as:

- Hindsight documentation
- Hindsight GitHub
- Hindsight Cloud
- Hindsight community resources
- Hindsight OpenClaw integration if relevant
- LLM resources
- Recommended LLMs from the official material
- Coding-agent resources listed by the hackathon

IMPORTANT:

Do not invent URLs.

Do not claim that a resource is official unless the source says so.

If a URL is not available in the source, write:

[URL TO VERIFY]

==================================================
SECTION 4 — CLIENTOS PROJECT
==================================================

Create:

# 4. ClientOS

Use this exact product direction:

ClientOS is an AI agent that remembers client preferences, decisions, rejections, revision feedback, constraints, and changing requirements, then uses that persistent experience to make future client work more accurate.

Core pitch:

"ClientOS remembers why your clients decide."

Alternative:

"AI that remembers every client decision."

Do NOT turn ClientOS into a generic CRM.

==================================================
SECTION 5 — PROBLEM
==================================================

Explain:

- Client decisions get lost.
- Feedback is distributed across interactions.
- Rejected ideas can reappear.
- Teams forget WHY a decision was made.
- New team members lack historical context.
- Client preferences can change.
- Old and new preferences can conflict.

The deeper problem:

"The reasoning behind client decisions disappears over time."

==================================================
SECTION 6 — TARGET PERSONA
==================================================

Primary persona:

Creative/digital agency team working with clients on website/design revisions.

Primary workflow:

Client feedback → decision memory → future revision recommendation.

Keep this narrow.

==================================================
SECTION 7 — CORE PRODUCT LOOP
==================================================

Document this exact conceptual loop:

Client Interaction
↓
Identify meaningful decision/preference/rejection
↓
Retain in Hindsight
↓
Recall relevant history
↓
AI reasoning
↓
Recommendation
↓
Explain why
↓
User feedback/outcome
↓
Retain new learning
↓
Future recommendation improves

Explain that MEMORY MUST CHANGE THE AGENT'S BEHAVIOR.

==================================================
SECTION 8 — HINDSIGHT IS THE STAR
==================================================

This is one of the most important sections.

Explain exactly why ClientOS needs Hindsight.

Document:

### Retain

What ClientOS stores.

### Recall

How relevant historical client information is retrieved.

### Reflect

How accumulated experience can influence future reasoning.

Memory categories:

- Preferences
- Approvals
- Rejections
- Constraints
- Decisions
- Outcomes
- Preference changes

Explain:

A database containing chat messages is NOT enough.

The value comes from persistent memory being used during future reasoning.

==================================================
SECTION 9 — MEMORY RULES
==================================================

Define:

### Memory should be durable when it represents:

- Explicit client preference
- Explicit approval
- Explicit rejection
- Important decision
- Constraint
- Meaningful outcome
- Confirmed preference change

### Do NOT automatically store:

- Casual conversation
- Greetings
- Temporary wording
- Every sentence
- Unconfirmed assumptions

==================================================
SECTION 10 — MEMORY SCOPE
==================================================

Define scopes:

- Interaction
- Revision
- Project
- Client
- Future projects

If the system cannot determine the scope of a new preference, it should ask.

==================================================
SECTION 11 — CONFLICT HANDLING
==================================================

This is a core feature.

Example:

OLD:
"Avoid bright colors."

NEW:
"We are now open to brighter accent colors."

ClientOS must:

1. Detect the conflict.
2. Show the old memory.
3. Show the new statement.
4. Ask the user for scope.
5. Preserve historical memory.
6. Mark the confirmed new preference appropriately.

Example UI:

Preference Change Detected

Previous:
Avoid bright colors

New:
Brighter accent colors are acceptable

Apply to:

[This project]
[All future projects]
[This design direction]

==================================================
SECTION 12 — EXACT TECH STACK
==================================================

Lock the project to this stack unless there is a technical reason to change it:

Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS

Backend:
- Node.js
- Express
- TypeScript

AI:
- Groq
- LLM selected from the available/recommended models

Memory:
- Hindsight

Database:
- PostgreSQL

Version control:
- Git
- GitHub

Development:
- VS Code / Claude / coding agent

Deployment:
- Vercel for frontend
- Render for backend
- Hindsight Cloud for memory

IMPORTANT:
The hackathon explicitly permits coding agents according to the official material.

Do not add technologies just because they are popular.

If a technology becomes unnecessary, prefer removing it.

==================================================
SECTION 13 — ARCHITECTURE
==================================================

Document:

Frontend
↓
Backend API
↓
Agent orchestration
↓
Hindsight + LLM
↓
Recommendation
↓
User feedback
↓
Hindsight

Also explain what PostgreSQL stores versus what Hindsight stores.

PostgreSQL:
- users
- clients
- projects
- interactions metadata
- UI/application state
- IDs/reference metadata

Hindsight:
- durable experience
- preferences
- decisions
- rejections
- approvals
- outcomes
- learned context

Do not make PostgreSQL a replacement for Hindsight.

==================================================
SECTION 14 — MVP
==================================================

The MVP should contain ONLY:

1. Client dashboard
2. Client workspace
3. Interaction/feedback input
4. AI workspace
5. Hindsight memory
6. Memory timeline
7. Why/evidence explanation
8. Preference conflict detection
9. Updated recommendation after confirmed preference change

Do NOT expand the MVP unnecessarily.

==================================================
SECTION 15 — SCREENS
==================================================

Define the exact screens:

1. Dashboard
2. Client Workspace
3. AI Workspace
4. Memory Timeline

For each:

- Purpose
- Main UI elements
- User actions
- Data shown

==================================================
SECTION 16 — DEMO DATA
==================================================

Use ONE fictional client.

Client:
Vive Studio

Project:
Premium Website Redesign

History:

Meeting #1:
Premium positioning.

Design Review #1:
Minimal layouts.

Design Review #2:
Serif typography approved.

Revision #2:
Blue-heavy visual direction rejected.

Revision #3:
Heavy animation rejected.

Revision #4:
Shorter headlines requested.

Revision #5:
Customer proof above the fold approved.

Revision #6:
Client is now open to brighter accent colors.

Make this dataset consistent everywhere in the documentation.

==================================================
SECTION 17 — KILLER DEMO
==================================================

The demo must prove:

WITHOUT MEMORY:
Generic recommendation.

WITH MEMORY:
Same request → personalized recommendation.

AFTER NEW LEARNING:
Same request → recommendation changes again.

Core request:

"Create the next homepage direction for this client."

Expected memory-aware recommendations:

- Premium visual language
- Minimal layout
- Serif typography
- Short headlines
- Customer proof near the top
- Restrained animation
- Avoid previously rejected blue-heavy direction
- Allow brighter accents after confirmed preference change

==================================================
SECTION 18 — WHY / EVIDENCE
==================================================

Every important recommendation should be explainable.

Example:

Recommendation:
"Use restrained animation."

Why:
"Heavy animation was rejected during Revision #3."

Evidence:
Revision #3.

Explain that the exact memory/evidence influencing a recommendation should be visible in the UI where practical.

==================================================
SECTION 19 — AGENT BEHAVIOR
==================================================

Define the agent workflow:

1. Understand current request.
2. Identify client and project.
3. Recall relevant Hindsight memory.
4. Separate current preferences from historical context.
5. Identify conflicts.
6. Generate recommendation.
7. Explain relevant memory evidence.
8. Ask for confirmation when necessary.
9. Retain meaningful new outcome.
10. Use updated memory in future requests.

The agent must not hallucinate client history.

If no memory exists, it must say that.

==================================================
SECTION 20 — DEMO SCRIPT
==================================================

Write an exact 2–3 minute judge demo.

Structure:

0:00–0:20 Problem
0:20–0:50 Generic response
0:50–1:20 Hindsight history
1:20–1:50 Personalized response
1:50–2:10 Why/evidence
2:10–2:30 Preference conflict
2:30–2:50 Updated recommendation
2:50–3:00 Closing statement

Closing line:

"ClientOS doesn't just remember what the client said. It remembers what the client decided, why they decided it, and uses that experience in the next decision."

==================================================
SECTION 21 — BUILD AGENDA
==================================================

Create an 8-hour implementation plan.

Prioritize working functionality over documentation polish.

Suggested structure:

Hour 1:
Project setup + Hindsight connection + architecture

Hour 2:
Database + client/project models + demo dataset

Hour 3:
Hindsight retain/recall integration

Hour 4:
Agent + LLM integration

Hour 5:
Client workspace + AI workspace

Hour 6:
Memory timeline + Why/evidence + conflict handling

Hour 7:
End-to-end demo flow + deployment

Hour 8:
Testing + polish + demo recording + submission preparation

Make it clear which items are MUST HAVE and which are optional.

==================================================
SECTION 22 — PRIORITY SYSTEM
==================================================

Use:

P0 = Must work for judging
P1 = Important if time allows
P2 = Nice to have

P0 should include:

- Hindsight integration
- Memory retention
- Memory recall
- Memory-aware recommendation
- Demo dataset
- Why/evidence
- Preference conflict
- Working UI
- Deployment
- README
- Demo video
- Live demo

P1:

- Better visualizations
- Advanced filtering
- More polished memory timeline

P2:

- External integrations
- Email
- Calendar
- CRM integration
- Multi-tenant SaaS
- Advanced analytics

==================================================
SECTION 23 — SECURITY & SAFETY
==================================================

Document:

- Never commit API keys.
- Use .env.
- Never expose secrets in frontend.
- Use synthetic demo data.
- Do not expose real client information.
- Do not allow the agent to autonomously send client communications in the MVP.
- Recommendations are advisory.
- Confirm important preference changes.
- Preserve historical context.

==================================================
SECTION 24 — WHAT WE ARE NOT BUILDING
==================================================

Explicitly list:

- Full CRM
- Full project management system
- Email platform
- Billing platform
- Calendar platform
- Generic chatbot
- Generic RAG document search
- Autonomous client communication
- Multi-agent enterprise platform
- Unnecessary external integrations

==================================================
SECTION 25 — SUBMISSION REQUIREMENTS
==================================================

Use only the official hackathon material for official requirements.

Document:

- GitHub repository
- Demo video
- Live project demo
- Required content deliverables
- Explanation of Hindsight usage

Clearly separate official requirements from our own preparation checklist.

==================================================
SECTION 26 — FINAL SUBMISSION CHECKLIST
==================================================

Create a checkbox list:

PROJECT:
[ ] ClientOS works end-to-end
[ ] Hindsight works
[ ] Memory changes recommendations
[ ] Conflict handling works
[ ] Why/evidence works
[ ] Demo data works
[ ] UI polished

TECHNICAL:
[ ] No exposed secrets
[ ] Backend deployed
[ ] Frontend deployed
[ ] Hindsight production/demo instance works
[ ] Error handling works

DOCUMENTATION:
[ ] README
[ ] Hindsight explanation
[ ] Architecture
[ ] Setup instructions
[ ] Demo script

SUBMISSION:
[ ] GitHub repo
[ ] Demo video
[ ] Live demo
[ ] Required content deliverables
[ ] Hindsight explanation

==================================================
SECTION 27 — DEFINITION OF DONE
==================================================

ClientOS is considered ready only when a judge can see this complete sequence:

1. Client has historical decisions.
2. Hindsight stores those decisions.
3. User asks for a new task.
4. ClientOS recalls relevant history.
5. Recommendation changes because of history.
6. ClientOS explains why.
7. Client changes a preference.
8. ClientOS detects the conflict.
9. User confirms scope.
10. Future recommendation changes again.

If this sequence does not work, the project is NOT demo-ready.

==================================================
IMPORTANT DOCUMENTATION RULE
==================================================

Do NOT delete the existing documentation.

Instead:

1. Read it.
2. Reconcile it.
3. Update it where necessary.
4. Keep useful detailed documents.
5. Make HACKATHON_MASTER_SPEC.md the authoritative source.

At the top of every existing documentation file, add a short note:

> See `HACKATHON_MASTER_SPEC.md` for the authoritative project requirements and hackathon constraints.

Do not duplicate contradictory information across documents.

==================================================
FINAL OUTPUT
==================================================

After creating/updating the documentation:

1. Create `HACKATHON_MASTER_SPEC.md`.
2. Update the existing documentation to point to it.
3. Do NOT modify application source code yet.
4. Do NOT install packages yet.
5. Do NOT create unnecessary files.
6. Do NOT invent official hackathon rules.
7. Do NOT claim anything is officially allowed unless supported by the source material.
8. Report exactly which documentation files were created or modified.
9. Give a short list of contradictions you found and how you resolved them.
10. Give a final "PROJECT LOCK" summary containing:
   - Product
   - Persona
   - Workflow
   - Hindsight role
   - Tech stack
   - MVP
   - Demo story
   - P0 features
   - Official submission requirements

The goal is to leave the repository with one authoritative document that any future coding agent can read before making changes