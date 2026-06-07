# Stage 3: P2P Study Session

Adds `kind: 'study'` rooms where every active participant can edit, run code, and use the AI assist panel together — all synced via SpacetimeDB. Interview rooms are unchanged.

---

## What already exists (no new tables needed)

| Thing | Status |
|---|---|
| `room.kind` column | ✅ Already in schema, defaults to `'interview'` |
| `createRoom(title, kind, policy)` | ✅ Already accepts kind param |
| `assist_log`, `run_output`, `document` tables | ✅ Already exist |
| `AssistPanel`, `Editor`, `RunPanel`, `worker.ts` | ✅ Already exist |
| Routes `/`, `/join/:id`, `/room/:id` | ✅ Already exist |

---

## What needs to change

### Server (`spacetimedb/src/index.ts`)

| Location | Current | Required |
|---|---|---|
| `joinRoom` valid roles | `['candidate','interviewer','observer']` | `validRolesForKind(room.kind)` |
| `joinRoom` seat check | One active candidate per room | Skip for study rooms |
| `canEdit()` | Only candidate in interview rooms | Also any active participant in study rooms |
| `appendRunOutput` | `requireParticipant(['candidate'])` | Also allow `host`, `member` |
| `clearRunOutput` | `requireParticipant(['candidate'])` | Also allow `host`, `member` |
| `finalizeAssistLog` | `requireParticipant(['candidate'])` | Also allow `host`, `member` |
| `setRoomPolicy` | `requireParticipant(['interviewer'])` | Also allow `host` |

### Client files to create

| File | Purpose |
|---|---|
| `src/roomMembership.ts` | Save / load `{ displayName, role }` per roomId in sessionStorage |
| `src/assistContext.ts` | Study assist payload type + `formatRunOutput` helper |

### Client files to modify

| File | Key changes |
|---|---|
| `src/roomConfig.ts` | Add `STUDY_ROLES`, `isStudyRoom(kind)`, `validRolesForKind(kind)`, update `roleLabel` |
| `src/Lobby.tsx` | Room kind selector; when study → host/member invite links + "Enter as host" button; `saveRoomMembership` on host entry |
| `src/Join.tsx` | Validate role vs room kind; call `saveRoomMembership` before navigating |
| `src/RoomView.tsx` | Study permissions; no QuestionPanel/seeding/harness; refresh rejoin via sessionStorage; host/member DOT_COLOR |
| `src/AssistPanel.tsx` | Accept `roomKind`, `code`, `runOutput` props; send context for study rooms |
| `src/useVideoCall.ts` | Add `host`/`member` to `ROLE_ORDER` |

### API files

| File | Key changes |
|---|---|
| `relay-api/src/buildAssistMessages.ts` | New file — build system/user messages for study vs. interview |
| `relay-api/api/assist.ts` | Accept `roomKind`, `code`, `runOutput`, `role`, `roomTitle`; use context for study |

---

## Task sequence (TDD — test first, implement second)

### Task 1 — TDD RED: Write failing E2E tests (`tests/e2e/phase7.spec.ts`)

Write these four tests. They will all fail until Tasks 2–8 are complete.

Phase 7 tests drive the Lobby directly (selecting `room-kind-select`) rather than using a helper, since the existing `openRoom`/`createRoomFromLobby` helpers hard-code `kind: 'interview'`:

```
Test 1: Lobby → select kind=study → create → "Enter as host" appears → host enters room, editor is blank
Test 2: host edits editor → member tab (new context, /join/:id?role=member&name=Bob) sees live update
Test 3: member clicks Run → both tabs see output in RunPanel
Test 4: member asks Assist → both tabs see the answer in assist log
```

**Test 4 must mock `/api/assist`** (same pattern as phase4.spec.ts) so CI does not depend on live API keys:
```typescript
await page1.route('**/api/assist', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      response: 'mock study answer',
      requestedType: 'syntax',
      assistType: 'syntax',
      policyStatus: 'allowed',
    }),
  })
})
// Set same mock on page2 so the fetch from either tab is intercepted:
await page2.route('**/api/assist', async route => { /* same fulfill */ })
```

Confirm RED (all 4 fail) before writing any production code.

---

### Task 2 — Server: role validation + study permissions

File: `spacetimedb/src/index.ts`

**2a. Add `validRolesForKind` helper** (after `findRoom`):
```typescript
function validRolesForKind(kind: string): string[] {
  return kind === 'study'
    ? ['host', 'member']
    : ['candidate', 'interviewer', 'observer']
}
```

