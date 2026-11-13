import { afterEach, beforeEach, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { commitPedersen, signedCommitmentMessage, type Move } from '@rps/crypto-core';
import { buildApp } from './app.js';
import { createDatabase, migrate } from './db.js';

type App = Awaited<ReturnType<typeof buildApp>>;
type Player = { id: string; cookie: string; keyId: string; privateKey: webcrypto.CryptoKey };
let db: ReturnType<typeof createDatabase>;
let app: App;

beforeEach(async () => {
  db = createDatabase('file::memory:');
  await migrate(db);
  app = await buildApp(db);
});
afterEach(async () => {
  await app.close();
  await db.destroy();
});

async function player(username: string): Promise<Player> {
  const registered = await app.inject({
    method: 'POST',
    url: '/api/register',
    payload: { username, password: 'test-password-long-enough' },
  });
  expect(registered.statusCode).toBe(201);
  const cookie = registered.headers['set-cookie']!.toString().split(';')[0]!;
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
    'verify',
  ]);
  const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const key = await app.inject({
    method: 'POST',
    url: '/api/keys/register',
    headers: { cookie },
    payload: { publicKey },
  });
  expect(key.statusCode).toBe(201);
  return { id: registered.json().id, cookie, keyId: key.json().id, privateKey: pair.privateKey };
}

async function commit(
  playerData: Player,
  tournamentId: string,
  matchId: string,
  roundNo: number,
  move: Move,
  scalar: number,
) {
  const blindingFactor = scalar.toString(16).padStart(64, '0');
  const commitment = commitPedersen(move, blindingFactor).commitment;
  const message = signedCommitmentMessage(
    { tournamentId, matchId, roundNo, playerId: playerData.id },
    'pedersen',
    commitment,
  );
  const signature = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    playerData.privateKey,
    message,
  );
  const response = await app.inject({
    method: 'POST',
    url: '/api/commit',
    headers: { cookie: playerData.cookie },
    payload: {
      matchId,
      roundNo,
      keyId: playerData.keyId,
      mode: 'pedersen',
      commitment,
      signature: Buffer.from(signature).toString('hex'),
    },
  });
  return { response, blindingFactor };
}

async function playRound(
  tournamentId: string,
  matchId: string,
  roundNo: number,
  a: Player,
  moveA: Move,
  b: Player,
  moveB: Move,
  saltBase: number,
) {
  const first = await commit(a, tournamentId, matchId, roundNo, moveA, saltBase);
  const second = await commit(b, tournamentId, matchId, roundNo, moveB, saltBase + 1);
  expect(first.response.statusCode).toBe(201);
  expect(second.response.statusCode).toBe(201);
  const revealedA = await app.inject({
    method: 'POST',
    url: '/api/reveal',
    headers: { cookie: a.cookie },
    payload: { matchId, roundNo, move: moveA, blindingFactor: first.blindingFactor },
  });
  expect(revealedA.statusCode).toBe(200);
  const revealedB = await app.inject({
    method: 'POST',
    url: '/api/reveal',
    headers: { cookie: b.cookie },
    payload: { matchId, roundNo, move: moveB, blindingFactor: second.blindingFactor },
  });
  expect(revealedB.statusCode).toBe(200);
}

it('advances a four-player best-of-three bracket to a champion', async () => {
  const a = await player('alpha');
  const b = await player('bravo');
  const c = await player('charlie');
  const d = await player('delta');
  const created = await app.inject({
    method: 'POST',
    url: '/api/tournaments',
    headers: { cookie: a.cookie },
    payload: { name: 'Four player bracket', capacity: 4 },
  });
  expect(created.statusCode).toBe(201);
  const tournamentId = created.json().id as string;
  async function join(p: Player) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/tournaments/${tournamentId}/join`,
      headers: { cookie: p.cookie },
    });
    expect(response.statusCode).toBe(201);
    return response.json().matchId as string | null;
  }
  const semifinalOne = await join(b);
  expect(await join(c)).toBeNull();
  const semifinalTwo = await join(d);
  expect(semifinalOne).toBeTruthy();
  expect(semifinalTwo).toBeTruthy();
  await playRound(tournamentId, semifinalOne!, 1, a, 1, b, 3, 1);
  const afterOne = (
    await app.inject({ method: 'GET', url: `/api/matches/${semifinalOne}` })
  ).json();
  expect(afterOne.round.round_no).toBe(2);
  expect(afterOne.match.status).toBe('ACTIVE');
  await playRound(tournamentId, semifinalOne!, 2, a, 1, b, 3, 3);
  await playRound(tournamentId, semifinalTwo!, 1, c, 2, d, 1, 5);
  await playRound(tournamentId, semifinalTwo!, 2, c, 2, d, 1, 7);
  const bracket = (
    await app.inject({ method: 'GET', url: `/api/tournaments/${tournamentId}` })
  ).json();
  expect(bracket.matches).toHaveLength(3);
  const final = bracket.matches.find((m: { stage: number }) => m.stage === 2);
  expect(final.player_a_id).toBe(a.id);
  expect(final.player_b_id).toBe(c.id);
  await playRound(tournamentId, final.id, 1, a, 3, c, 2, 9);
  await playRound(tournamentId, final.id, 2, a, 3, c, 2, 11);
  const complete = (
    await app.inject({ method: 'GET', url: `/api/tournaments/${tournamentId}` })
  ).json();
  expect(complete.tournament.status).toBe('COMPLETE');
  expect(complete.matches.find((m: { id: string }) => m.id === final.id).winner_user_id).toBe(a.id);
});

it('rotates a key and keeps the old public key available for verification', async () => {
  const a = await player('alpha');
  const b = await player('bravo');
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
    'verify',
  ]);
  const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const rotated = await app.inject({
    method: 'POST',
    url: '/api/keys/rotate',
    headers: { cookie: a.cookie },
    payload: { oldKeyId: a.keyId, publicKey },
  });
  expect(rotated.statusCode).toBe(201);
  const oldKey = (await app.inject({ method: 'GET', url: `/api/keys/${a.keyId}` })).json();
  expect(oldKey.revoked_at).toBeTruthy();
  const created = await app.inject({
    method: 'POST',
    url: '/api/tournaments',
    headers: { cookie: a.cookie },
    payload: { name: 'Key rotation test', capacity: 2 },
  });
  const tournamentId = created.json().id as string;
  const joined = await app.inject({
    method: 'POST',
    url: `/api/tournaments/${tournamentId}/join`,
    headers: { cookie: b.cookie },
  });
  const matchId = joined.json().matchId as string;
  expect((await commit(a, tournamentId, matchId, 1, 1, 21)).response.statusCode).toBe(403);
  const newKeyPlayer = { ...a, keyId: rotated.json().id as string, privateKey: pair.privateKey };
  expect((await commit(newKeyPlayer, tournamentId, matchId, 1, 1, 22)).response.statusCode).toBe(
    201,
  );
  const audit = (await app.inject({ method: 'GET', url: '/api/audit' })).json();
  expect(audit.some((entry: { event_type: string }) => entry.event_type === 'key_rotated')).toBe(
    true,
  );
});
