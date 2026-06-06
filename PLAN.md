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
| Real-time backend | SpacetimeDB Maincloud | TypeScript module in `spacetimedb/src/index.ts` |
| Frontend | Vite React via `spacetime dev --template react-ts` | `client/src/App.tsx`; not Next.js |
| Client SDK | `spacetimedb` package + `spacetimedb/react` hooks | `withUri` + `withDatabaseName`; do not use `@clockworklabs/spacetimedb-sdk` or `withModuleName` |
| LLM key | one standalone Vercel serverless function | never in a `VITE_` variable |
| Code execution | browser Web Worker, JavaScript only | no Python/Java/Docker |
| Assist write path | browser calls `finalizeAssistLog` reducer | skip giving the serverless function its own STDB identity |

The serverless function returns `{response, requestedType, assistType, policyStatus}` to the browser. The browser writes the log row. The function only holds the key and calls the model.

---

## Locked scope

Two things must work before anything else is touched.

1. **Shared editor syncing across windows.** One `document` row per room, whole-content replace on a ~200ms debounce, everyone subscribes. Candidate writes, others watch in read-only mode. No patches, no OT, no multi-writer.
2. **One assist firing into a shared, tagged log visible in every window.** Serverless single-shot call, returns response plus a deterministic policy tag, writes one `assist_log` row, lands live in every window via subscription.

Those two give you Best Web App and the LLM thesis. Everything below is priority-ordered stretch. Cut from the bottom the moment anything above wobbles.

| Priority | Feature | Build only if |
|---|---|---|
| 3 | Presence dots and role labels | core two are rock solid |
| 4 | Run output, JS web worker to `run_output` rows, synced | presence is done and time remains |
| 5 | Remote cursors | run output works and time remains |
| CUT | streaming, `assist_chunk`, self-classification as enforcement, policy modes UI, notes, summary view, multi-language | not in 12h |

The model's own self-tag, if you ever add it, is logged as an untrusted signal next to the deterministic tag. It is never the thing that enforces. This is a 30-spare-minutes garnish, not a feature.

---

## Minimum tables

```
room          id, title, created_by, created_at
participant   id, room_id, identity, display_name, role, active
document      room_id (pk), content, version, updated_by, updated_at
assist_log    id, room_id, requested_by, prompt_text, response_text,
              requested_type, assist_type, policy_status, created_at
run_output    id, room_id, seq, stream, text, ts        (stretch)
```

Reducers: `createRoom`, `joinRoom`, `updateDocument`, `finalizeAssistLog`, `appendRunOutput` / `clearRunOutput` (stretch), plus `clientConnected` / `clientDisconnected` lifecycle hooks for presence.

The deterministic classification now runs on the **prompt text**, not the model response. If `policy=syntax-only` and the prompt asks for a full solution (detected by keyword scan), the serverless function re-calls the model with a strict system prompt and logs:
- `requested_type = "solution-leaning"` — what was asked for
- `assist_type = "syntax"` — what was delivered
- `policy_status = "downgraded"` — enforcement triggered

---

## The clock

Real buffer at the end, because STDB setup always bites first.

| Hr | Goal | Red flag |
|---|---|---|
| 1-2 | Scaffold via `spacetime dev`, Maincloud connection, one table syncing across two tabs | by hour 3, debug only this, nothing else |
| 3-4 | `document` row, debounced whole-content sync, editor mounted | |
| 5 | `room` + `participant`, join by URL, role labels, read-only editor for non-candidate | |
| 6-7 | Serverless LLM call, prompt-based tag, `assist_log` row syncing to all windows | this is your LLM prize, protect it |
| 8 | Wire the downgraded-answer path | |
| 9 | Stretch: run output | drop instantly if 6-7 ran over |
| 10 | Polish: auto-scroll log, loading state, seed room | |
| 11 | Cut flaky features, freeze the build | |
| 12 | Rehearse the demo twice, end to end | |

---

## Demo script (~90 seconds, visual not talky)

1. Open three windows: Candidate, Interviewer, Observer.
2. Candidate briefly states the approach out loud (one sentence, then move).
3. Candidate asks: "what is the JavaScript Map syntax?" Scoped syntax card appears live in all three windows. Log shows `requested: syntax · delivered: syntax · allowed`.
4. Candidate asks for the full solution. Policy is syntax-only, so the response is still just a scoped syntax card, and the log shows `requested: solution · delivered: syntax · policy enforced`. Show the product working, not the AI refusing.
5. Candidate writes the actual code, hits Run. Terminal output syncs across all three windows.
6. Close on the assist log: every AI interaction in the room, classified and visible.

The money shot is step 3 and step 4: a thing appearing live in every window at once.

---

## Judge Q&A defenses

"Isn't this still helping too much?" The interviewer sets the policy, and every assist is shared and logged, so there is no hidden help. Relay is for interviews where scoped help is allowed and problem solving is still evaluated.

