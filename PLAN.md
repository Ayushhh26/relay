# Relay: End-to-End Plan

**Relay: transparent AI assist for coding interviews.**
Twelve hours, solo. SpacetimeDB Launchpad, NY Tech Week.

One-liner: Relay lets candidates use scoped AI help during live coding interviews while every assist is classified, shared, and audited in real time, so interviewers evaluate problem solving instead of hidden AI usage.

---

## The three goals, and how each is actually won

**Best Web App** is won by the real-time wow, not the idea. Four browser windows syncing the editor, the assist log, and the terminal at once is the thing that wins the room. This rides entirely on a clean, non-glitchy demo. Polish and reliability beat scope.

**Best LLM Use Case** is won by the thesis, not the model doing tricks. The pitch is "AI help in interviews is inevitable, so we make it scoped, visible, and auditable, with enforcement in a layer we control rather than trusting the model to police itself." The audit log living in shared SpacetimeDB state is what makes this an LLM story and a SpacetimeDB story at the same time.

**Best Student Team** rides on execution and a clear narrative more than the idea. Most winnable of the three. Tight demo, obviously student-built, clean story. Don't overthink it.

The SpacetimeDB-native part is your connective tissue across all three: the assist log is not the code table, it is the truth of the interview, and every participant subscribes to it live.

---

## Locked stack (do not reopen)

| Part | Where | Note |
|---|---|---|
| Real-time backend | SpacetimeDB Maincloud | tables, reducers, subscriptions |
| Frontend | Vite React, from the STDB React quickstart | not Next.js, keep the quickstart's working codegen |
| LLM key | one standalone Vercel serverless function | never in a `VITE_` variable |
| Code execution | browser Web Worker, JavaScript only | no Python/Java/Docker |
| Assist write path | browser calls `finalize_assist_log` reducer | skip giving the serverless function its own STDB identity |

The serverless function returns `{response, tag}` to the browser. The browser writes the log row. The function only holds the key and calls the model.

---

## Locked scope

Two things must work before anything else is touched.

1. **Shared editor syncing across windows.** One `document` row per room, whole-content replace on a ~200ms debounce, everyone subscribes. Candidate writes, others watch. No patches, no OT, no multi-writer.
2. **One assist firing into a shared, tagged log visible in every window.** Serverless single-shot call, returns response plus a deterministic policy tag, writes one `assist_log` row, lands live in every window via subscription.

Those two give you Best Web App and the LLM thesis. Everything below is priority-ordered stretch. Cut from the bottom the moment anything above wobbles.

| Priority | Feature | Build only if |
|---|---|---|
| 3 | Run output, JS web worker to `run_output` rows, synced | core two are rock solid |
| 4 | Presence dots and role labels | cheap, slot in anytime |
| 5 | Remote cursors | run output works and time remains |
| CUT | streaming, `assist_chunk`, self-classification as enforcement, policy modes UI, notes, summary view, multi-language | not in 12h |

The model's own self-tag, if you ever add it, is logged as an untrusted signal next to the deterministic tag. It is never the thing that enforces. This is a 30-spare-minutes garnish, not a feature.

---

## Minimum tables

```
room          id, title, status, created_by, created_at
participant   id, room_id, identity, display_name, role, active
document      id, room_id, content, version, updated_by, updated_at
assist_log    id, room_id, requested_by, prompt_text, response_text,
              assist_type, policy_status, created_at
run_output    id, room_id, seq, stream, text, ts        (stretch)
```

Reducers: `join_room`, `update_document`, `finalize_assist_log`, `append_run_output` / `clear_run_output` (stretch), plus the built-in connect/disconnect hooks for presence.

The web worker runs the JS in the browser and captures console output. SpacetimeDB only syncs that output, it never runs user code. There is no `run_code` reducer, and that wording matters when a judge asks.

The deterministic tag is computed in the serverless function with simple checks: response length, presence of a full function definition, a loop over the input, a return matching the problem shape. Tag is `syntax` / `nudge` / `solution-leaning`. That tag, plus interviewer policy, decides `policy_status`.

---

## The clock

Real buffer at the end, because STDB setup always bites first.

| Hr | Goal | Red flag |
|---|---|---|
| 1-2 | Scaffold, Maincloud connection, one table syncing across two tabs | by hour 3, debug only this, nothing else |
| 3-4 | `document` row, debounced whole-content sync, editor mounted | |
| 5 | `room` + `participant`, join by URL, role labels | |
| 6-7 | Serverless LLM call, deterministic tag, `assist_log` row syncing to all windows | this is your LLM prize, protect it |
| 8 | Wire the downgraded-answer path (not a refusal) | |
| 9 | Stretch: run output | drop instantly if 6-7 ran over |
| 10 | Polish: auto-scroll log, loading state, seed room | |
| 11 | Cut flaky features, freeze the build | |
| 12 | Rehearse the demo twice, end to end | |

