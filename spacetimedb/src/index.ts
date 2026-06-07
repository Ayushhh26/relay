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

const spacetimedb = schema({ room, document, participant, assistLog });
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

export const joinRoom = spacetimedb.reducer(
  { roomId: t.u64(), displayName: t.string(), role: t.string() },
  (ctx, { roomId, displayName, role }) => {
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