"What happens when the classifier is wrong?" It is wrong regularly, which is exactly why we do not trust the model to police itself. Enforcement is a deterministic layer we control based on the prompt, the model's response is treated as an untrusted signal, and we log both so you can see when they disagree.

"Why SpacetimeDB?" The audit log is not just synced text, it is the shared truth of the interview, and every participant subscribes to the same room state live. That is the whole product.

"The browser writes the log, can't it tamper with it?" In production the Vercel function writes the assist log directly using a server identity. For this build we optimized the write path for demo speed. (Say this line, do not build it.)

---

## Two non-negotiables

1. **Stop touching the positioning and the name.** It is good. It is locked. Do not open that doc again.
2. **Freeze the build at hour 11 regardless of state.** A demo rehearsed twice on a smaller feature set beats a bigger one you are still wiring at 1:55pm.

One decision before you write a line: editor is candidate-writes, others-watch (read-only). That saves you the single biggest time sink. Confirmed, go.

---

## Phase Plans

> For agentic workers: use `superpowers:executing-plans` to run these tasks step-by-step.

---

### Phase 1 (Hr 1–2): Scaffold + Maincloud connection + one table syncing

**Goal:** Two browser tabs showing the same live data from SpacetimeDB Maincloud — proves the plumbing works before anything else is built.

**Files:**
- Create: `spacetimedb/src/index.ts` — SpacetimeDB TypeScript module (generated by template, then edited)
- Modify: `client/src/App.tsx` — connect to Maincloud, subscribe, render rows
- Modify: `client/src/main.tsx` — wrap app with `SpacetimeDBProvider`

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

- [ ] **Step 1.3 — Scaffold the project with the React TypeScript template**

Inside the repo root (`relay/`):

```bash
spacetime dev --template react-ts
```

This creates the `spacetimedb/` module directory and `client/` React app, starts a local SpacetimeDB server, publishes the module, generates bindings into `client/src/module_bindings/`, and launches Vite. Press Ctrl-C after you see it running — we'll configure for Maincloud next.

- [ ] **Step 1.4 — Replace the generated module with the minimal `room` table**

Replace `spacetimedb/src/index.ts` with:

```typescript
import { schema, table, t } from 'spacetimedb/server';

const spacetimedb = schema({
  room: table(
    { public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      title: t.string(),
      createdBy: t.identity(),
      createdAt: t.u64(),
    }
  ),
});
export default spacetimedb;

export const createRoom = spacetimedb.reducer(
  { title: t.string() },
  (ctx, { title }) => {
    ctx.db.room.insert({ id: 0n, title, createdBy: ctx.sender, createdAt: BigInt(Date.now()) });
  }
);
```

- [ ] **Step 1.5 — Publish to Maincloud and regenerate bindings**

```bash
spacetime publish --server maincloud relay-demo
spacetime generate --lang typescript \
  --out-dir client/src/module_bindings \
  --module-path spacetimedb
```

- [ ] **Step 1.6 — Install the client SDK**

```bash
cd client
npm install spacetimedb
```

- [ ] **Step 1.7 — Set up SpacetimeDBProvider in main.tsx**

Replace `client/src/main.tsx` with:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DbConnection } from './module_bindings'
import { SpacetimeDBProvider } from 'spacetimedb/react'

