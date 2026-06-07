---
name: Relay Stage 2 — Video Call + Code Editor
overview: >
  Add (1) a LeetCode-style code editor panel with a hardcoded "Add Two Numbers" problem and
  harness-driven Run output, and (2) a WebRTC video sidebar with live camera tiles, audio level
  meters, heartbeat presence, and SpacetimeDB signaling — all wired into main's existing
  Lobby → Join → RoomView routing without touching the Lobby or Join flows.
reference_commits:
  - 13bb73573a64698b9eb00d0857f46625d59b93b2  # "code editor and camera on main page"
  - 831ac20321fcd05ee348bea4ba32adba0c462008  # "audio donezo"
todos:
  - id: s2-schema
    content: Extend participant table + add signalingMessage table + new reducers
    status: pending
  - id: s2-generate
    content: npm run spacetime:generate after schema changes
    status: pending
  - id: s2-new-files
    content: Create roomConfig.ts, videoConfig.ts, problem.ts, QuestionPanel.tsx, useAudioLevel.ts, useVideoCall.ts, VideoSidebar.tsx
    status: pending
  - id: s2-roomview
    content: Update RoomView.tsx — wire video sidebar, question panel, harness run, heartbeat, leaveRoom, isPresentParticipant
    status: pending
  - id: s2-worker
    content: Update worker.ts to accept optional harness string
    status: pending
  - id: s2-main
    content: Switch AnonConnector in main.tsx from localStorage to sessionStorage (required for multi-tab video)
    status: pending
  - id: s2-e2e
    content: Update tests/e2e/phase6.spec.ts to use add(a,b) harness output
    status: pending
  - id: s2-publish
    content: spacetime publish relay-demo + smoke test two-tab video + audio
    status: pending
isProject: false
---

# Relay Stage 2 — Video Call + Code Editor

## Goal

Merge the features from branch `check-code-terminal` (commits `13bb735` + `831ac20`) into **main**
without a git merge. All changes must be written fresh to fit main's architecture:

- Lobby → Join → `/room/:roomId` React Router routing (not URL-param `?room=1&role=candidate`)
- SpacetimeAuth OIDC (Stage 1) must still work
- All 13 unit tests and 19 E2E tests must stay green
- TDD: write failing tests first for any new testable logic
- **Video has no automated tests** — WebRTC + getUserMedia are not testable in Playwright; all video/audio checks are manual (see smoke test checklist)

---

## Critical architectural differences from the reference branch

| Topic | Reference branch | Main (target) |
|-------|-----------------|---------------|
| Routing | `?room=1&role=candidate` URL params | React Router `/room/:roomId`, role from DB `participant.role` |
| Room entry point | `App.tsx` (single component) | `RoomView.tsx` (route component) |
| Role source | `roomConfig.ts` parses `?role=` | Derived from `myParticipant.role` in `RoomView` |
| Room ID source | `roomConfig.ts` parses `?room=` | `useParams` `roomId` in `RoomView` |
| Anonymous token | `sessionStorage` in branch | `localStorage` in main's `AnonConnector` ← **must change** |
| OIDC auth | Not present | Present (Stage 1) |
| `joinRoom` reducer | Simpler (no user upsert, no seat-lock) | Has seat-lock + `user` table upsert ← **preserve, add video fields** |

**Do not use** `roomConfig.ts`'s URL-param exports (`ROOM_ID`, `ROLE_PARAM`, `NAME`, `HAS_VALID_ROLE`)
in `RoomView`. Those were for the old `?role=` architecture. `RoomView` already gets `roomId` from
`useParams` and role from the SpacetimeDB `participant` row.

---

## Stage 2.1 — SpacetimeDB schema + reducers

File: `relay/spacetimedb/src/index.ts`

### 2.1.1 Extend `participant` table

Append these columns **at the end** (required for safe additive migration — never reorder):

```typescript
// Append after existing joinedAt column:
muted: t.bool().default(false),
videoOff: t.bool().default(false),
lastSeenAt: t.u64().default(0n),   // heartbeat timestamp; 0 = legacy row / never heartbeated
audioLevel: t.u8().default(0),     // 0–100 speaking meter synced from client
```

