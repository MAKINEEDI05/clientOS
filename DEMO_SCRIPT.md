# ClientOS — Hackathon Demo Script

## Demo Objective

Show one idea:

> **ClientOS gets better because it remembers what the client decided before.**

Target duration: **2–3 minutes**.

---

# Scene 1 — The Problem

Say:

> "AI can generate a website concept. But if it doesn't remember why a client rejected the previous concept, it keeps starting from zero."

Open the AI workspace.

Ask:

> Create a homepage direction for this client.

Show a generic recommendation.

Do not spend too long here.

---

# Scene 2 — Load Client History

Show the Client Memory timeline.

Use these interactions:

```text
Meeting #1
Client wants premium positioning.

Design Review #1
Client prefers minimal layouts.

Design Review #2
Client approves serif typography.

Revision #2
Client rejects blue-heavy visual direction.

Revision #3
Client rejects heavy animations.

Revision #4
Client wants shorter headlines.

Revision #5
Client approves customer proof above the fold.
```

Say:

> "These are not just chat messages. ClientOS turns meaningful decisions into persistent memory using Hindsight."

---

# Scene 3 — Same Request Again

Ask:

> Create the next homepage direction for this client.

Expected response:

```text
Recommended Direction

• Premium visual language
• Minimal layout
• Serif typography
• Short headline
• Customer proof above the fold
• Restrained animation
• Avoid blue-heavy direction
```

Show:

> Based on previous client decisions.

Say:

> "The request is almost identical, but the answer is different because the agent remembers the client's history."

---

# Scene 4 — The Why Moment

Click **Why?** on one recommendation.

Example:

```text
Recommendation:
Restrained animation

Why:
Heavy animation was rejected during Revision #3.

Evidence:
Revision #3
```

Say:

> "The important part is not only that it remembers. It can explain why it made the recommendation."

---

# Scene 5 — Client Changes Their Mind

Add:

> "We're now open to brighter accent colors."

ClientOS should detect a conflict.

Show:

```text
Preference Change Detected

Previous:
Avoid bright colors

New:
Bright accent colors are acceptable

Apply to:
[This project]
[All future projects]
[This design direction]
```

Confirm:

**This project**

---

# Scene 6 — Memory Changes Again

Ask:

> Create the next homepage direction.

Show that the recommendation now permits brighter accents while preserving the client's other historical preferences.

Say:

> "The old memory wasn't deleted. The agent learned that the preference changed for this project."

---

# Closing

Say:

> "ClientOS doesn't just remember what the client said. It remembers what the client decided, why they decided it, and uses that experience in the next decision."

## Backup Demo

If live Hindsight fails:

Use a prepared demo dataset and clearly show the stored memory and expected recommendation flow. Do not claim a live memory operation occurred if it did not.