const connectionBuilder = DbConnection.builder()
  .withUri('https://maincloud.spacetimedb.com')
  .withDatabaseName('relay-demo')
  .onConnect((conn, _identity, _token) => {
    conn.subscriptionBuilder().subscribeToAllTables()
  })
  .onConnectError((_ctx, err) => console.error('Connection error:', err))
  .onDisconnect(() => console.log('Disconnected'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
    <App />
  </SpacetimeDBProvider>
)
```

- [ ] **Step 1.8 — Connect and render rooms in App.tsx**

Replace `client/src/App.tsx` with:

```tsx
import { useSpacetimeDB, useTable } from 'spacetimedb/react'
import { DbConnection, tables, reducers } from './module_bindings'

export default function App() {
  const conn = useSpacetimeDB<DbConnection>()
  const [rooms, isReady] = useTable(tables.room)

  function handleCreate() {
    conn?.reducers.createRoom('Test Room')
  }

  if (!isReady) return <div>Connecting…</div>

  return (
    <div>
      <h1>Relay</h1>
      <button onClick={handleCreate}>Create Room</button>
      <ul>
        {rooms.map(r => <li key={String(r.id)}>{r.title}</li>)}
      </ul>
    </div>
  )
}
```

- [ ] **Step 1.9 — Start the dev server and verify two-tab sync**

```bash
cd client && npm run dev
```

Open two tabs at `http://localhost:5173`. Click "Create Room" in one tab. Both tabs must show the new row appear without a page refresh.

**Red flag:** If only one tab updates, the subscription is not live — verify `subscribeToAllTables()` is being called inside `onConnect`, not outside it.

- [ ] **Step 1.10 — Commit**

```bash
cd .. && git add -A && git commit -m "phase 1: scaffold + maincloud sync verified"
```

---

### Phase 2 (Hr 3–4): Document row + debounced editor sync

**Goal:** Candidate types in a code editor; everyone else watching the same room sees the content update live within ~200 ms.

**Files:**
- Modify: `spacetimedb/src/index.ts` — add `document` table + `updateDocument` reducer
- Create: `client/src/Editor.tsx` — CodeMirror wrapper
- Modify: `client/src/App.tsx` — subscribe to document, debounce writes, pass `readOnly` to editor

---

- [ ] **Step 2.1 — Add `document` table and reducer to index.ts**

Add to `spacetimedb/src/index.ts` (keep existing `room` table and `createRoom`; add `document` to the `schema()` call):

```typescript
import { schema, table, t } from 'spacetimedb/server';

const spacetimedb = schema({
  room: table(
    { public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      title: t.string(),
      createdBy: t.identity(),
      createdAt: t.u64(),
    }
  ),
  document: table(
    { public: true },
    {
      roomId: t.u64().primaryKey(),   // one document per room
      content: t.string(),
      version: t.u64(),
      updatedBy: t.identity(),
      updatedAt: t.u64(),
    }
  ),
});
export default spacetimedb;

export const createRoom = spacetimedb.reducer(
  { title: t.string() },
  (ctx, { title }) => {
    ctx.db.room.insert({ id: 0n, title, createdBy: ctx.sender, createdAt: BigInt(Date.now()) });
  }
);

export const updateDocument = spacetimedb.reducer(
  { roomId: t.u64(), content: t.string() },
  (ctx, { roomId, content }) => {
    const existing = ctx.db.document.roomId.find(roomId);
    if (existing) {
      ctx.db.document.roomId.update({
        roomId,
        content,
        version: existing.version + 1n,
        updatedBy: ctx.sender,
        updatedAt: BigInt(Date.now()),
      });
    } else {
      ctx.db.document.insert({
        roomId,
        content,
        version: 0n,
        updatedBy: ctx.sender,
        updatedAt: BigInt(Date.now()),
      });
    }
  }
);
```

- [ ] **Step 2.2 — Republish and regenerate bindings**

```bash
spacetime publish --server maincloud relay-demo
spacetime generate --lang typescript \
  --out-dir client/src/module_bindings \
  --module-path spacetimedb
```

- [ ] **Step 2.3 — Install CodeMirror**

```bash
cd client
npm install codemirror @codemirror/lang-javascript @codemirror/theme-one-dark
```

- [ ] **Step 2.4 — Create Editor.tsx**

Create `client/src/Editor.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

interface Props {
  value: string
  onChange?: (val: string) => void
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
            onChange?.(update.state.doc.toString())
          }
        }),
      ],
      parent: containerRef.current,
    })
    return () => viewRef.current?.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync remote content into the editor — runs for both candidate (echo) and read-only viewers
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return <div ref={containerRef} style={{ height: '100%' }} />
}
```

**Important:** The `useEffect` that syncs `value` runs for both `readOnly` viewers **and** the candidate. For read-only viewers it is the only update path. For the candidate it only fires when the remote content differs from local (i.e. on initial load), because `localContent` is kept in sync below.

- [ ] **Step 2.5 — Wire debounced document sync in App.tsx**

Replace `client/src/App.tsx`:

```tsx
import { useRef, useState, useEffect } from 'react'
import { useSpacetimeDB, useTable } from 'spacetimedb/react'
import { DbConnection, tables, reducers } from './module_bindings'
import { Editor } from './Editor'

const params = new URLSearchParams(window.location.search)
const ROOM_ID = BigInt(params.get('room') ?? '1')
const ROLE = params.get('role') ?? 'observer'
const isCandidate = ROLE === 'candidate'

export default function App() {
  const conn = useSpacetimeDB<DbConnection>()
  const [documents, docsReady] = useTable(tables.document)
  const remoteDoc = documents.find(d => d.roomId === ROOM_ID)

  // Candidate: track local edits so keystrokes feel instant
  const [localContent, setLocalContent] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPendingWrite = useRef(false)

  // Seed local content from first remote load; ignore remote echoes while typing
  useEffect(() => {
    if (remoteDoc && !hasPendingWrite.current) {
      setLocalContent(remoteDoc.content)
    }
  }, [remoteDoc?.content])

  // Read-only viewers use remoteDoc.content directly; candidate uses localContent
  const editorValue = isCandidate ? localContent : (remoteDoc?.content ?? '')

  function handleChange(val: string) {
    setLocalContent(val)
    hasPendingWrite.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      conn?.reducers.updateDocument(ROOM_ID, val)
      hasPendingWrite.current = false
    }, 200)
  }

  if (!docsReady) return <div>Connecting…</div>

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ margin: '8px 16px' }}>Relay</h2>
      <div style={{ flex: 1 }}>
        <Editor
          value={editorValue}
          onChange={isCandidate ? handleChange : undefined}
          readOnly={!isCandidate}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2.6 — Verify two-tab live sync**

```
Tab 1: http://localhost:5173?room=1&role=candidate
Tab 2: http://localhost:5173?room=1&role=observer
```

Type in Tab 1. Tab 2 (read-only) must update within ~200 ms. Tab 2 editor must not be editable.

**Red flag:** If Tab 2 shows a blank editor after connecting, the `useEffect` in `Editor.tsx` that syncs the `value` prop is not firing — check that `value` is not an empty string when `docsReady` is true.

- [ ] **Step 2.7 — Commit**

```bash
cd .. && git add -A && git commit -m "phase 2: editor + debounced document sync + read-only viewer"
```

---

### Phase 3 (Hr 5): Room + participant + URL join + role labels

**Goal:** Three browser windows each with a role (candidate / interviewer / observer) join a room by URL and see each other as presence dots.

**Files:**
- Modify: `spacetimedb/src/index.ts` — add `participant` table, `joinRoom` reducer, `clientDisconnected` lifecycle hook
- Modify: `client/src/App.tsx` — call `joinRoom` on connect, subscribe to participants, render presence bar

---

- [ ] **Step 3.1 — Add participant table and lifecycle reducers to index.ts**

Add to the `schema()` call in `spacetimedb/src/index.ts`:

```typescript
participant: table(
  { public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64(),
    identity: t.identity(),
    displayName: t.string(),
    role: t.string(),
    active: t.bool(),
  }
),
```

Add these reducers (after the existing ones):

```typescript
export const joinRoom = spacetimedb.reducer(
  { roomId: t.u64(), displayName: t.string(), role: t.string() },
  (ctx, { roomId, displayName, role }) => {
    // Remove stale entries for this identity in this room
    for (const p of ctx.db.participant.iter()) {
      if (p.identity.toHexString() === ctx.sender.toHexString() && p.roomId === roomId) {
        ctx.db.participant.id.delete(p.id);
      }
    }
    ctx.db.participant.insert({ id: 0n, roomId, identity: ctx.sender, displayName, role, active: true });

    // Seed document if this is the first join
    if (!ctx.db.document.roomId.find(roomId)) {
      ctx.db.document.insert({ roomId, content: '', version: 0n, updatedBy: ctx.sender, updatedAt: BigInt(Date.now()) });
    }
  }
);

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  for (const p of ctx.db.participant.iter()) {
    if (p.identity.toHexString() === ctx.sender.toHexString() && p.active) {
      ctx.db.participant.id.update({ ...p, active: false });
    }
  }
});
```

- [ ] **Step 3.2 — Republish and regenerate bindings**

```bash
spacetime publish --server maincloud relay-demo
spacetime generate --lang typescript \
  --out-dir client/src/module_bindings \
  --module-path spacetimedb