**2b. Update `canEdit()`** (replace the last line):
```typescript
// Before:
return kind === 'interview' ? p.role === 'candidate' : false;

// After:
if (kind === 'study') return true  // any active participant
return p.role === 'candidate'       // interview: candidate only
```

**2c. Update `joinRoom`** — replace the hard-coded role list and candidate seat check:
```typescript
// Replace:
const validRoles = ['candidate', 'interviewer', 'observer'];
if (!validRoles.includes(role)) throw new SenderError(`Invalid role: ${role}`);
if (role === 'candidate') { /* seat check */ }

// With:
const roomKind = room.kind || 'interview'
if (!validRolesForKind(roomKind).includes(role))
  throw new SenderError(`Invalid role: ${role}`)

// Candidate seat check — only for interview rooms:
if (roomKind === 'interview' && role === 'candidate') {
  for (const p of ctx.db.participant.iter()) {
    if (p.roomId === roomId && p.active && p.role === 'candidate' &&
        p.identity.toHexString() !== ctx.sender.toHexString()) {
      throw new SenderError('Candidate seat already taken')
    }
  }
}
```

**2d. Update `appendRunOutput` + `clearRunOutput`** — replace role list in both:
```typescript
const r = findRoom(ctx, roomId)
const allowed = r?.kind === 'study' ? ['host', 'member'] : ['candidate']
requireParticipant(ctx, roomId, allowed)
```

**2e. Update `finalizeAssistLog`** — same pattern as 2d:
```typescript
const r = findRoom(ctx, args.roomId)
const allowed = r?.kind === 'study' ? ['host', 'member'] : ['candidate']
requireParticipant(ctx, args.roomId, allowed)
```

**2f. Update `setRoomPolicy`**:
```typescript
const r = findRoom(ctx, roomId)
const allowed = r?.kind === 'study' ? ['host'] : ['interviewer']
requireParticipant(ctx, roomId, allowed)
```

After all server edits: `npm run spacetime:generate`.

---

### Task 3 — Client utilities

**3a. Create `src/roomMembership.ts`**:
```typescript
const KEY = (roomId: string | bigint) => `relay:membership:${roomId}`

export interface RoomMembership {
  displayName: string
  role: string
}

export function saveRoomMembership(roomId: string | bigint, m: RoomMembership) {
  sessionStorage.setItem(KEY(roomId), JSON.stringify(m))
}

export function loadRoomMembership(roomId: string | bigint): RoomMembership | null {
  try {
    const raw = sessionStorage.getItem(KEY(roomId))
    return raw ? (JSON.parse(raw) as RoomMembership) : null
  } catch {
    return null
  }
}

export function clearRoomMembership(roomId: string | bigint) {
  sessionStorage.removeItem(KEY(roomId))
}
```

**3b. Create `src/assistContext.ts`**:
```typescript
import type { RunOutput } from './module_bindings/types'

export interface StudyAssistPayload {
  prompt: string
  policy: string
  roomKind: string
  code: string
  runOutput: string
  role: string
  roomTitle: string
}

export function formatRunOutput(rows: RunOutput[]): string {
  return [...rows]
    .sort((a, b) => Number(a.seq - b.seq))
    .map(r => r.text)
    .join('\n')
}
```

**3c. Update `src/roomConfig.ts`**:
```typescript
export const VALID_ROLES = ['candidate', 'interviewer', 'observer'] as const
export type RoomRole = (typeof VALID_ROLES)[number]

export const STUDY_ROLES = ['host', 'member'] as const
export type StudyRole = (typeof STUDY_ROLES)[number]

export function isStudyRoom(kind?: string): boolean {
  return kind === 'study'
}

export function validRolesForKind(kind?: string): string[] {
  return isStudyRoom(kind) ? [...STUDY_ROLES] : [...VALID_ROLES]
}

// extend roleLabel:
export function roleLabel(role: string): string {
  if (role === 'candidate') return 'Candidate'
  if (role === 'interviewer') return 'Interviewer'
  if (role === 'observer') return 'Observer'
  if (role === 'host') return 'Host'
  if (role === 'member') return 'Member'
  return role
}

// isPresentParticipant unchanged
```

---

### Task 4 — Lobby: room kind selector

File: `src/Lobby.tsx`

**4a. State** — add `const [kind, setKind] = useState('interview')` next to existing state.

**4b. Import** — `import { saveRoomMembership } from './roomMembership'`

