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
    selectedQuestionId: t.string().default(''),
    editorMode: t.string().default('code'),
    closedAt: t.u64().default(0n),
  }
);

const document = table(
  { name: 'document', public: true },
  {
    roomId: t.u64().primaryKey(),
    content: t.string(),
    updatedBy: t.identity(),
    updatedAt: t.u64(),
    language: t.string().default('javascript'),
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
    // Video columns — appended with .default() for safe additive migration
    muted: t.bool().default(false),
    videoOff: t.bool().default(false),
    lastSeenAt: t.u64().default(0n),
    audioLevel: t.u8().default(0),
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

const spacetimedb = schema({ room, document, participant, user, assistLog, runOutput, signalingMessage });
export default spacetimedb;

// ── Permission helpers ─────────────────────────────────────────────────────

function findRoom(ctx: any, roomId: bigint) {
  return ctx.db.room.id.find(roomId) ?? null;
}

function isRoomClosed(room: { closedAt?: bigint } | null): boolean {
  return (room?.closedAt ?? 0n) > 0n;
}

function deactivateAllParticipants(ctx: any, roomId: bigint) {
  for (const p of ctx.db.participant.iter()) {
    if (p.roomId === roomId && p.active) {
      ctx.db.participant.id.update({ ...p, active: false });
    }
  }
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

function validRolesForKind(kind: string): string[] {
  return kind === 'study'
    ? ['host', 'member']
    : ['candidate', 'interviewer', 'observer'];
}

function canEdit(ctx: any, roomId: bigint): boolean {
  const room = findRoom(ctx, roomId);
  const p = findActiveParticipant(ctx, roomId, ctx.sender);
  if (!p || !room) return false;
  const kind = room.kind || 'interview';
  if (kind === 'study') return true;  // any active participant
  return p.role === 'candidate';      // interview: candidate only
}

// ── Video helpers ──────────────────────────────────────────────────────────

const HEARTBEAT_STALE_MICROS = 30_000_000n;

function deactivateStaleParticipants(ctx: any, roomId: bigint, now: bigint) {
  const senderHex = ctx.sender.toHexString();
  for (const p of ctx.db.participant.iter()) {
    if (p.roomId !== roomId || !p.active) continue;
    if (p.identity.toHexString() === senderHex) continue;
    const last: bigint = p.lastSeenAt ?? 0n;
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
  { title: t.string(), kind: t.string(), policy: t.string(), editorMode: t.string() },
  (ctx, { title, kind, policy, editorMode }) => {
    const roomKind = kind || 'interview';
    const mode = roomKind === 'study' && editorMode === 'notepad' ? 'notepad' : 'code';
    ctx.db.room.insert({
      id: 0n,
      title,
      kind: roomKind,
      policy: policy || 'syntax-only',
      selectedQuestionId: '',
      editorMode: mode,
      createdBy: ctx.sender,
      createdAt: ctx.timestamp.microsSinceUnixEpoch,
      closedAt: 0n,
    });
  }
);

export const joinRoom = spacetimedb.reducer(
  { roomId: t.u64(), displayName: t.string(), role: t.string() },
  (ctx, { roomId, displayName, role }) => {
    const now = ctx.timestamp.microsSinceUnixEpoch;
    deactivateStaleParticipants(ctx, roomId, now);

    const room = findRoom(ctx, roomId);
    if (!room) throw new SenderError('Room not found');
    if (isRoomClosed(room)) throw new SenderError('This session has ended');

    const roomKind = room.kind || 'interview';
    if (!validRolesForKind(roomKind).includes(role))
      throw new SenderError(`Invalid role: ${role}`);

    // One active candidate per room — interview only
    if (roomKind === 'interview' && role === 'candidate') {
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
      ctx.db.user.insert({ identity: ctx.sender, displayName, createdAt: now });
    }

    ctx.db.participant.insert({
      id: 0n,
      roomId,
      identity: ctx.sender,
      displayName,
      role,
      active: true,
      joinedAt: now,
      muted: false,
      videoOff: false,
      lastSeenAt: now,
      audioLevel: 0,
    });

    if (!ctx.db.document.roomId.find(roomId)) {
      ctx.db.document.insert({
        roomId,
        content: '',
        language: 'javascript',
        updatedBy: ctx.sender,
        updatedAt: now,
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
        language: 'javascript',
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
    const r = findRoom(ctx, args.roomId);
    const allowed = r?.kind === 'study' ? ['host', 'member'] : ['candidate'];
    requireParticipant(ctx, args.roomId, allowed);
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
    const r = findRoom(ctx, roomId);
    const allowed = r?.kind === 'study' ? ['host', 'member'] : ['candidate'];
    requireParticipant(ctx, roomId, allowed);
    ctx.db.runOutput.insert({ id: 0n, roomId, seq, stream, text, ts: ctx.timestamp.microsSinceUnixEpoch });
  }
);

export const clearRunOutput = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    const r = findRoom(ctx, roomId);
    const allowed = r?.kind === 'study' ? ['host', 'member'] : ['candidate'];
    requireParticipant(ctx, roomId, allowed);
    for (const r of ctx.db.runOutput.iter()) {
      if (r.roomId === roomId) ctx.db.runOutput.id.delete(r.id);
    }
  }
);

export const setDocumentLanguage = spacetimedb.reducer(
  { roomId: t.u64(), language: t.string(), content: t.string() },
  (ctx, { roomId, language, content }) => {
    if (!['javascript', 'python'].includes(language)) throw new SenderError('Invalid language');
    if (!canEdit(ctx, roomId)) throw new SenderError('Not allowed to edit');
    const now = ctx.timestamp.microsSinceUnixEpoch;
    const existing = ctx.db.document.roomId.find(roomId);
    if (existing) {
      ctx.db.document.roomId.update({
        ...existing,
        language,
        content,
        updatedBy: ctx.sender,
        updatedAt: now,
      });
    } else {
      ctx.db.document.insert({
        roomId,
        content,
        language,
        updatedBy: ctx.sender,
        updatedAt: now,
      });
    }
  }
);

export const selectInterviewQuestion = spacetimedb.reducer(
  { roomId: t.u64(), questionId: t.string(), starterCode: t.string() },
  (ctx, { roomId, questionId, starterCode }) => {
    requireParticipant(ctx, roomId, ['interviewer', 'observer']);
    const room = findRoom(ctx, roomId);
    if (!room) throw new SenderError('Room not found');
    ctx.db.room.id.update({ ...room, selectedQuestionId: questionId });

    const now = ctx.timestamp.microsSinceUnixEpoch;
    const existing = ctx.db.document.roomId.find(roomId);
    if (existing) {
      ctx.db.document.roomId.update({
        ...existing,
        content: starterCode,
        updatedBy: ctx.sender,
        updatedAt: now,
      });
    } else {
      ctx.db.document.insert({
        roomId,
        content: starterCode,
        language: 'javascript',
        updatedBy: ctx.sender,
        updatedAt: now,
      });
    }

    for (const r of ctx.db.runOutput.iter()) {
      if (r.roomId === roomId) ctx.db.runOutput.id.delete(r.id);
    }
  }
);

export const setRoomPolicy = spacetimedb.reducer(
  { roomId: t.u64(), policy: t.string() },
  (ctx, { roomId, policy }) => {
    const r = findRoom(ctx, roomId);
    const allowed = r?.kind === 'study' ? ['host'] : ['interviewer'];
    requireParticipant(ctx, roomId, allowed);
    const room = findRoom(ctx, roomId);
    if (!room) throw new SenderError('Room not found');
    ctx.db.room.id.update({ ...room, policy });
  }
);

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

export const closeRoom = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    const room = findRoom(ctx, roomId);
    if (!room) throw new SenderError('Room not found');
    if (isRoomClosed(room)) return;

    const allowed = room.kind === 'study' ? ['host'] : ['interviewer'];
    requireParticipant(ctx, roomId, allowed);

    ctx.db.room.id.update({
      ...room,
      closedAt: ctx.timestamp.microsSinceUnixEpoch,
    });
    deactivateAllParticipants(ctx, roomId);
  }
);

export const sendSignal = spacetimedb.reducer(
  { roomId: t.u64(), toIdentity: t.identity(), msgType: t.string(), payload: t.string() },
  (ctx, { roomId, toIdentity, msgType, payload }) => {
    if (!isActiveParticipant(ctx, roomId)) return;
    if (!['offer', 'answer', 'ice'].includes(msgType)) return;
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

export const updateMediaState = spacetimedb.reducer(
  { roomId: t.u64(), muted: t.bool(), videoOff: t.bool(), audioLevel: t.u8() },
  (ctx, { roomId, muted, videoOff, audioLevel }) => {
    if (!isActiveParticipant(ctx, roomId)) return;
    for (const p of ctx.db.participant.iter()) {
      if (p.roomId === roomId && p.active &&
          p.identity.toHexString() === ctx.sender.toHexString()) {
        ctx.db.participant.id.update({
          ...p, muted, videoOff,
          audioLevel: muted ? 0 : audioLevel,
        });
        return;
      }
    }
  }
);