```

- [ ] **Step 3.3 — Add URL params for name and call joinRoom in App.tsx**

Add to the URL param block at the top of `App.tsx`:

```tsx
const NAME = params.get('name') ?? ROLE
```

In the `SpacetimeDBProvider` `onConnect` callback in `main.tsx`, add after `subscribeToAllTables()`:

```tsx
conn.reducers.joinRoom(ROOM_ID, NAME, ROLE)
```

Wait — `ROOM_ID`, `NAME`, and `ROLE` are defined in `App.tsx`, not `main.tsx`. Move the URL param parsing to a shared `config.ts` file, or parse them in `main.tsx` directly:

```tsx
// client/src/main.tsx — replace the connectionBuilder block with:
const params = new URLSearchParams(window.location.search)
const ROOM_ID = BigInt(params.get('room') ?? '1')
const ROLE = params.get('role') ?? 'observer'
const NAME = params.get('name') ?? ROLE

const connectionBuilder = DbConnection.builder()
  .withUri('https://maincloud.spacetimedb.com')
  .withDatabaseName('relay-demo')
  .onConnect((conn, _identity, _token) => {
    conn.subscriptionBuilder().subscribeToAllTables()
    conn.reducers.joinRoom(ROOM_ID, NAME, ROLE)
  })
  .onConnectError((_ctx, err) => console.error('Connection error:', err))
  .onDisconnect(() => console.log('Disconnected'))