---

## Demo script (~90 seconds, visual not talky)

1. Open three windows: Candidate, Interviewer, Observer.
2. Candidate briefly states the approach out loud (one sentence, then move).
3. Candidate asks: "what is the JavaScript Map syntax?" Scoped syntax card appears live in all three windows. Log gets a green `syntax / allowed` tag.
4. Candidate asks for the full solution. Policy is syntax-only, so the response is still just a scoped syntax card, and the log shows "requested: solution, delivered: syntax, policy enforced." Show the product working, not the AI refusing.
5. Candidate writes the actual code, hits Run. Terminal output syncs across all three windows.
6. Close on the assist log: every AI interaction in the room, classified and visible.

The money shot is step 3 and step 5: a thing appearing live in every window at once.

---

## Judge Q&A defenses

"Isn't this still helping too much?" The interviewer sets the policy, and every assist is shared and logged, so there is no hidden help. Relay is for interviews where scoped help is allowed and problem solving is still evaluated.

"What happens when the classifier is wrong?" It is wrong regularly, which is exactly why we do not trust the model to police itself. Enforcement is a deterministic layer we control, the model's self-assessment is treated as an untrusted signal, and we log both so you can see when they disagree.

"Why SpacetimeDB?" The audit log is not just synced text, it is the shared truth of the interview, and every participant subscribes to the same room state live. That is the whole product.

"The browser writes the log, can't it tamper with it?" In production the Vercel function writes the assist log directly using a server identity. For this build we optimized the write path for demo speed. (Say this line, do not build it.)

---

## Two non-negotiables

1. **Stop touching the positioning and the name.** It is good. It is locked. Do not open that doc again.
2. **Freeze the build at hour 11 regardless of state.** A demo rehearsed twice on a smaller feature set beats a bigger one you are still wiring at 1:55pm.

One decision before you write a line: editor is candidate-writes, others-watch. That saves you the single biggest time sink. Confirmed, go.

---

## Phase Plans

> For agentic workers: use `superpowers:executing-plans` to run these tasks step-by-step.

---

### Phase 1 (Hr 1–2): Scaffold + Maincloud connection + one table syncing

**Goal:** Two browser tabs showing the same live row from SpacetimeDB Maincloud — proves the plumbing works before anything else is built.

**Files:**
- Create: `relay-module/src/lib.rs` — minimal SpacetimeDB Rust module
- Create: `relay-client/` — Vite React project (from SpacetimeDB quickstart)
- Create: `relay-client/src/module_bindings/` — generated TypeScript bindings (auto-generated, do not hand-edit)

---

- [ ] **Step 1.1 — Install the SpacetimeDB CLI**

```bash
curl -fsSL https://install.spacetimedb.com | bash
spacetime version   # expect 2.x.x
```

- [ ] **Step 1.2 — Log in to Maincloud**

```bash
spacetime login
spacetime server list   # confirm maincloud is listed
```

- [ ] **Step 1.3 — Init the Rust module**

```bash
mkdir relay && cd relay
spacetime init --lang rust relay-module
```

Replace the generated `relay-module/src/lib.rs` with:

```rust
use spacetimedb::{Identity, ReducerContext, Table};

#[spacetimedb::table(name = room, public)]
pub struct Room {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub title: String,
    pub created_by: Identity,
    pub created_at: u64,
}

#[spacetimedb::reducer]
pub fn create_room(ctx: &ReducerContext, title: String) {
    ctx.db.room().insert(Room {
        id: 0,
        title,
        created_by: ctx.sender,
        created_at: ctx.timestamp.micros_since_unix_epoch() as u64,
    });
}
```

- [ ] **Step 1.4 — Build and publish to Maincloud**

```bash
cd relay-module
spacetime build
spacetime publish --server maincloud relay-demo
```

Note the database address printed. It will be needed as the `DB` constant in the client.

- [ ] **Step 1.5 — Scaffold the React client**

```bash
cd ..
npm create vite@latest relay-client -- --template react-ts
cd relay-client
npm install
npm install @clockworklabs/spacetimedb-sdk
```

- [ ] **Step 1.6 — Generate TypeScript bindings**

```bash
spacetime generate --lang typescript \
  --out-dir src/module_bindings \
  --server maincloud \
  --database relay-demo
```

- [ ] **Step 1.7 — Connect and subscribe in App.tsx**