**4c. New `<select>` between title input and policy select**:
```tsx
<select
  data-testid="room-kind-select"
  value={kind}
  onChange={e => setKind(e.target.value)}
  style={/* same style as policy select */}
>
  <option value="interview">Interview (candidate edits)</option>
  <option value="study">Study session (everyone edits)</option>
</select>
```

**4d. `handleCreate`** — change `kind: 'interview'` to `kind`.

**4e. Enter button** — replace `useEnterAsInterviewer` with a kind-aware hook or extend it:
```typescript
// In enter() callback — for study rooms, role = 'host'; for interview, role = 'interviewer'
const role = createdRoom?.kind === 'study' ? 'host' : 'interviewer'
await joinRoom({ roomId: BigInt(roomId), displayName, role })
// Save membership so refresh-rejoin works from Lobby entry too:
saveRoomMembership(roomId, { displayName, role })
navigate(`/room/${roomId}`, { replace: true })
```

**4f. Invite links** — branch on `createdRoom?.kind`:
- `'study'`: show host link (`/join/${id}?role=host`) + member link (`/join/${id}?role=member`); hide candidate/interviewer/observer links
- `'interview'` (default): no change
- Button label/testId: `'Enter as host →'` / `data-testid="enter-as-host-btn"` for study; existing `'Enter as interviewer →'` / `"enter-as-interviewer-btn"` for interview

---

### Task 5 — Join: role validation + membership save

File: `src/Join.tsx`

**5a. Imports**:
```typescript
import { validRolesForKind, isStudyRoom } from './roomConfig'
import { saveRoomMembership } from './roomMembership'
```

**5b. Role validation** — after `room` is resolved and `roomsReady` is true:
```typescript
if (!validRolesForKind(room.kind).includes(role)) {
  setJoinError(`Role "${role}" is not valid for this room type`)
  return
}
```

**5c. Candidate seat check** — guard with `!isStudyRoom(room?.kind)`:
```typescript
// was: if (role === 'candidate' && activeCandidates.length > 0)
if (!isStudyRoom(room?.kind) && role === 'candidate' && activeCandidates.length > 0) {
  setJoinError('Candidate seat already taken')
  return
}
```

**5d. Save membership** — before every `navigate(...)` call in `handleJoin` and the auto-join effect:
```typescript
saveRoomMembership(roomId, { displayName: name.trim() || nameFromUrl, role })
navigate(`/room/${roomId}`, { replace: true })
```

**5e. Auto-join effect deps** — add `room?.kind` and `role` so the effect re-evaluates if either changes before subscriptions settle:
```typescript
}, [isActive, roomsReady, participantsReady, activeCandidates.length, room?.kind, role])
```

---

### Task 6 — RoomView: study mode

File: `src/RoomView.tsx`

**6a. New imports**:
```typescript
import { useNavigate } from 'react-router-dom'          // add (not currently imported)
import { isStudyRoom } from './roomConfig'
import { loadRoomMembership } from './roomMembership'
import { formatRunOutput } from './assistContext'
```

**6b. New hooks at the top of `RoomView()`**:
```typescript
const navigate = useNavigate()                           // add (not currently present)
const joinRoom = useReducer(reducers.joinRoom)           // add (not currently present)
```

**6c. Derive study flag** (after `currentRoom` is resolved):
```typescript
const isStudy = isStudyRoom(currentRoom?.kind)
```

**6d. Update permissions** (lines 48–49 in current file):
```typescript
// Before:
const canEditDoc = myParticipant?.role === 'candidate'
const canAsk = myParticipant?.role === 'candidate'

// After:
const canEditDoc = isStudy ? !!myParticipant : myParticipant?.role === 'candidate'
const canAsk = canEditDoc
```

**6e. Guard QuestionPanel** — wrap in `{!isStudy && <QuestionPanel ... />}`.

**6f. Guard starter-code seeding** — add early return to existing seeding effect:
```typescript
useEffect(() => {
  if (isStudy) return       // study rooms start blank — no seeding
  if (!isActive || !remoteDoc || hasSeededStarter.current) return
  // ... rest of existing logic unchanged
}, [isActive, remoteDoc?.content, canEditDoc, isStudy])
```

**6g. Guard test harness in `handleRun`**:
```typescript
worker.postMessage({
  code: editorValue,
  harness: isStudy ? undefined : ADD_TWO_NUMBERS.runHarness,
})
```

