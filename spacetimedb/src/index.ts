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

// ── Schema ────────────────────────────────────────────────────────────────

const spacetimedb = schema({ room });
export default spacetimedb;

// ── Lifecycle ─────────────────────────────────────────────────────────────

export const init = spacetimedb.init((_ctx) => {
  // Phases 2+ add tables; lifecycle hooks extended there
});

export const onConnect = spacetimedb.clientConnected((_ctx) => {
  // Presence tracking added in Phase 3
});

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {
  // Presence tracking added in Phase 3
});

// ── Reducers ──────────────────────────────────────────────────────────────

export const createRoom = spacetimedb.reducer(
  { title: t.string() },
  (ctx, { title }) => {
    // Idempotent: skip if a room with this title already exists
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