Replace `relay-client/src/App.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { DbConnection, Room } from './module_bindings'

const HOST = 'wss://maincloud.spacetimedb.com'
const DB = 'relay-demo'

export default function App() {
  const [rooms, setRooms] = useState<Room[]>([])

  useEffect(() => {
    const conn = DbConnection.builder()
      .withUri(HOST)
      .withModuleName(DB)
      .onConnect((ctx) => {
        ctx.db.room.onInsert((_ctx, row) => {
          setRooms(prev => [...prev, row])
        })
        ctx.subscriptionBuilder()
          .onApplied(() => {
            setRooms([...ctx.db.room.iter()])
          })
          .subscribe('SELECT * FROM room')
      })
      .build()
    return () => conn.disconnect()
  }, [])

  return (
    <div>
      <h1>Relay</h1>
      <ul>{rooms.map(r => <li key={String(r.id)}>{r.title}</li>)}</ul>
    </div>
  )
}
```

- [ ] **Step 1.8 — Start the dev server and verify two-tab sync**

```bash
npm run dev
```

Open two tabs at `http://localhost:5173`. In a terminal, call the reducer:

```bash
spacetime call relay-demo create_room '["Test Room"]'
```

Both tabs must show "Test Room" appear without a page refresh.

**Red flag:** if only one tab updates, the subscription is not live — check the `subscribe()` query string and the `onApplied` handler.

- [ ] **Step 1.9 — Commit**

```bash
git init && git add -A && git commit -m "phase 1: scaffold + maincloud sync verified"
```

---

### Phase 2 (Hr 3–4): Document row + debounced editor sync

**Goal:** Candidate types in a code editor; everyone else watching the same room sees the content update live within ~200 ms.

**Files:**
- Modify: `relay-module/src/lib.rs` — add `document` table + `update_document` reducer
- Create: `relay-client/src/Editor.tsx` — CodeMirror editor component
- Modify: `relay-client/src/App.tsx` — subscribe to document, debounce writes

---

- [ ] **Step 2.1 — Add `document` table and reducer to lib.rs**

Add to `relay-module/src/lib.rs` (keep the existing `room` code):

```rust
#[spacetimedb::table(name = document, public)]
pub struct Document {
    #[primary_key]
    pub room_id: u64,
    pub content: String,
    pub version: u64,
    pub updated_by: Identity,
    pub updated_at: u64,
}

#[spacetimedb::reducer]
pub fn update_document(ctx: &ReducerContext, room_id: u64, content: String) {
    let version = match ctx.db.document().room_id().find(room_id) {
        Some(doc) => {
            ctx.db.document().room_id().delete(room_id);
            doc.version + 1
        }
        None => 0,
    };
    ctx.db.document().insert(Document {
        room_id,
        content,
        version,
        updated_by: ctx.sender,
        updated_at: ctx.timestamp.micros_since_unix_epoch() as u64,
    });
}
```

- [ ] **Step 2.2 — Rebuild, publish, regenerate bindings**

```bash
cd relay-module && spacetime build && spacetime publish --server maincloud relay-demo
cd ../relay-client
spacetime generate --lang typescript \
  --out-dir src/module_bindings \
  --server maincloud \
  --database relay-demo
```

- [ ] **Step 2.3 — Install CodeMirror**

```bash
npm install codemirror @codemirror/lang-javascript @codemirror/theme-one-dark
```

- [ ] **Step 2.4 — Create Editor.tsx**

Create `relay-client/src/Editor.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

interface Props {
  value: string
  onChange: (val: string) => void
  readOnly?: boolean
}

export function Editor({ value, onChange, readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    viewRef.current = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !readOnly) {
            onChange(update.state.doc.toString())
          }
        }),
      ],
      parent: containerRef.current,
    })
    return () => viewRef.current?.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync remote content into the editor without clobbering the local cursor
  useEffect(() => {
    const view = viewRef.current
    if (!view || readOnly) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value, readOnly])

  return <div ref={containerRef} style={{ height: '100%' }} />
}
```

- [ ] **Step 2.5 — Wire editor into App.tsx with debounced sync**