```

Export the parsed constants so `App.tsx` can use them:

Create `client/src/config.ts`:

```typescript
export const params = new URLSearchParams(window.location.search)
export const ROOM_ID = BigInt(params.get('room') ?? '1')
export const ROLE = params.get('role') ?? 'observer'
export const NAME = params.get('name') ?? ROLE
export const isCandidate = ROLE === 'candidate'
```

Update `client/src/main.tsx` to import from `config.ts`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DbConnection } from './module_bindings'
import { SpacetimeDBProvider } from 'spacetimedb/react'
import { ROOM_ID, NAME, ROLE } from './config'

const connectionBuilder = DbConnection.builder()
  .withUri('https://maincloud.spacetimedb.com')
  .withDatabaseName('relay-demo')
  .onConnect((conn, _identity, _token) => {
    conn.subscriptionBuilder().subscribeToAllTables()
    conn.reducers.joinRoom(ROOM_ID, NAME, ROLE)
  })
  .onConnectError((_ctx, err) => console.error('Connection error:', err))
  .onDisconnect(() => console.log('Disconnected'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
    <App />
  </SpacetimeDBProvider>
)
```

Update `client/src/App.tsx` to import from `config.ts` and remove the inline param parsing:

```tsx
import { useRef, useState, useEffect } from 'react'
import { useSpacetimeDB, useTable } from 'spacetimedb/react'
import { DbConnection, tables } from './module_bindings'
import { Editor } from './Editor'
import { ROOM_ID, ROLE, isCandidate } from './config'
```

- [ ] **Step 3.4 — Render the presence bar in App.tsx**

Add to App.tsx:

```tsx
const [participants, participantsReady] = useTable(tables.participant)
const activeParticipants = participants.filter(p => p.roomId === ROOM_ID && p.active)
```

Add above the editor in the JSX:

```tsx
<div style={{ display: 'flex', gap: 8, padding: '4px 16px', borderBottom: '1px solid #333' }}>
  {activeParticipants.map(p => (
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

- [ ] **Step 3.5 — Verify with three tabs**

```
Tab 1: http://localhost:5173?room=1&role=candidate&name=Alice
Tab 2: http://localhost:5173?room=1&role=interviewer&name=Bob
Tab 3: http://localhost:5173?room=1&role=observer&name=Carol
```

All three tabs should show three presence dots. Closing Tab 1 should remove Alice's dot within a few seconds (driven by `clientDisconnected`).

- [ ] **Step 3.6 — Commit**

```bash
git add -A && git commit -m "phase 3: room + participant + URL join + role labels"
```

---

### Phase 4 (Hr 6–7): Serverless LLM call + prompt-based tag + assist_log syncing

**Goal:** Clicking "Ask AI" fires a Vercel serverless function, which inspects the prompt text to classify the request, calls the LLM (with policy enforcement baked into the system prompt), and returns `{response, requestedType, assistType, policyStatus}`. The browser writes one `assist_log` row, which appears live in every window.

**Files:**
- Modify: `spacetimedb/src/index.ts` — add `assist_log` table + `finalizeAssistLog` reducer
- Create: `relay-api/api/assist.ts` — Vercel serverless function
- Create: `relay-api/vercel.json`
- Create: `client/src/AssistPanel.tsx` — assist input + log display
- Modify: `client/src/App.tsx` — add AssistPanel to layout

---

- [ ] **Step 4.1 — Add assist_log table and reducer to index.ts**

Add `assistLog` to the `schema()` call:

```typescript
assistLog: table(
  { public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64(),
    requestedBy: t.identity(),
    promptText: t.string(),
    responseText: t.string(),
    requestedType: t.string(),   // what the prompt asked for: "syntax" | "nudge" | "solution-leaning"
    assistType: t.string(),      // what was delivered: "syntax" | "nudge" | "solution-leaning"
    policyStatus: t.string(),    // "allowed" | "downgraded"
    createdAt: t.u64(),
  }
),
```

Add the reducer:

```typescript
export const finalizeAssistLog = spacetimedb.reducer(
  {
    roomId: t.u64(),
    promptText: t.string(),
    responseText: t.string(),
    requestedType: t.string(),
    assistType: t.string(),
    policyStatus: t.string(),
  },
  (ctx, args) => {
    ctx.db.assistLog.insert({
      id: 0n,
      roomId: args.roomId,
      requestedBy: ctx.sender,
      promptText: args.promptText,
      responseText: args.responseText,
      requestedType: args.requestedType,
      assistType: args.assistType,
      policyStatus: args.policyStatus,
      createdAt: BigInt(Date.now()),
    });
  }
);
```

- [ ] **Step 4.2 — Republish and regenerate bindings**

```bash
spacetime publish --server maincloud relay-demo
spacetime generate --lang typescript \
  --out-dir client/src/module_bindings \
  --module-path spacetimedb