**6h. Add host/member to `DOT_COLOR`** (lines 14–18):
```typescript
const DOT_COLOR: Record<string, string> = {
  candidate: '#4ade80',
  interviewer: '#60a5fa',
  observer: '#a78bfa',
  host: '#f59e0b',     // amber
  member: '#34d399',   // emerald
}
```

**6i. Capture subscription readiness flags from `useTable`** — participants readiness is required so the rejoin effect doesn't fire before SpacetimeDB delivers the initial snapshot (which would incorrectly treat a present participant as absent and trigger a double-join or redirect):
```typescript
// Change these existing lines:
const [rooms] = useTable(tables.room)
const [participants] = useTable(tables.participant)

// To (capture readiness):
const [rooms, roomsReady] = useTable(tables.room)
const [participants, participantsReady] = useTable(tables.participant)
```

**6j. Refresh rejoin effect** — add after existing effects:
```typescript
const hasRejoined = useRef(false)
useEffect(() => {
  if (!isActive || !participantsReady || hasRejoined.current) return
  if (myParticipant) { hasRejoined.current = true; return }
  const saved = loadRoomMembership(ROOM_ID)
  if (!saved) { navigate(`/join/${String(ROOM_ID)}`, { replace: true }); return }
  hasRejoined.current = true
  joinRoom({ roomId: ROOM_ID, displayName: saved.displayName, role: saved.role })
}, [isActive, participantsReady, myParticipant])
```

**6j. Pass context to `AssistPanel`**:
```typescript
<AssistPanel
  roomId={ROOM_ID}
  policy={policy}
  canAsk={canAsk}
  roomKind={currentRoom?.kind ?? 'interview'}
  code={editorValue}
  runOutput={roomOutputs}          // the filtered RunOutput[] array (already named roomOutputs)
  roomTitle={currentRoom?.title ?? ''}
  myRole={myParticipant?.role ?? ''}
/>
```

---

### Task 7 — AssistPanel: context-aware assist

File: `src/AssistPanel.tsx`

**7a. Updated Props interface**:
```typescript
import type { RunOutput } from './module_bindings/types'

interface Props {
  roomId: bigint
  policy: string
  canAsk: boolean
  roomKind: string         // new
  code: string             // new
  runOutput: RunOutput[]   // new
  roomTitle: string        // new
  myRole: string           // new
}
```

**7b. Import `formatRunOutput`**:
```typescript
import { formatRunOutput } from './assistContext'
```

**7c. Update `handleAsk`** — branch on `roomKind`:
```typescript
const body = roomKind === 'study'
  ? { prompt: sent, policy, roomKind, code, runOutput: formatRunOutput(runOutput), role: myRole, roomTitle }
  : { prompt: sent, policy }

const res = await fetch(`${API_URL}/api/assist`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
```

**7d. Update "can't ask" message**:
```typescript
{!canAsk && (
  <div style={{ fontSize: 11, opacity: 0.3, textAlign: 'center', padding: '6px 0' }}>
    {roomKind === 'study'
      ? 'Join the room to request assistance'
      : 'Only candidates can request assistance'}
  </div>
)}
```

---

### Task 8 — API: study context prompts

The policy enforcement logic in `assist.ts` already computes a correct `systemPrompt` string from policy + downgrade state. `buildAssistMessages` must receive that finished string — not reconstruct it from `assistType` — so no policy logic is duplicated or lost.

**8a. Create `relay-api/src/buildAssistMessages.ts`**:
```typescript
// Accepts the already-computed systemPrompt from assist.ts (policy + downgrade applied).
// Only responsibility: inject code/terminal context into the user message for study rooms.
export function buildAssistMessages(
  systemPrompt: string,
  prompt: string,
  opts: { roomKind?: string; code?: string; runOutput?: string; roomTitle?: string }
): { role: string; content: string }[] {
  if (opts.roomKind !== 'study') {
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ]
  }

  const contextParts: string[] = []
  if (opts.roomTitle) contextParts.push(`Session: ${opts.roomTitle}`)
  if (opts.code?.trim()) contextParts.push(`Current code:\n\`\`\`\n${opts.code}\n\`\`\``)
  if (opts.runOutput?.trim()) contextParts.push(`Terminal output:\n\`\`\`\n${opts.runOutput}\n\`\`\``)

  const userContent = contextParts.length > 0
    ? `${contextParts.join('\n\n')}\n\nQuestion: ${prompt}`
    : prompt

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]
}
```

**8b. Update `relay-api/api/assist.ts`**:
- Import `buildAssistMessages` from `'../src/buildAssistMessages'`
- Destructure new fields from request body: `roomKind`, `code`, `runOutput`, `role`, `roomTitle`
- The existing `systemPrompt` variable (lines 26–32) is already correctly computed from policy + downgrade — **do not change it**
- Replace the inline `messages` array with:
  ```typescript
  const messages = buildAssistMessages(systemPrompt, prompt, { roomKind, code, runOutput, roomTitle })
  ```
- Everything else in `assist.ts` (classification, downgrade, response, policyStatus) is **unchanged**

---

### Task 9 — TDD GREEN: verify all tests pass

```bash
# 1. Republish module (server permission changes)
cd relay
spacetime publish relay-demo --module-path spacetimedb -y --server local