Replace `relay-client/src/App.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { DbConnection, Document } from './module_bindings'
import { Editor } from './Editor'

const HOST = 'wss://maincloud.spacetimedb.com'
const DB = 'relay-demo'
const ROOM_ID = 1n   // hardcoded for now; Phase 3 reads this from the URL

export default function App() {
  const [content, setContent] = useState('')
  const connRef = useRef<DbConnection | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const conn = DbConnection.builder()
      .withUri(HOST)
      .withModuleName(DB)
      .onConnect((ctx) => {
        connRef.current = ctx

        ctx.db.document.onInsert((_ctx, doc: Document) => {
          if (doc.roomId === ROOM_ID) setContent(doc.content)
        })
        ctx.db.document.onUpdate((_ctx, _old: Document, doc: Document) => {
          if (doc.roomId === ROOM_ID) setContent(doc.content)
        })

        ctx.subscriptionBuilder()
          .onApplied(() => {
            const doc = [...ctx.db.document.iter()].find(d => d.roomId === ROOM_ID)
            if (doc) setContent(doc.content)
          })
          .subscribe('SELECT * FROM document')
      })
      .build()
    return () => conn.disconnect()
  }, [])

  function handleChange(val: string) {
    setContent(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      connRef.current?.reducers.updateDocument(ROOM_ID, val)
    }, 200)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ margin: '8px 16px' }}>Relay</h2>
      <div style={{ flex: 1 }}>
        <Editor value={content} onChange={handleChange} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2.6 — Verify two-tab live sync**

Open two tabs. Type in one; the other must update within ~200 ms.

**Red flag:** if the editor re-renders on every keystroke and the cursor jumps, check that the `useEffect` that syncs remote content is guarded by `current !== value` so it does not fire while the local user is typing.

- [ ] **Step 2.7 — Commit**

```bash
git add -A && git commit -m "phase 2: editor + debounced document sync"
```

---

### Phase 3 (Hr 5): Room + participant + URL join + role labels

**Goal:** Three browser windows each with a role (candidate / interviewer / observer) join a room by URL and see each other's presence dots.

**Files:**
- Modify: `relay-module/src/lib.rs` — add `participant` table, `join_room` reducer, disconnect lifecycle hook
- Modify: `relay-client/src/App.tsx` — read room ID and role from URL, call `join_room`, subscribe to participants

---

- [ ] **Step 3.1 — Add participant table and reducers**

Add to `relay-module/src/lib.rs`:

```rust
#[spacetimedb::table(name = participant, public)]
pub struct Participant {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub room_id: u64,
    pub identity: Identity,
    pub display_name: String,
    pub role: String,
    pub active: bool,
}

#[spacetimedb::reducer]
pub fn join_room(ctx: &ReducerContext, room_id: u64, display_name: String, role: String) {
    // Remove stale entries for this identity in this room
    let stale: Vec<_> = ctx.db.participant()
        .iter()
        .filter(|p| p.identity == ctx.sender && p.room_id == room_id)
        .collect();
    for p in stale {
        ctx.db.participant().id().delete(p.id);
    }

    ctx.db.participant().insert(Participant {
        id: 0,
        room_id,
        identity: ctx.sender,
        display_name,
        role,
        active: true,
    });

    // Seed an empty document if one does not already exist
    if ctx.db.document().room_id().find(room_id).is_none() {
        ctx.db.document().insert(Document {
            room_id,
            content: String::new(),
            version: 0,
            updated_by: ctx.sender,
            updated_at: ctx.timestamp.micros_since_unix_epoch() as u64,
        });
    }
}

#[spacetimedb::reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext) {
    let active: Vec<_> = ctx.db.participant()
        .iter()
        .filter(|p| p.identity == ctx.sender && p.active)
        .collect();
    for p in active {
        ctx.db.participant().id().update(Participant { active: false, ..p });
    }
}
```

- [ ] **Step 3.2 — Rebuild, publish, regenerate bindings**

```bash
cd relay-module && spacetime build && spacetime publish --server maincloud relay-demo
cd ../relay-client
spacetime generate --lang typescript \
  --out-dir src/module_bindings \
  --server maincloud \
  --database relay-demo
```

- [ ] **Step 3.3 — Read URL params at the top of App.tsx**

Add near the top of the `App` component (before any state):

```tsx
const params = new URLSearchParams(window.location.search)
const ROOM_ID = BigInt(params.get('room') ?? '1')
const ROLE = params.get('role') ?? 'observer'
const NAME = params.get('name') ?? ROLE
```

URLs will look like: `http://localhost:5173?room=1&role=candidate&name=Alice`

- [ ] **Step 3.4 — Call join_room on connect and subscribe to participants**

Add to state:

```tsx
const [participants, setParticipants] = useState<Participant[]>([])
```

Inside `onConnect`, before `subscriptionBuilder()`:

```tsx
ctx.reducers.joinRoom(ROOM_ID, NAME, ROLE)

ctx.db.participant.onInsert((_ctx, p: Participant) => {
  if (p.roomId === ROOM_ID)
    setParticipants(prev => [...prev.filter(x => x.id !== p.id), p])
})
ctx.db.participant.onUpdate((_ctx, _old: Participant, p: Participant) => {
  if (p.roomId === ROOM_ID)
    setParticipants(prev => prev.map(x => x.id === p.id ? p : x))
})
```

Update the `.subscribe()` call to include both tables:

```tsx
.subscribe(['SELECT * FROM document', 'SELECT * FROM participant'])
```

And seed participants from cache in `onApplied`:

```tsx
setParticipants([...ctx.db.participant.iter()].filter(p => p.roomId === ROOM_ID && p.active))
```

- [ ] **Step 3.5 — Render presence dots**

Add above the editor in the JSX:

```tsx
<div style={{ display: 'flex', gap: 8, padding: '4px 16px', borderBottom: '1px solid #333' }}>
  {participants.filter(p => p.active).map(p => (
    <span key={String(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: p.role === 'candidate' ? '#4ade80' : p.role === 'interviewer' ? '#60a5fa' : '#a78bfa',
      }} />
      {p.displayName}
      <em style={{ fontSize: 11, opacity: 0.6 }}>({p.role})</em>
    </span>
  ))}
</div>
```

- [ ] **Step 3.6 — Verify with three tabs**

```
Tab 1: http://localhost:5173?room=1&role=candidate&name=Alice
Tab 2: http://localhost:5173?room=1&role=interviewer&name=Bob
Tab 3: http://localhost:5173?room=1&role=observer&name=Carol
```

All three tabs should show three presence dots. Closing a tab should remove that dot within a few seconds (driven by the disconnect lifecycle reducer).

- [ ] **Step 3.7 — Commit**

```bash
git add -A && git commit -m "phase 3: room + participant + URL join + role labels"
```

---

### Phase 4 (Hr 6–7): Serverless LLM call + deterministic tag + assist_log syncing

**Goal:** Clicking "Ask AI" fires a Vercel serverless function, which calls the LLM, applies a deterministic policy tag, and returns `{response, tag, policyStatus}`. The browser then writes one `assist_log` row, which appears live in every window.

**Files:**
- Modify: `relay-module/src/lib.rs` — add `assist_log` table + `finalize_assist_log` reducer
- Create: `relay-api/api/assist.ts` — Vercel serverless function (deployed separately)
- Create: `relay-api/vercel.json` — Vercel config
- Create: `relay-client/src/AssistPanel.tsx` — assist input + log display
- Modify: `relay-client/src/App.tsx` — wire AssistPanel

---

- [ ] **Step 4.1 — Add assist_log table and reducer**

Add to `relay-module/src/lib.rs`:

```rust
#[spacetimedb::table(name = assist_log, public)]
pub struct AssistLog {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub room_id: u64,
    pub requested_by: Identity,
    pub prompt_text: String,
    pub response_text: String,
    pub assist_type: String,    // "syntax" | "nudge" | "solution-leaning"
    pub policy_status: String,  // "allowed" | "downgraded"
    pub created_at: u64,
}

#[spacetimedb::reducer]
pub fn finalize_assist_log(
    ctx: &ReducerContext,
    room_id: u64,
    prompt_text: String,
    response_text: String,
    assist_type: String,
    policy_status: String,
) {
    ctx.db.assist_log().insert(AssistLog {
        id: 0,
        room_id,
        requested_by: ctx.sender,
        prompt_text,
        response_text,
        assist_type,
        policy_status,
        created_at: ctx.timestamp.micros_since_unix_epoch() as u64,
    });
}
```

- [ ] **Step 4.2 — Rebuild, publish, regenerate bindings**

```bash
cd relay-module && spacetime build && spacetime publish --server maincloud relay-demo
cd ../relay-client
spacetime generate --lang typescript \
  --out-dir src/module_bindings \
  --server maincloud \
  --database relay-demo
```

- [ ] **Step 4.3 — Create the Vercel serverless function**

```bash
mkdir ../relay-api && cd ../relay-api
npm init -y
npm install @anthropic-ai/sdk
npm install --save-dev @vercel/node typescript
```

Create `relay-api/api/assist.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function tag(response: string): 'syntax' | 'nudge' | 'solution-leaning' {
  const hasFunction = /function\s+\w+\s*\(|=>\s*\{/.test(response)
  const hasLoop = /for\s*\(|while\s*\(|\.forEach|\.map\(|\.reduce\(/.test(response)
  const hasReturn = /\breturn\s+/.test(response)
  const isLong = response.length > 400
  if (hasFunction && hasLoop && hasReturn && isLong) return 'solution-leaning'
  if (hasFunction || (hasLoop && hasReturn)) return 'nudge'
  return 'syntax'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { prompt, policy } = req.body as { prompt: string; policy: string }
  if (!prompt) return res.status(400).json({ error: 'prompt required' })

  const systemPrompt = policy === 'syntax-only'
    ? 'Answer ONLY with a brief syntax example or API signature. Max 3 lines of code, no full algorithms.'
    : 'You are a helpful coding assistant. Keep answers focused and educational.'

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  const assistType = tag(responseText)
  const policyStatus = policy === 'syntax-only' && assistType === 'solution-leaning'
    ? 'downgraded'
    : 'allowed'

  res.json({ response: responseText, tag: assistType, policyStatus })
}
```