```

- [ ] **Step 4.3 — Create the Vercel serverless function**

```bash
mkdir relay-api && cd relay-api
npm init -y
npm install @anthropic-ai/sdk
npm install --save-dev @vercel/node typescript
```

Create `relay-api/api/assist.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Classify what the user is asking for based on the prompt text
function classifyPrompt(prompt: string): 'syntax' | 'nudge' | 'solution-leaning' {
  const lower = prompt.toLowerCase()
  const solutionKeywords = [
    'full solution', 'complete solution', 'solve this', 'write the code',
    'write me', 'implement this', 'full implementation', 'just give me',
    'do it for me', 'complete the function', 'write the function',
    'can you write', 'write a function', 'give me the answer',
  ]
  if (solutionKeywords.some(kw => lower.includes(kw))) return 'solution-leaning'
  const nudgeKeywords = ['how do i', 'how to', 'what approach', 'algorithm', 'logic', 'explain']
  if (nudgeKeywords.some(kw => lower.includes(kw))) return 'nudge'
  return 'syntax'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { prompt, policy } = req.body as { prompt: string; policy: string }
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt required' })

  const requestedType = classifyPrompt(prompt)

  // If policy=syntax-only and the prompt asks for a solution, enforce before calling the model
  const shouldDowngrade = policy === 'syntax-only' && requestedType === 'solution-leaning'

  const systemPrompt = shouldDowngrade
    ? 'Answer ONLY with a brief syntax example or API signature. Max 3 lines of code. Do not write a full implementation or algorithm.'
    : policy === 'syntax-only'
      ? 'You are a helpful coding assistant. Keep answers focused on syntax and brief examples.'
      : 'You are a helpful coding assistant. Keep answers focused and educational.'

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  const assistType = shouldDowngrade ? 'syntax' : requestedType
  const policyStatus = shouldDowngrade ? 'downgraded' : 'allowed'

  res.json({ response: responseText, requestedType, assistType, policyStatus })
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
cd relay-api && npx vercel deploy --prod
```

In the Vercel dashboard → Project → Settings → Environment Variables, set `ANTHROPIC_API_KEY`.

Note the deployed URL (e.g. `https://relay-api-xxxx.vercel.app`). Put it in `client/src/config.ts`:

```typescript
export const API_URL = 'https://relay-api-xxxx.vercel.app'   // replace with actual URL
```

Also add `POLICY` to `config.ts`:

```typescript
export const POLICY = params.get('policy') ?? 'open'
```

- [ ] **Step 4.5 — Create AssistPanel.tsx**

Create `client/src/AssistPanel.tsx`:

```tsx
import { useRef, useState } from 'react'
import { useSpacetimeDB } from 'spacetimedb/react'
import { DbConnection } from './module_bindings'
import { ROOM_ID, POLICY, API_URL } from './config'

interface AssistEntry {
  id: bigint
  promptText: string
  responseText: string
  requestedType: string
  assistType: string
  policyStatus: string
}

interface Props {
  logs: readonly AssistEntry[]
}

const tagColor: Record<string, string> = {
  syntax: '#4ade80',
  nudge: '#facc15',
  'solution-leaning': '#f87171',
}

export function AssistPanel({ logs }: Props) {
  const conn = useSpacetimeDB<DbConnection>()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function handleAsk() {
    if (!prompt.trim() || !conn || loading) return
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, policy: POLICY }),
      })
      const { response, requestedType, assistType, policyStatus } = await res.json()
      conn.reducers.finalizeAssistLog(ROOM_ID, prompt, response, requestedType, assistType, policyStatus)
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
              <span style={{ color: tagColor[log.requestedType] ?? '#aaa' }}>
                requested: {log.requestedType}
              </span>
              {' · '}
              <span style={{ color: tagColor[log.assistType] ?? '#aaa' }}>
                delivered: {log.assistType}
              </span>
              {' · '}
              {log.policyStatus === 'downgraded'
                ? <span style={{ color: '#facc15' }}>policy enforced</span>
                : <span style={{ opacity: 0.5 }}>allowed</span>}
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

Add to App.tsx:

```tsx
import { AssistPanel } from './AssistPanel'

// Inside the component, add:
const [assistLogs, assistReady] = useTable(tables.assistLog)
const roomLogs = assistLogs.filter(l => l.roomId === ROOM_ID)
```

Update the JSX to a two-column layout:

```tsx
return (
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
    {/* presence bar */}
    <div style={{ display: 'flex', gap: 8, padding: '4px 16px', borderBottom: '1px solid #333' }}>
      {activeParticipants.map(p => (
        <span key={String(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: p.role === 'candidate' ? '#4ade80' : p.role === 'interviewer' ? '#60a5fa' : '#a78bfa',
          }} />
          {p.displayName} <em style={{ fontSize: 11, opacity: 0.6 }}>({p.role})</em>
        </span>
      ))}
    </div>
    {/* main area */}
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1 }}>
        <Editor value={editorValue} onChange={isCandidate ? handleChange : undefined} readOnly={!isCandidate} />
      </div>
      <div style={{ width: 320, borderLeft: '1px solid #333' }}>
        <AssistPanel logs={roomLogs} />
      </div>
    </div>
  </div>
)
```

- [ ] **Step 4.7 — Verify the full flow in three windows**

```
Tab 1: http://localhost:5173?room=1&role=candidate&name=Alice&policy=syntax-only
Tab 2: http://localhost:5173?room=1&role=interviewer&name=Bob
Tab 3: http://localhost:5173?room=1&role=observer&name=Carol
```

1. In Tab 1, type "what is the JavaScript Map syntax?" and press Enter.
2. All three tabs must show a new log entry: `requested: syntax · delivered: syntax · allowed`.
3. In Tab 1, type "write the complete solution for me". All three tabs must show: `requested: solution-leaning · delivered: syntax · policy enforced`.

**Red flag:** If the log only appears in the tab that sent the request, the subscription to `assist_log` isn't active — verify `subscribeToAllTables()` is called in `onConnect` and the table is public.

- [ ] **Step 4.8 — Commit**

```bash
git add -A && git commit -m "phase 4: LLM call + prompt-based tag + assist_log syncing"
```

---

### Phase 5 (Hr 8): Harden the downgrade path

**Goal:** The demo step "requested solution, delivered syntax, policy enforced" must be bulletproof. This phase tests edge cases and tightens the keyword list.

This phase has no new files — it is hardening only.

---

- [ ] **Step 5.1 — Test all three keyword buckets**

In a tab with `policy=syntax-only`, fire one prompt from each bucket and verify the log shows correct tags:

| Prompt | Expected `requestedType` | Expected `policyStatus` |
|---|---|---|
| "what is Map syntax" | `syntax` | `allowed` |
| "how do i iterate an array" | `nudge` | `allowed` |
| "write the complete solution" | `solution-leaning` | `downgraded` |
| "implement this for me" | `solution-leaning` | `downgraded` |
| "can you write a function that sums an array" | `solution-leaning` | `downgraded` |

- [ ] **Step 5.2 — Add any missing keywords to `classifyPrompt`**

Edit `relay-api/api/assist.ts` to fill any gaps found in Step 5.1. Redeploy after changes:

```bash
cd relay-api && npx vercel deploy --prod
```

- [ ] **Step 5.3 — Verify the demo script step 4 end-to-end**

Candidate asks for the full solution. The response in the log must be a short syntax card (not a full implementation). The enforcement label must appear in all three windows.

- [ ] **Step 5.4 — Commit**

```bash
git add -A && git commit -m "phase 5: hardened downgrade path"
```

---

### Phase 6 (Hr 9): Stretch — run output via Web Worker

**Only build if phases 1–5 are solid and a full hour remains. Drop instantly if anything above wobbled.**

**Goal:** Candidate clicks Run; the code in the editor runs in a browser Web Worker; `console.log` output is written to `run_output` rows and syncs live to all windows.

**Files:**
- Modify: `spacetimedb/src/index.ts` — add `run_output` table, `appendRunOutput`, `clearRunOutput` reducers
- Create: `client/src/worker.ts` — Web Worker that evals JS and captures console output
- Create: `client/src/RunPanel.tsx` — terminal-style output display
- Modify: `client/src/App.tsx` — run button, subscribe to run_output

---

- [ ] **Step 6.1 — Add run_output table and reducers**

Add `runOutput` to the `schema()` call in `spacetimedb/src/index.ts`:

```typescript
runOutput: table(
  { public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64(),
    seq: t.u64(),
    stream: t.string(),  // "stdout" | "stderr"
    text: t.string(),
    ts: t.u64(),
  }
),
```

Add reducers:

```typescript
export const appendRunOutput = spacetimedb.reducer(
  { roomId: t.u64(), seq: t.u64(), stream: t.string(), text: t.string() },
  (ctx, { roomId, seq, stream, text }) => {
    ctx.db.runOutput.insert({ id: 0n, roomId, seq, stream, text, ts: BigInt(Date.now()) });
  }
);