**Migration rule:** Every new column MUST have `.default(...)`. The publish will fail with
"requires a default value annotation" if any is missing.

### 2.1.2 Add `signalingMessage` table

Add before the `schema(...)` call:

```typescript
const signalingMessage = table(
  { name: 'signaling_message', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64(),
    fromIdentity: t.identity(),
    toIdentity: t.identity(),
    msgType: t.string(),   // 'offer' | 'answer' | 'ice'
    payload: t.string(),   // JSON string — signaling only, never audio/video bytes
    createdAt: t.u64(),
  }
);
```

Add `signalingMessage` to the `schema(...)` call:

```typescript
const spacetimedb = schema({ room, document, participant, user, assistLog, runOutput, signalingMessage });
```

### 2.1.3 Add stale-participant helper

Add after existing permission helpers, before lifecycle hooks:

```typescript
const HEARTBEAT_STALE_MICROS = 30_000_000n; // 30 s

function deactivateStaleParticipants(ctx: any, roomId: bigint, now: bigint) {
  const senderHex = ctx.sender.toHexString();
  for (const p of ctx.db.participant.iter()) {
    if (p.roomId !== roomId || !p.active) continue;
    if (p.identity.toHexString() === senderHex) continue;
    const last = p.lastSeenAt ?? 0n;
    if ((last > 0n && now - last > HEARTBEAT_STALE_MICROS) || last === 0n) {
      ctx.db.participant.id.update({ ...p, active: false });
    }
  }
}

function isActiveParticipant(ctx: any, roomId: bigint): boolean {
  for (const p of ctx.db.participant.iter()) {
    if (p.roomId === roomId && p.active &&
        p.identity.toHexString() === ctx.sender.toHexString()) return true;
  }
  return false;
}
```

### 2.1.4 Update `joinRoom` — add video fields

In the existing `joinRoom` reducer (keep all seat-lock + user upsert logic intact), make two changes:

**1) Call stale cleanup at the top:**
```typescript
export const joinRoom = spacetimedb.reducer(
  { roomId: t.u64(), displayName: t.string(), role: t.string() },
  (ctx, { roomId, displayName, role }) => {
    const now = ctx.timestamp.microsSinceUnixEpoch;
    deactivateStaleParticipants(ctx, roomId, now);  // ← ADD THIS
    // ... rest of existing logic unchanged ...
```

**2) Add video fields to the `ctx.db.participant.insert(...)` call:**
```typescript
ctx.db.participant.insert({
  id: 0n, roomId, identity: ctx.sender, displayName, role,
  active: true,
  joinedAt: ctx.timestamp.microsSinceUnixEpoch,
  // ADD THESE:
  muted: false,
  videoOff: false,
  lastSeenAt: now,
  audioLevel: 0,
});
```

All other `joinRoom` logic (seat-lock, user upsert, document seed) stays exactly as-is.

### 2.1.5 Add new reducers

Add these after the existing `setRoomPolicy` reducer:

```typescript
export const heartbeat = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    const now = ctx.timestamp.microsSinceUnixEpoch;
    deactivateStaleParticipants(ctx, roomId, now);
    for (const p of ctx.db.participant.iter()) {
      if (p.roomId === roomId && p.active &&
          p.identity.toHexString() === ctx.sender.toHexString()) {
        ctx.db.participant.id.update({ ...p, lastSeenAt: now });
        return;
      }
    }
  }
);

export const leaveRoom = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    for (const p of ctx.db.participant.iter()) {
      if (p.roomId === roomId && p.active &&
          p.identity.toHexString() === ctx.sender.toHexString()) {
        ctx.db.participant.id.update({ ...p, active: false });
        return;
      }
    }
  }
);

export const sendSignal = spacetimedb.reducer(
  { roomId: t.u64(), toIdentity: t.identity(), msgType: t.string(), payload: t.string() },
  (ctx, { roomId, toIdentity, msgType, payload }) => {
    if (!isActiveParticipant(ctx, roomId)) return;
    if (!['offer', 'answer', 'ice'].includes(msgType)) return;
    ctx.db.signalingMessage.insert({
      id: 0n, roomId,
      fromIdentity: ctx.sender, toIdentity,
      msgType, payload,
      createdAt: ctx.timestamp.microsSinceUnixEpoch,
    });
  }
);

export const deleteSignal = spacetimedb.reducer(
  { signalId: t.u64() },
  (ctx, { signalId }) => {
    const row = ctx.db.signalingMessage.id.find(signalId);
    if (!row) return;
    if (row.toIdentity.toHexString() !== ctx.sender.toHexString()) return;
    ctx.db.signalingMessage.id.delete(signalId);
  }
);

export const updateMediaState = spacetimedb.reducer(
  { roomId: t.u64(), muted: t.bool(), videoOff: t.bool(), audioLevel: t.u8() },
  (ctx, { roomId, muted, videoOff, audioLevel }) => {
    if (!isActiveParticipant(ctx, roomId)) return;
    for (const p of ctx.db.participant.iter()) {
      if (p.roomId === roomId && p.active &&
          p.identity.toHexString() === ctx.sender.toHexString()) {
        ctx.db.participant.id.update({
          ...p, muted, videoOff,
          audioLevel: muted ? 0 : audioLevel,  // server forces 0 when muted
        });
        return;
      }
    }
  }
);
```

---

## Stage 2.2 — Regenerate bindings

```bash
npm run spacetime:generate
```

This adds to `src/module_bindings/`:
- `signaling_message_table.ts`
- `heartbeat_reducer.ts`
- `leave_room_reducer.ts`
- `send_signal_reducer.ts`
- `delete_signal_reducer.ts`
- `update_media_state_reducer.ts`
- Updated `participant_table.ts` (with `muted`, `videoOff`, `lastSeenAt`, `audioLevel`)
- Updated `types.ts` / `types/reducers.ts`

Do NOT hand-edit generated files.

---

## Stage 2.3 — New client files

### `src/videoConfig.ts`
Copy verbatim from commit `13bb735:src/videoConfig.ts`.

```typescript
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]
```

### `src/roomConfig.ts`
**Do NOT copy the branch's `roomConfig.ts` as-is.** Main uses React Router params; the branch's
`ROOM_ID`/`ROLE_PARAM`/`HAS_VALID_ROLE` exports are URL-param-based and will conflict.

Create a trimmed version that exports only the shared presence helper and type:

```typescript
import type { Participant } from './module_bindings/types'

export const VALID_ROLES = ['candidate', 'interviewer', 'observer'] as const
export type RoomRole = (typeof VALID_ROLES)[number]

const PRESENCE_STALE_MICROS = 35_000_000n  // 35 s (server stales at 30 s)

/** Hide participants whose heartbeat expired or who are inactive. */
export function isPresentParticipant(
  p: Pick<Participant, 'active' | 'lastSeenAt'>
): boolean {
  if (!p.active) return false
  if ((p.lastSeenAt ?? 0n) === 0n) return false
  const nowMicros = BigInt(Date.now()) * 1000n
  return nowMicros - p.lastSeenAt < PRESENCE_STALE_MICROS
}

export function roleLabel(role: string): string {
  if (role === 'candidate') return 'Candidate'
  if (role === 'interviewer') return 'Interviewer'
  if (role === 'observer') return 'Observer'
  return role
}
```

### `src/problem.ts`
Copy verbatim from commit `13bb735:src/problem.ts`.

