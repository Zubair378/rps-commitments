import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  webcrypto,
} from 'node:crypto';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { z, ZodError } from 'zod';
import { type Kysely } from 'kysely';
import {
  PUBLIC_PARAMS,
  parseCommitment,
  signedCommitmentMessage,
  verifyHash,
  verifyPedersen,
  type Mode,
  type Move,
} from '@rps/crypto-core';
import type { DB } from './db.js';

const idSchema = z.string().uuid();
const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const usernameSchema = z.string().regex(/^[a-zA-Z0-9_-]{3,32}$/);
const publicJwk = z
  .object({
    kty: z.literal('EC'),
    crv: z.literal('P-256'),
    x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    y: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    ext: z.boolean().optional(),
    key_ops: z.array(z.string()).optional(),
  })
  .strict();
const commitBody = z
  .object({
    matchId: idSchema,
    roundNo: z.number().int().min(1),
    keyId: idSchema,
    mode: z.enum(['pedersen', 'hash']),
    commitment: z.string().min(64).max(66),
    signature: z.string().regex(/^[0-9a-f]{128}$/),
  })
  .strict();
const revealBody = z
  .object({
    matchId: idSchema,
    roundNo: z.number().int().min(1),
    move: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    blindingFactor: hex64,
  })
  .strict();
const routeId = z.object({ id: idSchema });
const now = () => new Date().toISOString();
const deadline = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function checkPassword(password: string, stored: string | undefined): boolean {
  const [saltHex, digestHex] = stored?.split(':') ?? [];
  const salt =
    saltHex && /^[0-9a-f]{32}$/.test(saltHex) ? Buffer.from(saltHex, 'hex') : Buffer.alloc(16);
  const expected =
    digestHex && /^[0-9a-f]{128}$/.test(digestHex)
      ? Buffer.from(digestHex, 'hex')
      : Buffer.alloc(64);
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, expected) && !!stored;
}

async function currentUser(db: Kysely<DB>, request: FastifyRequest): Promise<string | null> {
  const token = request.cookies.rps_session;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = createHash('sha256').update(Buffer.from(token, 'hex')).digest('hex');
  const session = await db
    .selectFrom('sessions')
    .selectAll()
    .where('token_hash', '=', hash)
    .executeTakeFirst();
  if (!session || session.revoked_at || session.expires_at <= now()) return null;
  return timingSafeEqual(Buffer.from(session.token_hash, 'hex'), Buffer.from(hash, 'hex'))
    ? session.user_id
    : null;
}

async function setSessionUser(
  db: Kysely<DB>,
  reply: FastifyReply,
  id: string,
  production: boolean,
) {
  const token = randomBytes(32);
  const createdAt = now();
  await db
    .insertInto('sessions')
    .values({
      id: randomUUID(),
      user_id: id,
      token_hash: createHash('sha256').update(token).digest('hex'),
      created_at: createdAt,
      expires_at: deadline(3600),
      revoked_at: null,
    })
    .execute();
  reply.setCookie('rps_session', token.toString('hex'), {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  });
}

async function appendAudit(db: Kysely<DB>, eventType: string, event: object) {
  const eventJson = JSON.stringify(event);
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await db
      .selectFrom('audit_log')
      .select(['seq', 'hash'])
      .orderBy('seq', 'desc')
      .executeTakeFirst();
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? '0'.repeat(64);
    const createdAt = now();
    const hash = createHash('sha256')
      .update(`${prevHash}|${seq}|${eventType}|${eventJson}|${createdAt}`)
      .digest('hex');
    try {
      await db
        .insertInto('audit_log')
        .values({
          seq,
          prev_hash: prevHash,
          hash,
          event_type: eventType,
          event_json: eventJson,
          created_at: createdAt,
        })
        .execute();
      return;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      if (
        code !== '23505' &&
        code !== 'SQLITE_CONSTRAINT_PRIMARYKEY' &&
        code !== 'SQLITE_CONSTRAINT_UNIQUE'
      )
        throw error;
      if (attempt === 4) throw error;
    }
  }
}

function winnerFromMoves(a: Move, b: Move, aId: string, bId: string): string | null {
  if (a === b) return null;
  return (a === 1 && b === 3) || (a === 2 && b === 1) || (a === 3 && b === 2) ? aId : bId;
}