export const clearRunOutput = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    for (const r of ctx.db.runOutput.iter()) {
      if (r.roomId === roomId) {
        ctx.db.runOutput.id.delete(r.id);
      }
    }
  }
);
```

Republish and regenerate (same commands as prior phases).

- [ ] **Step 6.2 — Create the Web Worker**

Create `client/src/worker.ts`:

```typescript
self.onmessage = (e: MessageEvent<{ code: string }>) => {
  const logs: Array<{ stream: 'stdout' | 'stderr'; text: string }> = []

  const fakeConsole = {
    log: (...args: unknown[]) => logs.push({ stream: 'stdout', text: args.map(String).join(' ') }),
    error: (...args: unknown[]) => logs.push({ stream: 'stderr', text: args.map(String).join(' ') }),
    warn: (...args: unknown[]) => logs.push({ stream: 'stderr', text: '[warn] ' + args.map(String).join(' ') }),
  }

  let error: string | null = null
  try {
    // eslint-disable-next-line no-new-func
    new Function('console', e.data.code)(fakeConsole)
  } catch (err) {
    error = String(err)
  }

  self.postMessage({ logs, error })
}
```

- [ ] **Step 6.3 — Create RunPanel.tsx**

Create `client/src/RunPanel.tsx`:

```tsx
interface OutputLine {
  id: bigint
  seq: bigint
  stream: string
  text: string
}

