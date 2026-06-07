import { schema, table, t } from 'spacetimedb/server';

// ── Tables ────────────────────────────────────────────────────────────────

const room = table(
  { name: 'room', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    title: t.string(),
    createdBy: t.identity(),
    createdAt: t.u64(),
  }
);

const document = table(
  { name: 'document', public: true },
  {
    roomId: t.u64().primaryKey(),
    content: t.string(),
    updatedBy: t.identity(),
    updatedAt: t.u64(),
  }
);

const participant = table(
  { name: 'participant', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64(),
    identity: t.identity(),
    displayName: t.string(),
    role: t.string(),
    active: t.bool(),
    muted: t.bool(),
    videoOff: t.bool(),
    lastSeenAt: t.u64().default(0n),
    audioLevel: t.u8().default(0),
  }
);

/** Drop participants who stopped heartbeating (e.g. closed tab without disconnect). */
const HEARTBEAT_STALE_MICROS = 30_000_000n;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deactivateStaleParticipants(ctx: any, roomId: bigint, now: bigint) {
  const senderHex = ctx.sender.toHexString();
  for (const p of ctx.db.participant.iter()) {
    if (p.roomId !== roomId || !p.active) continue;
    if (p.identity.toHexString() === senderHex) continue;
    const last = p.lastSeenAt ?? 0n;
    if (last > 0n && now - last > HEARTBEAT_STALE_MICROS) {
      ctx.db.participant.id.update({ ...p, active: false });
    } else if (last === 0n) {
      // Legacy rows from before lastSeenAt existed — treat as stale ghosts
      ctx.db.participant.id.update({ ...p, active: false });
    }
  }
}

const signalingMessage = table(
  { name: 'signaling_message', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64(),
    fromIdentity: t.identity(),
    toIdentity: t.identity(),
    msgType: t.string(),
    payload: t.string(),
    createdAt: t.u64(),
  }
);

// ── Schema ────────────────────────────────────────────────────────────────

const assistLog = table(
  { name: 'assist_log', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64(),
    requestedBy: t.identity(),
    promptText: t.string(),
    responseText: t.string(),
    requestedType: t.string(),
    assistType: t.string(),
    policyStatus: t.string(),
    createdAt: t.u64(),
  }
);

const runOutput = table(
  { name: 'run_output', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64(),
    seq: t.u64(),
    stream: t.string(),
    text: t.string(),
    ts: t.u64(),
  }
);

const spacetimedb = schema({ room, document, participant, assistLog, runOutput, signalingMessage });
export default spacetimedb;

// ── Lifecycle ─────────────────────────────────────────────────────────────

export const init = spacetimedb.init((_ctx) => {});
export const onConnect = spacetimedb.clientConnected((_ctx) => {});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  for (const p of ctx.db.participant.iter()) {
    if (p.identity.toHexString() === ctx.sender.toHexString() && p.active) {
      ctx.db.participant.id.update({ ...p, active: false });
    }
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────

function isActiveParticipant(
  ctx: { db: { participant: { iter: () => Iterable<{ roomId: bigint; active: boolean; identity: { toHexString: () => string } }> } }; sender: { toHexString: () => string } },
  roomId: bigint,
) {
  for (const p of ctx.db.participant.iter()) {
    if (
      p.roomId === roomId &&
      p.active &&
      p.identity.toHexString() === ctx.sender.toHexString()
    ) {
      return true;
    }
  }
  return false;
}

// ── Reducers ──────────────────────────────────────────────────────────────

export const createRoom = spacetimedb.reducer(
  { title: t.string() },
  (ctx, { title }) => {
    for (const existing of ctx.db.room.iter()) {
      if (existing.title === title) return;
    }
    ctx.db.room.insert({
      id: 0n,
      title,
      createdBy: ctx.sender,
      createdAt: ctx.timestamp.microsSinceUnixEpoch,
    });
  }
);

export const updateDocument = spacetimedb.reducer(
  { roomId: t.u64(), content: t.string() },
  (ctx, { roomId, content }) => {
    const existing = ctx.db.document.roomId.find(roomId);
    if (existing) {
      ctx.db.document.roomId.update({
        ...existing,
        content,
        updatedBy: ctx.sender,
        updatedAt: ctx.timestamp.microsSinceUnixEpoch,
      });
    } else {
      ctx.db.document.insert({
        roomId,
        content,
        updatedBy: ctx.sender,
        updatedAt: ctx.timestamp.microsSinceUnixEpoch,
      });
    }
  }
);

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
      createdAt: ctx.timestamp.microsSinceUnixEpoch,
    });
  }
);