```typescript
export const ADD_TWO_NUMBERS = {
  title: 'Add Two Numbers',
  description: 'Write a function `add(a, b)` that returns the sum of two numbers.',
  example: 'add(2, 3) → 5',
  starterCode: `function add(a, b) {\n  // return the sum of a and b\n  return 0;\n}`,
  runHarness: `
console.log('Running with hardcoded input: a=2, b=3');
const result = add(2, 3);
console.log('Output:', result);
console.log('Expected: 5');
if (result === 5) {
  console.log('✓ Passed');
} else {
  console.log('✗ Failed');
}
`,
}
```

### `src/QuestionPanel.tsx`
Copy verbatim from commit `13bb735:src/QuestionPanel.tsx`. No adaptation needed.

### `src/useAudioLevel.ts`
Copy verbatim from commit `831ac20:src/useAudioLevel.ts`. No adaptation needed.

### `src/useVideoCall.ts`
Copy verbatim from commit `831ac20:src/useVideoCall.ts`.

**The hook signature is already designed for passed-in props:**
```typescript
interface UseVideoCallProps {
  roomId: bigint      // ← from RoomView's useParams
  enabled: boolean    // ← isActive && !!myParticipant
  localRole: string   // ← myParticipant.role
}
```

No adaptation needed — it doesn't import from the URL-param parts of `roomConfig.ts`, only
`isPresentParticipant` which we've kept.

### `src/VideoSidebar.tsx`
Copy verbatim from commit `831ac20:src/VideoSidebar.tsx`. No adaptation needed.

---

## Stage 2.4 — Update `src/RoomView.tsx`

`RoomView.tsx` is the equivalent of the branch's `App.tsx` for the room view. Make these changes:

### 2.4.1 New imports

```typescript
import { useVideoCall } from './useVideoCall'
import { VideoSidebar } from './VideoSidebar'
import { QuestionPanel } from './QuestionPanel'
import { ADD_TWO_NUMBERS } from './problem'
import { isPresentParticipant } from './roomConfig'
```

### 2.4.2 New reducer hooks

Add alongside existing `updateDocument`, `appendRunOutput`, `clearRunOutput`:

```typescript
const heartbeat = useReducer(reducers.heartbeat)
const leaveRoom = useReducer(reducers.leaveRoom)
```

### 2.4.3 Update presence filter

The current filter `participants.filter(p => p.roomId === ROOM_ID && p.active)` doesn't account for
heartbeat expiry. Replace with:

```typescript
const activeParticipants = participants.filter(
  p => p.roomId === ROOM_ID && isPresentParticipant(p)
)
```

**Backward-compat note:** `isPresentParticipant` returns false when `lastSeenAt === 0n`. All new
joins (after 2.1.4) set `lastSeenAt`, so this is fine for new sessions. Old stale rows will
disappear from the presence bar, which is the correct behavior.

### 2.4.4 Starter code seeding ref

```typescript
const hasSeededStarter = useRef(false)
```

### 2.4.5 Heartbeat effect

```typescript
useEffect(() => {
  if (!isActive || !myParticipant) return
  heartbeat({ roomId: ROOM_ID })
  const id = window.setInterval(() => heartbeat({ roomId: ROOM_ID }), 10_000)
  return () => window.clearInterval(id)
}, [isActive, !!myParticipant])
```

### 2.4.6 Leave-room on tab close

```typescript
useEffect(() => {
  if (!isActive || !myParticipant) return
  const onLeave = () => leaveRoom({ roomId: ROOM_ID })
  window.addEventListener('pagehide', onLeave)
  return () => window.removeEventListener('pagehide', onLeave)
}, [isActive, !!myParticipant])
```

### 2.4.7 Starter-code seeding effect

Add after the existing remote doc sync effect:

```typescript
useEffect(() => {
  if (!isActive || !remoteDoc || hasSeededStarter.current) return
  if (remoteDoc.content.trim() !== '') return
  if (!canEditDoc) return   // ← guard: only candidate can call updateDocument
  hasSeededStarter.current = true
  updateDocument({ roomId: ROOM_ID, content: ADD_TWO_NUMBERS.starterCode })
  setLocalContent(ADD_TWO_NUMBERS.starterCode)
}, [isActive, remoteDoc?.content, canEditDoc])
```

**Why the guard matters:** Without `canEditDoc`, an interviewer tab that opens first would call
`updateDocument` (which the server rejects), set `hasSeededStarter.current = true`, and block
the seeding permanently — the candidate would see an empty editor forever.

**Why `canEditDoc` must be in the dep array:** If an interviewer opens the room before the
candidate, the effect fires with `canEditDoc = false` and exits early — correctly not consuming
`hasSeededStarter`. But without `canEditDoc` in deps, when the candidate later joins and
`canEditDoc` flips to `true`, React won't re-run the effect (because `remoteDoc.content` is still
`''`). Adding `canEditDoc` ensures the effect fires again when the candidate joins.

### 2.4.8 Update `handleRun` — add harness

Change the `worker.postMessage` call from:
```typescript
worker.postMessage({ code: editorValue })
```
to:
```typescript
worker.postMessage({ code: editorValue, harness: ADD_TWO_NUMBERS.runHarness })
```

### 2.4.9 Wire `useVideoCall`

Add after existing state declarations:

```typescript
const videoCall = useVideoCall({
  roomId: ROOM_ID,
  enabled: isActive && !!myParticipant,
  localRole: myParticipant?.role ?? '',
})
```

### 2.4.10 Update JSX layout

Replace the main area layout (the `<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>`)
to add VideoSidebar and QuestionPanel, and adjust editor/terminal flex heights:

```tsx
{/* Main area: video + editor+terminal + assist */}
<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
  <VideoSidebar call={videoCall} />
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <QuestionPanel
      title={ADD_TWO_NUMBERS.title}
      description={ADD_TWO_NUMBERS.description}
      example={ADD_TWO_NUMBERS.example}
    />
    {canEditDoc && (
      <div style={{ padding: '4px 8px', background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
        <button
          data-testid="run-button"
          onClick={handleRun}
          style={{ padding: '3px 14px', borderRadius: 4, fontSize: 12, background: '#16a34a', border: 'none', color: '#fff', cursor: 'pointer' }}
        >
          ▶ Run
        </button>
      </div>
    )}
    <div style={{ flex: '0 0 55%', overflow: 'hidden' }}>
      <Editor
        value={editorValue}
        onChange={canEditDoc ? handleChange : undefined}
        readOnly={!canEditDoc}
      />
    </div>
    <div style={{ flex: '0 0 35%', borderTop: '1px solid #1a1a1a', overflow: 'hidden' }}>
      <RunPanel outputs={roomOutputs} />
    </div>
  </div>
  <div style={{ width: 340, borderLeft: '1px solid #1a1a1a', overflow: 'hidden' }}>
    <AssistPanel roomId={ROOM_ID} policy={policy} canAsk={canAsk} />
  </div>
</div>
```

Editor changed from `60%` → `55%`; terminal from `40%` → `35%` (question panel takes ~10%).

---

## Stage 2.5 — Update `src/worker.ts`

Replace the entire file (copy from `13bb735:src/worker.ts`). The only change is adding `harness?`:

```typescript
export interface WorkerRequest {
  code: string
  harness?: string
}

export interface WorkerResponse {
  logs: Array<{ stream: 'stdout' | 'stderr'; text: string }>
  error: string | null
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const logs: Array<{ stream: 'stdout' | 'stderr'; text: string }> = []

  const fakeConsole = {
    log: (...args: unknown[]) => logs.push({ stream: 'stdout', text: args.map(String).join(' ') }),
    error: (...args: unknown[]) => logs.push({ stream: 'stderr', text: args.map(String).join(' ') }),
    warn: (...args: unknown[]) => logs.push({ stream: 'stderr', text: '[warn] ' + args.map(String).join(' ') }),
  }

  let error: string | null = null
  const source = e.data.harness ? `${e.data.code}\n${e.data.harness}` : e.data.code

  try {
    // eslint-disable-next-line no-new-func
    new Function('console', source)(fakeConsole)
  } catch (err) {
    error = String(err)
  }

  self.postMessage({ logs, error } satisfies WorkerResponse)
}
```

---

## Stage 2.6 — Update `src/main.tsx` — sessionStorage for multi-tab video

**Why:** Two open tabs (interviewer + candidate) sharing `localStorage` get the same SpacetimeDB
identity token → both tabs appear as the same person → video tiles show "yourself" for both.
`sessionStorage` is isolated per tab, so each tab gets its own identity.

In `AnonConnector` (the anonymous dev/CI path), change token storage from `localStorage` to
`sessionStorage`:

```typescript
function AnonConnector() {
  const connectionBuilder = useMemo(
    () =>
      DbConnection.builder()
        .withUri(HOST)
        .withDatabaseName(DB_NAME)
        .withToken(sessionStorage.getItem(TOKEN_KEY) || undefined)  // was localStorage
        .onConnect((_conn, identity, token) => {
          sessionStorage.setItem(TOKEN_KEY, token)                   // was localStorage
          sessionStorage.setItem(IDENTITY_KEY, identity.toHexString())
        })
        .onDisconnect(() => {})
        .onConnectError(() => {}),
    []
  )
  // ...
}
```

**Impact on E2E tests:** Each Playwright browser context gets its own `sessionStorage`, which is
exactly what we want — it already behaves like separate tabs. No E2E test changes needed for this.

**Impact on auth-enabled path (`AuthedConnector`):** No change — OIDC identity comes from the
JWT, not from stored tokens.

**Multi-tab video by environment:**

| Environment | Token source | Two-tab video works? |
|---|---|---|
| Local dev / CI (`VITE_AUTH_ENABLED=false`) | `sessionStorage` per tab (this change) | ✅ Each tab gets a unique anonymous identity |
| Vercel prod (`VITE_AUTH_ENABLED=true`) | OIDC `id_token` from Google/GitHub | ⚠️ Only if the two tabs sign in as **different users** (e.g. normal tab + incognito with a second account) |

The smoke test checklist uses local dev (anonymous). For production demo, open the candidate
link in an incognito window and sign in with a second Google account.

---

## Stage 2.7 — Update `tests/e2e/phase6.spec.ts`

Run now passes the `ADD_TWO_NUMBERS` harness, so terminal output changed. Update 3 tests:

**Test 1 — basic run:**
```typescript
await page1.locator('[data-testid="editor"]').fill('function add(a, b) {\n  return a + b;\n}')
await page1.locator('[data-testid="run-button"]').click()
await expect(page1.locator('[data-testid="run-panel"]')).toContainText('Output: 5', { timeout: 10_000 })
await expect(page1.locator('[data-testid="run-panel"]')).toContainText('✓ Passed', { timeout: 10_000 })
```

**Test 2 — sync across tabs:**
```typescript
await page1.locator('[data-testid="editor"]').fill('function add(a, b) {\n  return a + b;\n}')
await page1.locator('[data-testid="run-button"]').click()
await expect(page1.locator('[data-testid="run-panel"]')).toContainText('Output: 5', { timeout: 10_000 })
await expect(page2.locator('[data-testid="run-panel"]')).toContainText('Output: 5', { timeout: 12_000 })
```

**Test 3 — stderr on syntax error:**
```typescript
await page1.locator('[data-testid="editor"]').fill('function add(a, b) { throw new Error("boom") }')
```

---

## Stage 2.8 — Build, publish, and redeploy

```bash
# After schema edit:
npm run spacetime:generate

# Verify build is clean (catches TypeScript errors in new bindings):
npm run build

# Publish module to Maincloud:
npm run spacetime:publish
```

If publish fails with migration error ("requires a default value annotation"):
- Ensure every new column has `.default(...)` at end of `participant` table definition
- Re-run generate + publish

**Vercel frontend redeploy (required):** After `spacetime:generate`, the new bindings and UI
components won't be live until Vercel rebuilds. Trigger a redeploy via the Vercel dashboard or
by pushing to `main` — Vercel picks up the new `src/module_bindings/**` and all new component
files automatically.

---

## Implementation order (TDD gates)

```
1. Schema edits (index.ts) → spacetime:generate → npm run build (verify bindings compile)
2. Write failing unit test for isPresentParticipant → RED → implement roomConfig.ts → GREEN
3. Write failing phase6 E2E tests (new harness output) → RED
4. Create worker.ts + problem.ts + QuestionPanel.tsx → phase6 tests GREEN
5. Create videoConfig.ts, useAudioLevel.ts, useVideoCall.ts, VideoSidebar.tsx (copy verbatim from ref commits)
6. Update RoomView.tsx → npm run build → verify no TypeScript errors
7. Update main.tsx (sessionStorage for AnonConnector)
8. Run npm run test:unit → all 13 green
9. Cursor review → GREEN signal
10. npm run spacetime:publish (Maincloud module)
11. npm run test:e2e (local STDB, as CI does) → all 19 green
12. Push to main → Vercel auto-redeploys frontend
13. Manual two-tab smoke test on localhost (anonymous) + verify prod Vercel (two different OIDC accounts)
```

**Note on E2E target:** E2E tests run against a **local SpacetimeDB instance** (same as CI):
`VITE_SPACETIMEDB_HOST=ws://localhost:3000`. The Maincloud `npm run spacetime:publish` updates
the production module; `npm run test:e2e` verifies locally. Never run E2E directly against maincloud.

---

## Smoke test checklist (manual, post-publish)

**Local (anonymous — `VITE_AUTH_ENABLED=false`, two tabs = two identities):**

1. Open two tabs: `/join/:roomId?role=interviewer&name=Bob` and `/join/:roomId?role=candidate&name=Alice`
2. Both show `VideoSidebar` with **You (role)** as first tile
3. Remote camera appears on each tab's sidebar
4. **You hear the other person's audio** through speakers/headphones
5. Speaking bars animate on both tabs when either speaks (uses `participant.audioLevel`)
6. Toggle camera off → LED goes out; remote tile shows avatar (no frozen frame)
7. Mute → bars stop; other tab shows no bars; unmute → bars return
8. QuestionPanel shows "Add Two Numbers" above editor
9. Editor seeds `function add(a, b) { return 0; }` for new empty rooms
10. Click ▶ Run → terminal shows `Output: 0` and `✗ Failed`; fix to `return a + b` → `✓ Passed`
11. Observer tab joins → sees editor + video but can't run; leave tab → presence dot disappears within 35 s

**Production Vercel (`VITE_AUTH_ENABLED=true` — requires two different OIDC accounts):**

12. Normal tab: sign in with Google account A → join as interviewer
13. Incognito tab: sign in with Google account B → join as candidate via invite link
14. Remote video tiles appear on both sides; audio plays; speaking bars sync
15. `npm run test:e2e` (local) still 19/19 green

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Migration fails on maincloud (new columns without defaults) | All 4 new columns have `.default()` at end of participant; verify locally first |
| `isPresentParticipant` hides freshly-joined users briefly | `joinRoom` sets `lastSeenAt: now`; no gap |
| Ghost from old rows (`lastSeenAt: 0n`) | `isPresentParticipant` returns false for 0n; they disappear immediately |
| sessionStorage change breaks auth E2E | Auth-enabled path uses JWT identity, not sessionStorage token; unaffected |
| Phase6 E2E tests fail on new harness output | Update 3 tests as documented in 2.7 |
| WebRTC fails behind NAT (STUN only) | Known limitation; TURN is future work; document in README |
| `useVideoCall` imports `SenderError` from branch schema (not present) | It doesn't — hook is pure client code, no module imports |
| `roomConfig.ts` URL-param exports used accidentally | Only export `isPresentParticipant` + `roleLabel` + `VALID_ROLES` in main's version |
| Prod video shows "yourself" on both tabs (same Google account) | Use incognito + second Google account for prod smoke test; local anonymous is unaffected |
| Vercel shows old UI after module publish | Push to main triggers Vercel redeploy; new bindings and components land automatically |
| Interviewer opens room first → seeding silently fails | `canEditDoc` guard in seeding effect prevents the `hasSeededStarter` flag from being consumed by a non-candidate |

---

## File change summary

| Area | Files |
|------|-------|
| Module | `relay/spacetimedb/src/index.ts` |
| Generated | `relay/src/module_bindings/**` (auto) |
| New client | `src/videoConfig.ts`, `src/roomConfig.ts`, `src/problem.ts`, `src/QuestionPanel.tsx`, `src/useAudioLevel.ts`, `src/useVideoCall.ts`, `src/VideoSidebar.tsx` |
| Modified client | `src/RoomView.tsx`, `src/worker.ts`, `src/main.tsx` |
| Tests | `tests/e2e/phase6.spec.ts` (3 test body updates) |