interface Props {
  outputs: readonly OutputLine[]
}

export function RunPanel({ outputs }: Props) {
  const sorted = [...outputs].sort((a, b) => Number(a.seq - b.seq))
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, padding: 8, background: '#0d0d0d', height: '100%', overflowY: 'auto' }}>
      {sorted.length === 0
        ? <span style={{ opacity: 0.4 }}>No output. Click Run.</span>
        : sorted.map(o => (
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

Add to App.tsx:

```tsx
import { RunPanel } from './RunPanel'

// Inside component:
const [runOutputs, runReady] = useTable(tables.runOutput)
const roomOutputs = runOutputs.filter(r => r.roomId === ROOM_ID)

function handleRun() {
  if (!conn) return
  conn.reducers.clearRunOutput(ROOM_ID)

  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  let seq = 0n
  worker.onmessage = (e) => {
    const { logs, error } = e.data
    for (const { stream, text } of logs) {
      conn.reducers.appendRunOutput(ROOM_ID, seq++, stream, text)
    }
    if (error) conn.reducers.appendRunOutput(ROOM_ID, seq++, 'stderr', error)
    worker.terminate()
  }
  worker.postMessage({ code: editorValue })
}
```

Add a Run button (visible only to candidate) and split the left column to show `RunPanel` below the editor (60/40 split).

- [ ] **Step 6.5 — Verify run output syncs**

Write `console.log('hello world')` in the editor, click Run. All three windows must show "hello world" in the terminal panel.

- [ ] **Step 6.6 — Commit**

```bash
git add -A && git commit -m "phase 6 (stretch): run output via web worker"
```

---

### Phase 7 (Hr 10): Polish

**Goal:** Demo-ready. No visible in-progress work, no unstyled divs, no loading states left dangling.

Do these in order. Stop when time runs out.

- [ ] Seed room on first `onApplied`: in `main.tsx` `onConnect`, after `joinRoom`, check if room 1 exists and create it if not — but `subscribeToAllTables()` is async, so use a one-shot `onInsert` guard or just call `createRoom` unconditionally (it's idempotent if you check in the reducer, so add a guard in `createRoom`). Simplest: add a `roomId` check in the `createRoom` reducer — if `ctx.db.room.id.find(1n)` exists, no-op.

- [ ] Add a title bar that shows room name: subscribe to `tables.room`, find the row matching `ROOM_ID`, render `room?.title` in the header.

- [ ] CSS pulse on active dots:

```css
/* client/src/index.css */
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.dot { animation: pulse 2s infinite; }
```

Add `className="dot"` to each presence dot `<span>`.

- [ ] Run `npm run build` from `client/`. Fix any TypeScript errors before moving on.

- [ ] **Commit:** `git add -A && git commit -m "phase 7: polish pass"`

---

### Phase 8 (Hr 11–12): Freeze + Rehearse

**Hr 11 — Freeze**

- [ ] Kill any feature that is not fully working. A half-built run panel is worse than no run panel.
- [ ] Remove all `console.log` debug statements: `grep -r 'console.log' client/src --include='*.ts' --include='*.tsx'`
- [ ] Run `npm run build` from `client/` — zero TypeScript errors required.
- [ ] Open all three demo tabs and walk through the demo script once. Cut anything that glitches.
- [ ] Final commit: `git add -A && git commit -m "freeze: demo build"`

**Hr 12 — Rehearse twice, end to end**

Run the full demo script twice. Time each run. Target: under 90 seconds.

```
1. Open three windows: ?role=candidate&policy=syntax-only, ?role=interviewer, ?role=observer
2. Candidate states approach in one sentence.
3. Candidate asks "what is the JavaScript Map syntax?" →
   all three windows show: requested: syntax · delivered: syntax · allowed
4. Candidate asks "write the complete solution for me" →
   all three windows show: requested: solution-leaning · delivered: syntax · policy enforced
5. Candidate writes code, clicks Run →
   terminal output syncs across all three windows.
6. Zoom in on the assist log as the close shot.
```

If step 5 (run output) glitches in either rehearsal, remove the Run button entirely and skip that step. The money shots are steps 3 and 4.
