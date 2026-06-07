# Relay — Submission README

## Demo

**Live site:** https://relay-ten-beta.vercel.app

### Quick demo walkthrough
1. Sign in with a SpacetimeDB account
2. Create a room — choose **Interview** or **Study session**, set AI policy
3. Share the candidate/member link with another person (or open in a second browser tab)
4. Both participants see every keystroke in real time
5. Hit **Run** to execute JavaScript or Python in-browser
6. Use the AI panel on the right — behaviour is governed by the policy set at room creation

### Run locally
```bash
git clone https://github.com/Ayushhh26/relay.git
cd relay
npm install

# Start the frontend dev server (connects to maincloud SpacetimeDB)
npm run dev
```

For local SpacetimeDB (optional):
```bash
# Publish module to local instance
spacetime publish relay-demo

# Update VITE_SPACETIMEDB_URI in .env.local to ws://localhost:3000
```

---


---

## Project Description

**Relay** is a real-time technical interview and study platform built on SpacetimeDB.

### The problem
Technical interviews are broken in two ways:
- **For interviewers:** juggling Zoom + CoderPad + a shared doc is clunky, and there's no control over how much AI help the candidate gets
- **For candidates and study groups:** practicing in a realistic interview environment, with the right level of AI guidance (not just "here's the full solution"), is hard to find

### The solution
Relay puts everything in one room — live collaborative code editing, video, code execution, and a policy-controlled AI assistant — with no external tools needed.

### Modes

**Interview mode**
- Interviewer creates the room and picks a question from the question bank (12 problems, Easy → Medium, with test harnesses)
- Candidate joins via a shareable link and writes code in the shared editor
- Interviewer observes every keystroke in real time
- The AI assistant is constrained by the policy the interviewer chose at room creation

**Study session mode**
- Everyone edits the same document simultaneously
- Supports a rich-text notepad or a code editor with terminal
- AI is in open mode — acts as a coding tutor

### AI policy system (the unique differentiator)
The room creator sets one of three AI policies before the session starts:

| Policy | What the AI does |
|--------|-----------------|
| **Syntax-only** | Gives syntax snippets only for constructs the user explicitly names. Refuses conceptual questions. |
| **Nudge-only** | Responds with Socratic questions only. Never writes code or names a data structure. |
| **Open** | Full coding assistant — explains, debugs, teaches. |

The policy is enforced server-side via system prompts on every request — the candidate cannot bypass it.

### Feature summary
- Real-time collaborative code editor (SpacetimeDB-synced, sub-100ms)
- Built-in WebRTC video call (metered.ca TURN relay)
- JavaScript and Python execution in-browser (Pyodide for Python)
- 12 interview questions with difficulty ratings and auto-graded test harnesses
- Rich-text notepad mode (Tiptap) for study sessions
- Presence indicators with heartbeat-based stale detection
- SpacetimeDB OIDC auth integration
- Fully serverless — frontend on Vercel, AI API on Vercel serverless functions, state on SpacetimeDB maincloud

### Tech stack
| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Real-time state | SpacetimeDB (maincloud) |
| AI API | Vercel serverless function → NVIDIA NIM (Llama 3.3 70B) |
| Video | WebRTC + metered.ca TURN |
| Python execution | Pyodide (WASM) |
| Rich text | Tiptap |
| Auth | SpacetimeDB OIDC |

---

## Repository

https://github.com/Ayushhh26/relay