# 2. Regenerate client bindings (after server changes)
npm run spacetime:generate

# 3. Run unit tests
npm run test:unit -- --run

# 4. Rebuild with local env, then run E2E
VITE_AUTH_ENABLED=false VITE_SPACETIMEDB_HOST=ws://127.0.0.1:3000 \
  VITE_SPACETIMEDB_DB_NAME=relay-demo npm run build
npm run test:e2e
```

**Separate relay-api redeploy required** — Task 8 changes `relay-api/api/assist.ts`. The Vercel frontend auto-deploy does NOT update `relay-api`. After merging, manually trigger a redeploy of the `relay-api` Vercel project:
```bash
cd relay-api
vercel --prod
```

**Manual smoke test**:
1. `spacetime start` + `spacetime publish relay-demo ...`
2. Lobby → kind = Study session → create → "Enter as host" → blank editor
3. New tab: `/join/{id}?role=member&name=Bob` → member joins, blank editor
4. Host types → member sees update live
5. Member clicks Run → both tabs see output in RunPanel
6. Member asks Assist → both tabs see answer in panel
7. Refresh host tab → brief rejoin → back in room as host
8. Create an interview room → confirm candidate-only behavior unchanged
9. Phase 1–6 E2E: confirm no regressions

---

## Constraints

- **No new SpacetimeDB tables** — `room`, `document`, `run_output`, `assist_log`, `participant` are sufficient
- **LLM key stays server-side** — `relay-api/api/assist.ts` only, never in a `VITE_` variable
- **SDK**: use `spacetimedb` v2.4.1, not `@clockworklabs/spacetimedb-sdk`, no `withModuleName`
- **Role validation in both layers** — client-side for UX, server-side for enforcement
- **sessionStorage** for per-tab identity isolation (not localStorage)
- **Last-writer-wins (known limitation)** — study mode uses whole-document debounced replace. If two participants type simultaneously the later write wins and the other's changes are lost. Acceptable for MVP; not a bug — just a known constraint of the current architecture.
- **Video sidebar stays in study rooms** — `VideoSidebar` remains mounted in study rooms (same as interview). Video is optional in both modes; no layout changes needed.
- **relay-api is a separate Vercel project** — must be redeployed independently after Task 8; frontend auto-deploy won't cover it.

---

## Unit tests to add alongside implementation

| Test file | What to cover |
|---|---|
| `tests/unit/roomConfig.test.ts` | `isStudyRoom`, `validRolesForKind`, `roleLabel` for host/member |
| `tests/unit/roomMembership.test.ts` | save/load/clear round-trip in fake sessionStorage |

---

## Files inventory summary

```
CREATE
  src/roomMembership.ts
  src/assistContext.ts
  relay-api/src/buildAssistMessages.ts
  tests/e2e/phase7.spec.ts
  tests/unit/roomConfig.test.ts        (extend or new)
  tests/unit/roomMembership.test.ts

MODIFY
  spacetimedb/src/index.ts      ← role validation + study permissions
  src/roomConfig.ts             ← STUDY_ROLES, isStudyRoom, validRolesForKind, roleLabel
  src/Lobby.tsx                 ← kind selector, host/member links, saveRoomMembership
  src/Join.tsx                  ← role validation, saveRoomMembership
  src/RoomView.tsx              ← study mode, no panel/seeding, rejoin, DOT_COLOR
  src/AssistPanel.tsx           ← context props, study body
  src/useVideoCall.ts           ← add host/member to ROLE_ORDER
  relay-api/api/assist.ts       ← accept context, use buildAssistMessages

UNCHANGED
  src/Editor.tsx
  src/RunPanel.tsx
  src/worker.ts
  src/App.tsx
  src/VideoSidebar.tsx
  src/videoConfig.ts
```