Create `relay-api/vercel.json`:

```json
{
  "functions": {
    "api/assist.ts": { "runtime": "@vercel/node" }
  }
}
```

- [ ] **Step 4.4 — Deploy the serverless function**

```bash
npx vercel deploy --prod
```

In the Vercel dashboard → Settings → Environment Variables, set `ANTHROPIC_API_KEY`.
Note the deployed URL (e.g. `https://relay-api-xxxx.vercel.app`). This goes into the client as `API_URL`.

- [ ] **Step 4.5 — Create AssistPanel.tsx**

Create `relay-client/src/AssistPanel.tsx`:

```tsx
import { useRef, useState } from 'react'
import { AssistLog, DbConnection } from './module_bindings'

interface Props {
  roomId: bigint
  logs: AssistLog[]
  policy: string
  conn: DbConnection | null
  apiUrl: string
}

const tagColor: Record<string, string> = {
  syntax: '#4ade80',
  nudge: '#facc15',
  'solution-leaning': '#f87171',
}

export function AssistPanel({ roomId, logs, policy, conn, apiUrl }: Props) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function handleAsk() {
    if (!prompt.trim() || !conn || loading) return
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, policy }),
      })
      const { response, tag, policyStatus } = await res.json()
      conn.reducers.finalizeAssistLog(roomId, prompt, response, tag, policyStatus)
      setPrompt('')
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, boxSizing: 'border-box' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Assist Log</h3>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {logs.map(log => (
          <div key={String(log.id)} style={{ marginBottom: 12, borderBottom: '1px solid #2a2a2a', paddingBottom: 8 }}>
            <div style={{ fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: tagColor[log.assistType] ?? '#fff' }}>● {log.assistType}</span>
              {' · '}
              {log.policyStatus === 'downgraded'
                ? <span style={{ color: '#facc15' }}>requested: solution · delivered: syntax · policy enforced</span>
                : <span style={{ opacity: 0.6 }}>allowed</span>}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Q: {log.promptText}</div>
            <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{log.responseText}</pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk()}
          placeholder="Ask for help…"
          disabled={loading}
          style={{ flex: 1, padding: '6px 10px', borderRadius: 4, background: '#1a1a1a', border: '1px solid #444', color: '#fff' }}
        />
        <button
          onClick={handleAsk}
          disabled={loading || !prompt.trim()}
          style={{ padding: '6px 12px', borderRadius: 4 }}
        >
          {loading ? '…' : 'Ask'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.6 — Wire AssistPanel into App.tsx**

Add to state and constants at the top:

```tsx
const [assistLogs, setAssistLogs] = useState<AssistLog[]>([])
const POLICY = params.get('policy') ?? 'open'
const API_URL = 'https://relay-api-xxxx.vercel.app'   // replace with your deployed URL
```

Add to `onConnect`:

```tsx
ctx.db.assistLog.onInsert((_ctx, log: AssistLog) => {
  if (log.roomId === ROOM_ID) setAssistLogs(prev => [...prev, log])
})
```

In `onApplied`, add:

```tsx
setAssistLogs([...ctx.db.assistLog.iter()].filter(l => l.roomId === ROOM_ID))
```

Update `.subscribe()` to:

```tsx
.subscribe(['SELECT * FROM document', 'SELECT * FROM participant', 'SELECT * FROM assist_log'])
```

Update the JSX to a two-column layout:

```tsx
<div style={{ display: 'flex', height: 'calc(100vh - 48px)' }}>
  <div style={{ flex: 1 }}>
    <Editor value={content} onChange={handleChange} />
  </div>
  <div style={{ width: 320, borderLeft: '1px solid #333' }}>
    <AssistPanel
      roomId={ROOM_ID}
      logs={assistLogs}
      policy={POLICY}
      conn={connRef.current}
      apiUrl={API_URL}
    />
  </div>