async function resolveRound(
  db: Kysely<DB>,
  match: DB['matches'],
  round: DB['rounds'],
  reason: string,
) {
  if (round.status === 'RESOLVED') return;
  const commitments = await db
    .selectFrom('commitments')
    .selectAll()
    .where('round_id', '=', round.id)
    .execute();
  const reveals = await db
    .selectFrom('reveals')
    .selectAll()
    .where('round_id', '=', round.id)
    .execute();
  const aCommit = commitments.find((c) => c.user_id === match.player_a_id);
  const bCommit = commitments.find((c) => c.user_id === match.player_b_id);
  const a = reveals.find((r) => r.user_id === match.player_a_id && r.valid === 1);
  const b = reveals.find((r) => r.user_id === match.player_b_id && r.valid === 1);
  let winner: string | null = null;
  if (reason === 'commit_deadline') {
    winner =
      aCommit && !bCommit ? match.player_a_id : bCommit && !aCommit ? match.player_b_id : null;
  } else {
    winner =
      a && b
        ? winnerFromMoves(a.move as Move, b.move as Move, match.player_a_id, match.player_b_id)
        : a
          ? match.player_a_id
          : b
            ? match.player_b_id
            : null;
  }
  const update = await db
    .updateTable('rounds')
    .set({ status: 'RESOLVED', winner_user_id: winner })
    .where('id', '=', round.id)
    .where('status', '!=', 'RESOLVED')
    .execute();
  if (update[0]?.numUpdatedRows === 0n) return;
  await db.updateTable('matches').set({ status: 'RESOLVED' }).where('id', '=', match.id).execute();
  // Openings become public only after the barrier or a deadline; never before.
  await appendAudit(db, 'round_resolved', {
    matchId: match.id,
    roundNo: round.round_no,
    reason,
    winnerUserId: winner,
    openings: reveals.map((r) => ({
      userId: r.user_id,
      move: r.move,
      blindingFactor: r.blinding_factor,
      valid: r.valid === 1,
    })),
  });
}

async function getMatchAndRound(db: Kysely<DB>, matchId: string, roundNo = 1) {
  const match = await db
    .selectFrom('matches')
    .selectAll()
    .where('id', '=', matchId)
    .executeTakeFirst();
  if (!match) return null;
  const round = await db
    .selectFrom('rounds')
    .selectAll()
    .where('match_id', '=', matchId)
    .where('round_no', '=', roundNo)
    .executeTakeFirst();
  if (!round) return null;
  if (round.status === 'COMMIT' && now() > round.commit_deadline) {
    await resolveRound(db, match, round, 'commit_deadline');
  } else if (round.status === 'REVEAL' && round.reveal_deadline && now() > round.reveal_deadline) {
    await resolveRound(db, match, round, 'reveal_deadline');
  }
  const latest = await db
    .selectFrom('rounds')
    .selectAll()
    .where('id', '=', round.id)
    .executeTakeFirstOrThrow();
  return { match, round: latest };
}

