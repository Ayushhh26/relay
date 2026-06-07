import { schema, table, t, SenderError } from 'spacetimedb/server';

// ── Tables ────────────────────────────────────────────────────────────────

const room = table(
  { name: 'room', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    title: t.string(),
    createdBy: t.identity(),
    createdAt: t.u64(),
    kind: t.string().default('interview'),
    policy: t.string().default('syntax-only'),
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
    joinedAt: t.u64().default(0n),
  }
);

const user = table(
  { name: 'user', public: true },
  {
    identity: t.identity().primaryKey(),
    displayName: t.string(),
    createdAt: t.u64(),
  }
);

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

// ── Schema ────────────────────────────────────────────────────────────────

const spacetimedb = schema({ room, document, participant, user, assistLog, runOutput });
export default spacetimedb;

// ── Permission helpers ─────────────────────────────────────────────────────

function findRoom(ctx: any, roomId: bigint) {
  return ctx.db.room.id.find(roomId) ?? null;
}

function findActiveParticipant(ctx: any, roomId: bigint, identity: any) {
  for (const p of ctx.db.participant.iter()) {
    if (p.roomId === roomId && p.active && p.identity.toHexString() === identity.toHexString()) {
      return p;
    }
  }
  return null;
}

function requireParticipant(ctx: any, roomId: bigint, allowedRoles: string[]) {
  const p = findActiveParticipant(ctx, roomId, ctx.sender);
  if (!p) throw new SenderError('Not in room');
  if (!allowedRoles.includes(p.role)) throw new SenderError('Insufficient role');
}

function canEdit(ctx: any, roomId: bigint): boolean {
  const room = findRoom(ctx, roomId);
  const p = findActiveParticipant(ctx, roomId, ctx.sender);
  if (!p || !room) return false;
  const kind = room.kind || 'interview';
  return kind === 'interview' ? p.role === 'candidate' : false;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

export const init = spacetimedb.init((_ctx) => {});

const SPACETIMEDB_OIDC_ISSUER = 'https://auth.spacetimedb.com/oidc';

function isSpacetimeAuthOidc(jwt: unknown): boolean {
  if (jwt == null) return false;
  return (jwt as { issuer?: string }).issuer === SPACETIMEDB_OIDC_ISSUER;
}

export const onConnect = spacetimedb.clientConnected((ctx) => {
  const jwt = (ctx as any).senderAuth?.jwt ?? null;

  if (jwt != null) {
    const issuer: string = (jwt as any).issuer ?? '';
    // Local dev / anonymous tokens may carry a non-OIDC issuer — allow those for CI.
    // Only reject tokens that claim to be SpacetimeAuth but use a wrong issuer path.
    if (issuer.startsWith('https://auth.spacetimedb.com/') && issuer !== SPACETIMEDB_OIDC_ISSUER) {
      throw new SenderError('Invalid token issuer');
    }
  }

  const displayName = isSpacetimeAuthOidc(jwt)
    ? ((jwt as any).fullPayload['name']
        ?? (jwt as any).fullPayload['preferred_username']
        ?? (jwt as any).fullPayload['email']
        ?? ctx.sender.toHexString().slice(0, 8))
    : ctx.sender.toHexString().slice(0, 8);

  const existing = ctx.db.user.identity.find(ctx.sender);
  if (existing) {
    if (isSpacetimeAuthOidc(jwt)) {
      ctx.db.user.identity.update({ ...existing, displayName });
    }
  } else {
    ctx.db.user.insert({
      identity: ctx.sender,
      displayName,
      createdAt: ctx.timestamp.microsSinceUnixEpoch,
    });
  }
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  for (const p of ctx.db.participant.iter()) {
    if (p.identity.toHexString() === ctx.sender.toHexString() && p.active) {
      ctx.db.participant.id.update({ ...p, active: false });
    }
  }
});

// ── Reducers ──────────────────────────────────────────────────────────────

export const createRoom = spacetimedb.reducer(
  { title: t.string(), kind: t.string(), policy: t.string() },
  (ctx, { title, kind, policy }) => {
    ctx.db.room.insert({
      id: 0n,
      title,
      kind: kind || 'interview',
      policy: policy || 'syntax-only',
      createdBy: ctx.sender,
      createdAt: ctx.timestamp.microsSinceUnixEpoch,
    });
  }
);

export const joinRoom = spacetimedb.reducer(
  { roomId: t.u64(), displayName: t.string(), role: t.string() },
  (ctx, { roomId, displayName, role }) => {
    const room = findRoom(ctx, roomId);
    if (!room) throw new SenderError('Room not found');

    const validRoles = ['candidate', 'interviewer', 'observer'];
    if (!validRoles.includes(role)) throw new SenderError(`Invalid role: ${role}`);

    // One active candidate per room
    if (role === 'candidate') {
      for (const p of ctx.db.participant.iter()) {
        if (
          p.roomId === roomId && p.active && p.role === 'candidate' &&
          p.identity.toHexString() !== ctx.sender.toHexString()
        ) {
          throw new SenderError('Candidate seat already taken');
        }
      }
    }

    // Remove stale entries for this identity in this room
    for (const p of ctx.db.participant.iter()) {
      if (p.identity.toHexString() === ctx.sender.toHexString() && p.roomId === roomId) {
        ctx.db.participant.id.delete(p.id);
      }
    }

    // Upsert user displayName
    const existingUser = ctx.db.user.identity.find(ctx.sender);
    if (existingUser) {
      ctx.db.user.identity.update({ ...existingUser, displayName });
    } else {
      ctx.db.user.insert({ identity: ctx.sender, displayName, createdAt: ctx.timestamp.microsSinceUnixEpoch });
    }

    ctx.db.participant.insert({
      id: 0n,
      roomId,
      identity: ctx.sender,
      displayName,
      role,
      active: true,
      joinedAt: ctx.timestamp.microsSinceUnixEpoch,
    });

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

export const updateDocument = spacetimedb.reducer(
  { roomId: t.u64(), content: t.string() },
  (ctx, { roomId, content }) => {
    if (!canEdit(ctx, roomId)) throw new SenderError('Not allowed to edit');
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
    requireParticipant(ctx, args.roomId, ['candidate']);
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
    requireParticipant(ctx, roomId, ['candidate']);
    ctx.db.runOutput.insert({ id: 0n, roomId, seq, stream, text, ts: ctx.timestamp.microsSinceUnixEpoch });
  }
);

export const clearRunOutput = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    requireParticipant(ctx, roomId, ['candidate']);
    for (const r of ctx.db.runOutput.iter()) {
      if (r.roomId === roomId) ctx.db.runOutput.id.delete(r.id);
    }
  }
);

export const setRoomPolicy = spacetimedb.reducer(
  { roomId: t.u64(), policy: t.string() },
  (ctx, { roomId, policy }) => {
    requireParticipant(ctx, roomId, ['interviewer']);
    const room = findRoom(ctx, roomId);
    if (!room) throw new SenderError('Room not found');
    ctx.db.room.id.update({ ...room, policy });
  }
);