</div>
```

- [ ] **Step 4.7 — Verify the full flow in three windows**

```
Tab 1: http://localhost:5173?room=1&role=candidate&name=Alice&policy=syntax-only
Tab 2: http://localhost:5173?room=1&role=interviewer&name=Bob
Tab 3: http://localhost:5173?room=1&role=observer&name=Carol
```

1. In Tab 1, type "what is the JavaScript Map syntax?" and press Enter.
2. All three tabs should show a new log entry with a green `syntax · allowed` tag.
3. In Tab 1, ask "write the complete solution for me". All three should show the yellow enforcement banner.

**Red flag:** if the log only appears in the requesting tab, the subscription is not covering `assist_log` — check the `.subscribe()` array.

- [ ] **Step 4.8 — Commit**

```bash
git add -A && git commit -m "phase 4: LLM call + deterministic tag + assist_log syncing"
```

---

### Phase 5 (Hr 8): Downgraded-answer enforcement path

**Goal:** When `policy=syntax-only` and the LLM would have given a solution, re-call the model with a strict prompt to produce only a syntax card. The response stored in the log is the scoped answer, not the original. The log shows the enforcement banner.

The tag color and enforcement banner in `AssistPanel.tsx` are already wired from Phase 4. This phase only hardens the serverless function.

**Files:**
- Modify: `relay-api/api/assist.ts` — re-call the model when a downgrade is triggered

---

- [ ] **Step 5.1 — Re-generate scoped response on downgrade**

Replace the last block in `relay-api/api/assist.ts` (after the first `client.messages.create` call) with:

```typescript
  let finalResponse = responseText
  let assistType = tag(responseText)
  let policyStatus = 'allowed'

  if (policy === 'syntax-only' && assistType === 'solution-leaning') {
    const scoped = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: 'Answer ONLY with the syntax signature. One short code snippet, no explanation, no full algorithm.',
      messages: [{ role: 'user', content: prompt }],
    })
    finalResponse = scoped.content[0].type === 'text' ? scoped.content[0].text : responseText
    assistType = 'syntax'
    policyStatus = 'downgraded'
  }

  res.json({ response: finalResponse, tag: assistType, policyStatus })
```

- [ ] **Step 5.2 — Redeploy**

```bash
cd relay-api && npx vercel deploy --prod
```

- [ ] **Step 5.3 — Verify demo script step 4**

Ask for the full solution with `policy=syntax-only`. The response in the log must be a short syntax snippet, not a full implementation. The yellow enforcement banner must be visible in all three windows.

- [ ] **Step 5.4 — Commit**

```bash
git add -A && git commit -m "phase 5: downgraded-answer enforcement path"
```

---

### Phase 6 (Hr 9): Stretch — run output via Web Worker

**Only build if phases 1–5 are solid and you have a full hour to spare. Drop instantly if anything above wobbled.**

**Goal:** Candidate clicks Run; JavaScript from the editor runs in a browser Web Worker; `console.log` output is written to `run_output` rows and syncs live to all windows.

**Files:**
- Modify: `relay-module/src/lib.rs` — add `run_output` table, `append_run_output` reducer, `clear_run_output` reducer
- Create: `relay-client/src/worker.ts` — Web Worker that evals JS and captures console output
- Create: `relay-client/src/RunPanel.tsx` — terminal-style output display
- Modify: `relay-client/src/App.tsx` — run button, subscribe to run_output

---

- [ ] **Step 6.1 — Add run_output table and reducers**

Add to `relay-module/src/lib.rs`:

```rust
#[spacetimedb::table(name = run_output, public)]
pub struct RunOutput {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub room_id: u64,
    pub seq: u64,
    pub stream: String,  // "stdout" | "stderr"
    pub text: String,
    pub ts: u64,
}

#[spacetimedb::reducer]
pub fn append_run_output(ctx: &ReducerContext, room_id: u64, seq: u64, stream: String, text: String) {
    ctx.db.run_output().insert(RunOutput {
        id: 0, room_id, seq, stream, text,
        ts: ctx.timestamp.micros_since_unix_epoch() as u64,
    });
}

#[spacetimedb::reducer]
pub fn clear_run_output(ctx: &ReducerContext, room_id: u64) {
    let rows: Vec<_> = ctx.db.run_output()
        .iter()
        .filter(|r| r.room_id == room_id)
        .collect();
    for r in rows {
        ctx.db.run_output().id().delete(r.id);
    }
}
```

Rebuild, publish, regenerate bindings (same commands as prior phases).

- [ ] **Step 6.2 — Create the Web Worker**

Create `relay-client/src/worker.ts`:

```typescript
self.onmessage = (e: MessageEvent<{ code: string }>) => {
  const logs: Array<{ stream: 'stdout' | 'stderr'; text: string }> = []

  const fakeConsole = {
    log: (...args: unknown[]) => logs.push({ stream: 'stdout', text: args.map(String).join(' ') }),
    error: (...args: unknown[]) => logs.push({ stream: 'stderr', text: args.map(String).join(' ') }),
    warn: (...args: unknown[]) => logs.push({ stream: 'stderr', text: '[warn] ' + args.map(String).join(' ') }),
  }

  try {
    // eslint-disable-next-line no-new-func
    new Function('console', e.data.code)(fakeConsole)
    self.postMessage({ logs, error: null })
  } catch (err) {
    self.postMessage({ logs, error: String(err) })
  }
}
```

- [ ] **Step 6.3 — Create RunPanel.tsx**

Create `relay-client/src/RunPanel.tsx`:

```tsx
import { RunOutput } from './module_bindings'