export async function buildApp(db: Kysely<DB>, production = false) {
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });
  await app.register(helmet);
  await app.register(rateLimit, { global: true, max: 100, timeWindow: '1 minute' });
  await app.register(cookie);
  await app.register(websocket);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({ error: 'invalid request', issues: error.issues });
    const status =
      error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (status >= 400 && status < 500)
      return reply
        .code(status)
        .send({ error: error instanceof Error ? error.message : 'bad request' });
    return reply.code(500).send({ error: 'internal error' });
  });

  const listeners = new Map<string, Set<{ readyState: number; send(data: string): void }>>();
  const notify = (matchId: string) => {
    for (const socket of listeners.get(matchId) ?? []) {
      if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'match_updated', matchId }));
    }
  };

  app.get('/health', async () => ({ ok: true }));
  app.get('/api/params', async () => PUBLIC_PARAMS);

  app.post('/api/register', async (request, reply) => {
    const body = z
      .object({ username: usernameSchema, password: z.string().min(12).max(128) })
      .strict()
      .parse(request.body);
    const exists = await db
      .selectFrom('users')
      .select('id')
      .where('username', '=', body.username)
      .executeTakeFirst();
    if (exists) return reply.code(409).send({ error: 'username taken' });
    const id = randomUUID();
    await db
      .insertInto('users')
      .values({
        id,
        username: body.username,
        password_hash: hashPassword(body.password),
        created_at: now(),
      })
      .execute();
    await setSessionUser(db, reply, id, production);
    await appendAudit(db, 'user_registered', { userId: id });
    return reply.code(201).send({ id, username: body.username });
  });

  app.post('/api/login', async (request, reply) => {
    const body = z
      .object({ username: usernameSchema, password: z.string().min(1).max(128) })
      .strict()
      .parse(request.body);
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', body.username)
      .executeTakeFirst();
    if (!checkPassword(body.password, user?.password_hash))
      return reply.code(401).send({ error: 'invalid credentials' });
    await setSessionUser(db, reply, user!.id, production);
    return { id: user!.id, username: user!.username };
  });
  app.post('/api/logout', async (request, reply) => {
    const token = request.cookies.rps_session;
    if (token && /^[0-9a-f]{64}$/.test(token)) {
      const hash = createHash('sha256').update(Buffer.from(token, 'hex')).digest('hex');
      await db
        .updateTable('sessions')
        .set({ revoked_at: now() })
        .where('token_hash', '=', hash)
        .execute();
    }
    reply.clearCookie('rps_session', { path: '/' });
    return { ok: true };
  });
  app.get('/api/me', async (request, reply) => {
    const id = await currentUser(db, request);
    if (!id) return reply.code(401).send({ error: 'sign in required' });
    const user = await db
      .selectFrom('users')
      .select(['id', 'username'])
      .where('id', '=', id)
      .executeTakeFirst();
    return user ?? reply.code(401).send({ error: 'sign in required' });
  });

  app.post('/api/keys/register', async (request, reply) => {
    const userId = await currentUser(db, request);
    if (!userId) return reply.code(401).send({ error: 'sign in required' });
    const body = z.object({ publicKey: publicJwk }).strict().parse(request.body);
    const cleanKey = { kty: 'EC', crv: 'P-256', x: body.publicKey.x, y: body.publicKey.y };
    try {
      await webcrypto.subtle.importKey(
        'jwk',
        cleanKey,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
    } catch {
      return reply.code(400).send({ error: 'invalid P-256 public key' });
    }
    const id = randomUUID();
    await db
      .insertInto('public_keys')
      .values({
        id,
        user_id: userId,
        jwk: JSON.stringify(cleanKey),
        created_at: now(),
        revoked_at: null,
      })
      .execute();
    await appendAudit(db, 'key_registered', { userId, keyId: id, publicKey: cleanKey });
    return reply.code(201).send({ id });
  });

  app.post('/api/keys/revoke', async (request, reply) => {
    const userId = await currentUser(db, request);
    if (!userId) return reply.code(401).send({ error: 'sign in required' });
    const { keyId } = z.object({ keyId: idSchema }).strict().parse(request.body);
    const key = await db
      .selectFrom('public_keys')
      .selectAll()
      .where('id', '=', keyId)
      .executeTakeFirst();
    if (!key || key.user_id !== userId) return reply.code(404).send({ error: 'key not found' });
    if (key.revoked_at) return reply.code(409).send({ error: 'key already revoked' });
    const revokedAt = now();
    await db
      .updateTable('public_keys')
      .set({ revoked_at: revokedAt })
      .where('id', '=', keyId)
      .execute();
    await appendAudit(db, 'key_revoked', { userId, keyId, revokedAt });
    return { id: keyId, revokedAt };
  });

  app.get('/api/keys', async (request, reply) => {
    const userId = await currentUser(db, request);
    if (!userId) return reply.code(401).send({ error: 'sign in required' });
    return db
      .selectFrom('public_keys')
      .select(['id', 'jwk', 'created_at', 'revoked_at'])
      .where('user_id', '=', userId)
      .execute();
  });

  app.post('/api/tournaments', async (request, reply) => {
    const userId = await currentUser(db, request);
    if (!userId) return reply.code(401).send({ error: 'sign in required' });
    const body = z
      .object({
        name: z.string().min(3).max(80),
        capacity: z.union([z.literal(2), z.literal(4), z.literal(8)]),
      })
      .strict()
      .parse(request.body);
    const id = randomUUID();
    await db
      .insertInto('tournaments')
      .values({
        id,
        name: body.name,
        capacity: body.capacity,
        status: 'WAITING',
        created_at: now(),
      })
      .execute();
    await db
      .insertInto('participants')
      .values({ id: randomUUID(), tournament_id: id, user_id: userId, slot: 1 })
      .execute();
    await appendAudit(db, 'tournament_created', {
      tournamentId: id,
      userId,
      capacity: body.capacity,
    });
    return reply.code(201).send({ id, ...body });
  });

  app.get('/api/tournaments', async () => db.selectFrom('tournaments').selectAll().execute());
  app.get('/api/tournaments/:id', async (request, reply) => {
    const { id } = routeId.parse(request.params);
    const tournament = await db
      .selectFrom('tournaments')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!tournament) return reply.code(404).send({ error: 'tournament not found' });
    const participants = await db
      .selectFrom('participants')
      .select(['user_id', 'slot'])
      .where('tournament_id', '=', id)
      .orderBy('slot')
      .execute();
    const matches = await db
      .selectFrom('matches')
      .selectAll()
      .where('tournament_id', '=', id)
      .execute();
    return { tournament, participants, matches };
  });

  app.post('/api/tournaments/:id/join', async (request, reply) => {
    const userId = await currentUser(db, request);
    if (!userId) return reply.code(401).send({ error: 'sign in required' });
    const { id } = routeId.parse(request.params);
    const result = await db.transaction().execute(async (trx) => {
      const tournament = await trx
        .selectFrom('tournaments')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      if (!tournament) return { error: 'tournament not found', code: 404 };
      const players = await trx
        .selectFrom('participants')
        .selectAll()
        .where('tournament_id', '=', id)
        .orderBy('slot')
        .execute();
      if (players.some((p) => p.user_id === userId)) return { error: 'already joined', code: 409 };
      if (players.length >= tournament.capacity) return { error: 'tournament full', code: 409 };
      const slot = players.length + 1;
      await trx
        .insertInto('participants')
        .values({ id: randomUUID(), tournament_id: id, user_id: userId, slot })
        .execute();
      let matchId: string | null = null;
      if (slot % 2 === 0) {
        matchId = randomUUID();
        await trx
          .insertInto('matches')
          .values({
            id: matchId,
            tournament_id: id,
            player_a_id: players[slot - 2]!.user_id,
            player_b_id: userId,
            status: 'ACTIVE',
            created_at: now(),
          })
          .execute();
        await trx
          .insertInto('rounds')
          .values({
            id: randomUUID(),
            match_id: matchId,
            round_no: 1,
            status: 'COMMIT',
            commit_deadline: deadline(120),
            reveal_deadline: null,
            winner_user_id: null,
            created_at: now(),
          })
          .execute();
      }
      if (slot === tournament.capacity)
        await trx
          .updateTable('tournaments')
          .set({ status: 'ACTIVE' })
          .where('id', '=', id)
          .execute();
      return { slot, matchId };
    });
    if ('error' in result) return reply.code(result.code ?? 500).send({ error: result.error });
    await appendAudit(db, 'tournament_joined', { tournamentId: id, userId, slot: result.slot });
    if (result.matchId) notify(result.matchId);
    return reply.code(201).send(result);
  });

  app.get('/api/matches/:id', async (request, reply) => {
    const { id } = routeId.parse(request.params);
    const found = await getMatchAndRound(db, id);
    if (!found) return reply.code(404).send({ error: 'match not found' });
    const commitments = await db
      .selectFrom('commitments')
      .select(['user_id', 'key_id', 'mode', 'commitment', 'signature'])
      .where('round_id', '=', found.round.id)
      .execute();
    const reveals =
      found.round.status === 'RESOLVED'
        ? await db
            .selectFrom('reveals')
            .select(['user_id', 'move', 'blinding_factor', 'valid'])
            .where('round_id', '=', found.round.id)
            .execute()
        : undefined;
    return { match: found.match, round: found.round, commitments, ...(reveals ? { reveals } : {}) };
  });

  app.post('/api/commit', async (request, reply) => {
    const userId = await currentUser(db, request);
    if (!userId) return reply.code(401).send({ error: 'sign in required' });
    const body = commitBody.parse(request.body);
    const found = await getMatchAndRound(db, body.matchId, body.roundNo);
    if (!found) return reply.code(404).send({ error: 'match not found' });
    const { match, round } = found;
    if (userId !== match.player_a_id && userId !== match.player_b_id)
      return reply.code(403).send({ error: 'not a player' });
    if (round.status !== 'COMMIT' || now() > round.commit_deadline)
      return reply.code(409).send({ error: 'commit phase closed' });
    if (body.mode === 'pedersen') {
      try {
        parseCommitment(body.commitment);
      } catch {
        return reply.code(400).send({ error: 'invalid point commitment' });
      }
    } else if (!/^[0-9a-f]{64}$/.test(body.commitment)) {
      return reply.code(400).send({ error: 'invalid hash commitment' });
    }
    const key = await db
      .selectFrom('public_keys')
      .selectAll()
      .where('id', '=', body.keyId)
      .executeTakeFirst();
    if (!key || key.user_id !== userId || key.revoked_at)
      return reply.code(403).send({ error: 'key unavailable' });
    const prior = await db
      .selectFrom('commitments')
      .selectAll()
      .where('round_id', '=', round.id)
      .execute();
    if (prior.some((c) => c.user_id === userId))
      return reply.code(409).send({ error: 'already committed' });
    const bytes = Buffer.from(body.commitment, 'hex');
    if (
      prior.some((c) => {
        const other = Buffer.from(c.commitment, 'hex');
        return other.length === bytes.length && timingSafeEqual(other, bytes);
      })
    ) {
      return reply.code(409).send({ error: 'duplicate commitment' });
    }
    const message = signedCommitmentMessage(
      {
        tournamentId: match.tournament_id,
        matchId: match.id,
        roundNo: round.round_no,
        playerId: userId,
      },
      body.mode as Mode,
      body.commitment,
    );
    const publicKey = await webcrypto.subtle.importKey(
      'jwk',
      JSON.parse(key.jwk),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const valid = await webcrypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      Buffer.from(body.signature, 'hex'),
      message,
    );
    if (!valid) return reply.code(403).send({ error: 'invalid signature' });
    await db
      .insertInto('commitments')
      .values({
        id: randomUUID(),
        round_id: round.id,
        user_id: userId,
        key_id: key.id,
        mode: body.mode,
        commitment: body.commitment,
        signature: body.signature,
        created_at: now(),
      })
      .execute();
    await appendAudit(db, 'commitment_accepted', {
      matchId: match.id,
      roundNo: round.round_no,
      userId,
      keyId: key.id,
      mode: body.mode,
      commitment: body.commitment,
      signature: body.signature,
    });
    const accepted = await db
      .selectFrom('commitments')
      .select('id')
      .where('round_id', '=', round.id)
      .execute();
    if (accepted.length === 2)
      await db
        .updateTable('rounds')
        .set({ status: 'REVEAL', reveal_deadline: deadline(120) })
        .where('id', '=', round.id)
        .where('status', '=', 'COMMIT')
        .execute();
    notify(match.id);
    return reply.code(201).send({ status: accepted.length === 2 ? 'REVEAL' : 'COMMIT' });
  });

  app.post('/api/reveal', async (request, reply) => {
    const userId = await currentUser(db, request);
    if (!userId) return reply.code(401).send({ error: 'sign in required' });
    const body = revealBody.parse(request.body);
    const found = await getMatchAndRound(db, body.matchId, body.roundNo);
    if (!found) return reply.code(404).send({ error: 'match not found' });
    const { match, round } = found;
    if (userId !== match.player_a_id && userId !== match.player_b_id)
      return reply.code(403).send({ error: 'not a player' });
    if (round.status !== 'REVEAL' || !round.reveal_deadline || now() > round.reveal_deadline) {
      return reply.code(409).send({ error: 'reveal phase closed' });
    }
    const commitment = await db
      .selectFrom('commitments')
      .selectAll()
      .where('round_id', '=', round.id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!commitment) return reply.code(409).send({ error: 'no commitment' });
    const prior = await db
      .selectFrom('reveals')
      .selectAll()
      .where('round_id', '=', round.id)
      .execute();
    if (prior.some((r) => r.user_id === userId))
      return reply.code(409).send({ error: 'already revealed' });
    const valid =
      commitment.mode === 'pedersen'
        ? verifyPedersen(commitment.commitment, body.move, body.blindingFactor)
        : verifyHash(
            commitment.commitment,
            { playerId: userId, matchId: match.id, roundNo: round.round_no },
            body.move,
            body.blindingFactor,
          );
    await db
      .insertInto('reveals')
      .values({
        id: randomUUID(),
        round_id: round.id,
        user_id: userId,
        move: body.move,
        blinding_factor: body.blindingFactor,
        valid: valid ? 1 : 0,
        created_at: now(),
      })
      .execute();
    // This event deliberately omits the opening until both players have revealed.
    await appendAudit(db, 'reveal_received', {
      matchId: match.id,
      roundNo: round.round_no,
      userId,
    });
    const accepted = await db
      .selectFrom('reveals')
      .select('id')
      .where('round_id', '=', round.id)
      .execute();
    if (accepted.length === 2) await resolveRound(db, match, round, 'both_revealed');
    notify(match.id);
    return reply
      .code(valid ? 200 : 422)
      .send({ valid, status: accepted.length === 2 ? 'RESOLVED' : 'WAITING' });
  });

  app.get('/api/audit', async () =>
    db.selectFrom('audit_log').selectAll().orderBy('seq').execute(),
  );
  app.get('/ws/matches/:id', { websocket: true }, (socket, request) => {
    const parsed = routeId.safeParse(request.params);
    if (!parsed.success) {
      socket.close();
      return;
    }
    const id = parsed.data.id;
    const set = listeners.get(id) ?? new Set();
    set.add(socket);
    listeners.set(id, set);
    socket.on('close', () => {
      set.delete(socket);
      if (!set.size) listeners.delete(id);
    });
  });

  return app;
}