export const appendRunOutput = spacetimedb.reducer(
  { roomId: t.u64(), seq: t.u64(), stream: t.string(), text: t.string() },
  (ctx, { roomId, seq, stream, text }) => {
    ctx.db.runOutput.insert({ id: 0n, roomId, seq, stream, text, ts: ctx.timestamp.microsSinceUnixEpoch });
  }
);

export const clearRunOutput = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    for (const r of ctx.db.runOutput.iter()) {
      if (r.roomId === roomId) ctx.db.runOutput.id.delete(r.id);
    }
  }
);

export const joinRoom = spacetimedb.reducer(
  { roomId: t.u64(), displayName: t.string(), role: t.string() },
  (ctx, { roomId, displayName, role }) => {
    const now = ctx.timestamp.microsSinceUnixEpoch;
    deactivateStaleParticipants(ctx, roomId, now);

    // Remove any stale entries for this identity in this room
    for (const p of ctx.db.participant.iter()) {
      if (p.identity.toHexString() === ctx.sender.toHexString() && p.roomId === roomId) {
        ctx.db.participant.id.delete(p.id);
      }
    }
    ctx.db.participant.insert({
      id: 0n,
      roomId,
      identity: ctx.sender,
      displayName,
      role,
      active: true,
      muted: false,
      videoOff: false,
      lastSeenAt: now,
      audioLevel: 0,
    });

    // Seed document row for this room if it doesn't exist yet
    if (!ctx.db.document.roomId.find(roomId)) {
      ctx.db.document.insert({
        roomId,
        content: '',
        updatedBy: ctx.sender,
        updatedAt: ctx.timestamp.microsSinceUnixEpoch,
      });
    }
  }
);

export const sendSignal = spacetimedb.reducer(
  { roomId: t.u64(), toIdentity: t.identity(), msgType: t.string(), payload: t.string() },
  (ctx, { roomId, toIdentity, msgType, payload }) => {
    if (!isActiveParticipant(ctx, roomId)) return;
    if (msgType !== 'offer' && msgType !== 'answer' && msgType !== 'ice') return;

    ctx.db.signalingMessage.insert({
      id: 0n,
      roomId,
      fromIdentity: ctx.sender,
      toIdentity,
      msgType,
      payload,
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

export const heartbeat = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    const now = ctx.timestamp.microsSinceUnixEpoch;
    deactivateStaleParticipants(ctx, roomId, now);

    for (const p of ctx.db.participant.iter()) {
      if (
        p.roomId === roomId &&
        p.active &&
        p.identity.toHexString() === ctx.sender.toHexString()
      ) {
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
      if (
        p.roomId === roomId &&
        p.active &&
        p.identity.toHexString() === ctx.sender.toHexString()
      ) {
        ctx.db.participant.id.update({ ...p, active: false });
        return;
      }
    }
  }
);

export const updateMediaState = spacetimedb.reducer(
  { roomId: t.u64(), muted: t.bool(), videoOff: t.bool(), audioLevel: t.u8() },
  (ctx, { roomId, muted, videoOff, audioLevel }) => {
    if (!isActiveParticipant(ctx, roomId)) return;

    for (const p of ctx.db.participant.iter()) {
      if (
        p.roomId === roomId &&
        p.active &&
        p.identity.toHexString() === ctx.sender.toHexString()
      ) {
        ctx.db.participant.id.update({ ...p, muted, videoOff, audioLevel: muted ? 0 : audioLevel });
        return;
      }
    }
  }
);
