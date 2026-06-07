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
    roomId: t.u64().primaryKey(),   // one document per room
    content: t.string(),
    updatedBy: t.identity(),
    updatedAt: t.u64(),
  }
);

// ── Schema ────────────────────────────────────────────────────────────────

const spacetimedb = schema({ room, document });
export default spacetimedb;

// ── Lifecycle ─────────────────────────────────────────────────────────────

export const init = spacetimedb.init((_ctx) => {});
export const onConnect = spacetimedb.clientConnected((_ctx) => {});
export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {});

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