interface Props {
  outputs: RunOutput[]
}

export function RunPanel({ outputs }: Props) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, padding: 8, background: '#0d0d0d', height: '100%', overflowY: 'auto' }}>
      {outputs.length === 0
        ? <span style={{ opacity: 0.4 }}>No output. Click Run.</span>
        : [...outputs].sort((a, b) => Number(a.seq - b.seq)).map(o => (
          <div key={String(o.id)} style={{ color: o.stream === 'stderr' ? '#f87171' : '#e2e8f0', lineHeight: 1.6 }}>
            {o.text}
          </div>
        ))
      }
    </div>
  )
}
```

- [ ] **Step 6.4 — Wire run button and RunPanel into App.tsx**

Add state:

```tsx
const [runOutputs, setRunOutputs] = useState<RunOutput[]>([])
```

Add to `onConnect`:

```tsx
ctx.db.runOutput.onInsert((_ctx, r: RunOutput) => {
  if (r.roomId === ROOM_ID) setRunOutputs(prev => [...prev, r])
})
ctx.db.runOutput.onDelete((_ctx, r: RunOutput) => {
  if (r.roomId === ROOM_ID) setRunOutputs(prev => prev.filter(x => x.id !== r.id))
})
```

Add `'SELECT * FROM run_output'` to the `.subscribe()` array.

Add `handleRun` function:

```tsx
function handleRun() {
  if (!connRef.current) return
  connRef.current.reducers.clearRunOutput(ROOM_ID)
  setRunOutputs([])
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  let seq = 0
  worker.onmessage = (e) => {
    const { logs, error } = e.data
    for (const { stream, text } of logs) {
      connRef.current?.reducers.appendRunOutput(ROOM_ID, BigInt(seq++), stream, text)
    }
    if (error) {
      connRef.current?.reducers.appendRunOutput(ROOM_ID, BigInt(seq++), 'stderr', error)
    }
    worker.terminate()
  }
  worker.postMessage({ code: content })
}
```

Add a "Run" button above the editor and split the left column to show `RunPanel` below the editor (e.g. editor 60%, terminal 40%).

- [ ] **Step 6.5 — Verify run output syncs**

Write `console.log('hello world')` in the editor, click Run. All three windows should show "hello world" in the terminal panel.

- [ ] **Step 6.6 — Commit**

```bash
git add -A && git commit -m "phase 6 (stretch): run output via web worker"
```

---

### Phase 7 (Hr 10): Polish

**Goal:** Demo-ready. No loading states left dangling, no unstyled divs, no visible seams.

Do these in order. Stop when time runs out — none of these are required for the demo.

- [ ] Seed room on first connect: in `onApplied`, if `[...ctx.db.room.iter()].find(r => r.id === ROOM_ID)` is undefined, call `ctx.reducers.createRoom('Interview Room')`.

- [ ] Add a top bar with the room title (subscribe to the `room` table with `SELECT * FROM room` and show the matching row's `title` field).

- [ ] CSS pulse animation on active presence dots:

```css
/* relay-client/src/index.css */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.dot-active { animation: pulse 2s infinite; }
```

Add `className="dot-active"` to each presence dot span.

- [ ] Verify `npm run build` produces no TypeScript errors before moving on.

- [ ] **Commit:** `git add -A && git commit -m "phase 7: polish pass"`

---

### Phase 8 (Hr 11–12): Freeze + Rehearse

**Hr 11 — Freeze**

- [ ] Kill any feature that is not fully working. A half-built run panel is worse than no run panel.
- [ ] Remove all `console.log` debug statements (`grep -r 'console.log' relay-client/src`).
- [ ] Run `npm run build` — fix any TypeScript errors.
- [ ] Open all three demo tabs and walk through the demo script once. Cut anything that glitches.
- [ ] Final commit: `git add -A && git commit -m "freeze: demo build"`

**Hr 12 — Rehearse twice, end to end**

Run the full demo script twice. Time each run. Target: under 90 seconds.

```
1. Open three windows: ?role=candidate, ?role=interviewer, ?role=observer
2. Candidate states approach in one sentence.
3. Candidate asks "what is the JavaScript Map syntax?" →
   all three windows show green syntax · allowed tag.
4. Candidate asks for the full solution →
   all three windows show the yellow enforcement banner.
5. Candidate writes code, clicks Run →
   terminal output syncs across all three windows.
6. Zoom in on the assist log as the close shot.
```

If step 5 (run output) glitches in either rehearsal, remove the Run button and skip that step in the demo. The money shots are steps 3 and 4. Everything else is garnish.
