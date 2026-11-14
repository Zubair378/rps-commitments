import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { commitPedersen, signedCommitmentMessage, type Mode } from '@rps/crypto-core';
import { buildApp } from './app.js';
import { createDatabase, migrate } from './db.js';

const one = '0'.repeat(63) + '1';
const two = '0'.repeat(63) + '2';
type App = Awaited<ReturnType<typeof buildApp>>;
type Db = ReturnType<typeof createDatabase>;
let db: Db;
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

async function register(username: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/register',
    payload: { username, password: 'test-password-long-enough' },
  });
  expect(response.statusCode).toBe(201);
  return {
    id: response.json().id as string,
    cookie: response.headers['set-cookie']!.toString().split(';')[0]!,
  };
}

async function signingKey(cookie: string) {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
    'verify',
  ]);
  const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  expect(pair.privateKey.extractable).toBe(false);
  const response = await app.inject({
    method: 'POST',
    url: '/api/keys/register',
    headers: { cookie },
    payload: { publicKey },
  });
  expect(response.statusCode).toBe(201);
  return { id: response.json().id as string, privateKey: pair.privateKey };
}

async function signedBody(args: {
  tournamentId: string;
  matchId: string;
  playerId: string;
  keyId: string;
  privateKey: webcrypto.CryptoKey;
  move: 1 | 2 | 3;
  blindingFactor: string;
  mode?: Mode;
}) {
  const mode = args.mode ?? 'pedersen';
  const commitment = commitPedersen(args.move, args.blindingFactor).commitment;
  const message = signedCommitmentMessage(
    { tournamentId: args.tournamentId, matchId: args.matchId, roundNo: 1, playerId: args.playerId },
    mode,
    commitment,
  );
  const signature = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    args.privateKey,
    message,
  );
  return {
    matchId: args.matchId,
    roundNo: 1,
    keyId: args.keyId,
    mode,
    commitment,
    signature: Buffer.from(signature).toString('hex'),
  };
}

describe('two-client match API', () => {
  it('enforces session logout and server-side expiry', async () => {
    const alice = await register('alice');
    const cookie = alice.cookie;
    expect(cookie).toMatch(/^rps_session=[0-9a-f]{64}$/);
    expect(
      (await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie } })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode,
    ).toBe(401);
    const loggedIn = await app.inject({
      method: 'POST',
      url: '/api/login',
      payload: { username: 'alice', password: 'test-password-long-enough' },
    });
    expect(loggedIn.statusCode).toBe(200);
    const newCookie = loggedIn.headers['set-cookie']!.toString().split(';')[0]!;
    await db
      .updateTable('sessions')
      .set({ expires_at: '2000-01-01T00:00:00.000Z' })
      .where('user_id', '=', alice.id)
      .execute();
    expect(
      (await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: newCookie } }))
        .statusCode,
    ).toBe(401);
  });

  it('forfeits a missed commit deadline', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const key = await signingKey(alice.cookie);
    const created = await app.inject({
      method: 'POST',
      url: '/api/tournaments',
      headers: { cookie: alice.cookie },
      payload: { name: 'Deadline test', capacity: 2 },
    });
    const tournamentId = created.json().id as string;
    const joined = await app.inject({
      method: 'POST',
      url: `/api/tournaments/${tournamentId}/join`,
      headers: { cookie: bob.cookie },
    });
    const matchId = joined.json().matchId as string;
    const body = await signedBody({
      tournamentId,
      matchId,
      playerId: alice.id,
      keyId: key.id,
      privateKey: key.privateKey,
      move: 1,
      blindingFactor: one,
    });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/commit',
          headers: { cookie: alice.cookie },
          payload: body,
        })
      ).statusCode,
    ).toBe(201);
    await db
      .updateTable('rounds')
      .set({ commit_deadline: '2000-01-01T00:00:00.000Z' })
      .where('match_id', '=', matchId)
      .execute();
    const result = (await app.inject({ method: 'GET', url: `/api/matches/${matchId}` })).json();
    expect(result.round.status).toBe('RESOLVED');
    expect(result.round.winner_user_id).toBe(alice.id);
  });

  it('forfeits a late reveal and rejects the late opener', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const aliceKey = await signingKey(alice.cookie);
    const bobKey = await signingKey(bob.cookie);
    const created = await app.inject({
      method: 'POST',
      url: '/api/tournaments',
      headers: { cookie: alice.cookie },
      payload: { name: 'Reveal deadline test', capacity: 2 },
    });
    const tournamentId = created.json().id as string;
    const joined = await app.inject({
      method: 'POST',
      url: `/api/tournaments/${tournamentId}/join`,
      headers: { cookie: bob.cookie },
    });
    const matchId = joined.json().matchId as string;
    for (const [player, key, move, blindingFactor] of [
      [alice, aliceKey, 1, one],
      [bob, bobKey, 2, two],
    ] as const) {
      const body = await signedBody({
        tournamentId,
        matchId,
        playerId: player.id,
        keyId: key.id,
        privateKey: key.privateKey,
        move,
        blindingFactor,
      });
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/commit',
            headers: { cookie: player.cookie },
            payload: body,
          })
        ).statusCode,
      ).toBe(201);
    }
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/reveal',
          headers: { cookie: alice.cookie },
          payload: { matchId, roundNo: 1, move: 1, blindingFactor: one },
        })
      ).statusCode,
    ).toBe(200);
    await db
      .updateTable('rounds')
      .set({ reveal_deadline: '2000-01-01T00:00:00.000Z' })
      .where('match_id', '=', matchId)
      .execute();
    const result = (await app.inject({ method: 'GET', url: `/api/matches/${matchId}` })).json();
    expect(result.round.status).toBe('RESOLVED');
    expect(result.round.winner_user_id).toBe(alice.id);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/reveal',
          headers: { cookie: bob.cookie },
          payload: { matchId, roundNo: 1, move: 2, blindingFactor: two },
        })
      ).statusCode,
    ).toBe(409);
  });

  it('advances when both players act concurrently', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const aliceKey = await signingKey(alice.cookie);
    const bobKey = await signingKey(bob.cookie);
    const created = await app.inject({
      method: 'POST',
      url: '/api/tournaments',
      headers: { cookie: alice.cookie },
      payload: { name: 'Concurrent test', capacity: 2 },
    });
    const tournamentId = created.json().id as string;
    const joined = await app.inject({
      method: 'POST',
      url: `/api/tournaments/${tournamentId}/join`,
      headers: { cookie: bob.cookie },
    });
    const matchId = joined.json().matchId as string;
    const aliceBody = await signedBody({
      tournamentId,
      matchId,
      playerId: alice.id,
      keyId: aliceKey.id,
      privateKey: aliceKey.privateKey,
      move: 1,
      blindingFactor: one,
    });
    const bobBody = await signedBody({
      tournamentId,
      matchId,
      playerId: bob.id,
      keyId: bobKey.id,
      privateKey: bobKey.privateKey,
      move: 3,
      blindingFactor: two,
    });
    const committed = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/commit',
        headers: { cookie: alice.cookie },
        payload: aliceBody,
      }),
      app.inject({
        method: 'POST',
        url: '/api/commit',
        headers: { cookie: bob.cookie },
        payload: bobBody,
      }),
    ]);
    expect(committed.map((r) => r.statusCode)).toEqual([201, 201]);
    const afterCommit = (
      await app.inject({ method: 'GET', url: `/api/matches/${matchId}` })
    ).json();
    expect(afterCommit.round.status).toBe('REVEAL');
    const revealed = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/reveal',
        headers: { cookie: alice.cookie },
        payload: { matchId, roundNo: 1, move: 1, blindingFactor: one },
      }),
      app.inject({
        method: 'POST',
        url: '/api/reveal',
        headers: { cookie: bob.cookie },
        payload: { matchId, roundNo: 1, move: 3, blindingFactor: two },
      }),
    ]);
    expect(revealed.map((r) => r.statusCode)).toEqual([200, 200]);
    const final = (await app.inject({ method: 'GET', url: `/api/matches/${matchId}` })).json();
    expect(final.round.status).toBe('RESOLVED');
    expect(final.round.winner_user_id).toBe(alice.id);
  });

  it('keeps openings hidden until both players reveal, then resolves and audits', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const aliceKey = await signingKey(alice.cookie);
    const bobKey = await signingKey(bob.cookie);
    const created = await app.inject({
      method: 'POST',
      url: '/api/tournaments',
      headers: { cookie: alice.cookie },
      payload: { name: 'Test tournament', capacity: 2 },
    });
    expect(created.statusCode).toBe(201);
    const tournamentId = created.json().id as string;
    const joined = await app.inject({
      method: 'POST',
      url: `/api/tournaments/${tournamentId}/join`,
      headers: { cookie: bob.cookie },
    });
    expect(joined.statusCode).toBe(201);
    const matchId = joined.json().matchId as string;
    const aliceBody = await signedBody({
      tournamentId,
      matchId,
      playerId: alice.id,
      keyId: aliceKey.id,
      privateKey: aliceKey.privateKey,
      move: 1,
      blindingFactor: one,
    });
    const bobBody = await signedBody({
      tournamentId,
      matchId,
      playerId: bob.id,
      keyId: bobKey.id,
      privateKey: bobKey.privateKey,
      move: 3,
      blindingFactor: two,
    });

    const leaked = await app.inject({
      method: 'POST',
      url: '/api/commit',
      headers: { cookie: alice.cookie },
      payload: { ...aliceBody, move: 1, blindingFactor: one },
    });
    expect(leaked.statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/commit',
          headers: { cookie: alice.cookie },
          payload: aliceBody,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/reveal',
          headers: { cookie: alice.cookie },
          payload: { matchId, roundNo: 1, move: 1, blindingFactor: one },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/commit',
          headers: { cookie: bob.cookie },
          payload: bobBody,
        })
      ).statusCode,
    ).toBe(201);

    const first = await app.inject({
      method: 'POST',
      url: '/api/reveal',
      headers: { cookie: alice.cookie },
      payload: { matchId, roundNo: 1, move: 1, blindingFactor: one },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().status).toBe('WAITING');
    const hidden = (await app.inject({ method: 'GET', url: `/api/matches/${matchId}` })).json();
    expect(hidden.round.status).toBe('REVEAL');
    expect(hidden).not.toHaveProperty('reveals');
    const beforeAudit = (await app.inject({ method: 'GET', url: '/api/audit' })).json();
    expect(
      beforeAudit.some((entry: { event_type: string }) => entry.event_type === 'round_resolved'),
    ).toBe(false);

    const second = await app.inject({
      method: 'POST',
      url: '/api/reveal',
      headers: { cookie: bob.cookie },
      payload: { matchId, roundNo: 1, move: 3, blindingFactor: two },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().status).toBe('RESOLVED');
    const finished = (await app.inject({ method: 'GET', url: `/api/matches/${matchId}` })).json();
    expect(finished.round.winner_user_id).toBe(alice.id);
    expect(finished.reveals).toHaveLength(2);
    const audit = (await app.inject({ method: 'GET', url: '/api/audit' })).json();
    let previous = '0'.repeat(64);
    for (const row of audit) {
      expect(row.prev_hash).toBe(previous);
      expect(row.hash).toBe(
        createHash('sha256')
          .update(`${previous}|${row.seq}|${row.event_type}|${row.event_json}|${row.created_at}`)
          .digest('hex'),
      );
      previous = row.hash;
    }
  });

  it('rejects unsigned, copied, replayed, and revoked commitments', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const aliceKey = await signingKey(alice.cookie);
    const bobKey = await signingKey(bob.cookie);
    const created = await app.inject({
      method: 'POST',
      url: '/api/tournaments',
      headers: { cookie: alice.cookie },
      payload: { name: 'Replay test', capacity: 2 },
    });
    const tournamentId = created.json().id as string;
    const joined = await app.inject({
      method: 'POST',
      url: `/api/tournaments/${tournamentId}/join`,
      headers: { cookie: bob.cookie },
    });
    const matchId = joined.json().matchId as string;
    const aliceBody = await signedBody({
      tournamentId,
      matchId,
      playerId: alice.id,
      keyId: aliceKey.id,
      privateKey: aliceKey.privateKey,
      move: 1,
      blindingFactor: one,
    });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/commit',
          headers: { cookie: alice.cookie },
          payload: { ...aliceBody, commitment: '02' + 'ff'.repeat(32) },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/commit',
          headers: { cookie: alice.cookie },
          payload: { ...aliceBody, signature: '00'.repeat(64) },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/commit',
          headers: { cookie: alice.cookie },
          payload: aliceBody,
        })
      ).statusCode,
    ).toBe(201);
    const copied = await signedBody({
      tournamentId,
      matchId,
      playerId: bob.id,
      keyId: bobKey.id,
      privateKey: bobKey.privateKey,
      move: 1,
      blindingFactor: one,
    });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/commit',
          headers: { cookie: bob.cookie },
          payload: copied,
        })
      ).statusCode,
    ).toBe(409);
    const secondTournament = await app.inject({
      method: 'POST',
      url: '/api/tournaments',
      headers: { cookie: alice.cookie },
      payload: { name: 'New match', capacity: 2 },
    });
    const secondTournamentId = secondTournament.json().id as string;
    const secondJoin = await app.inject({
      method: 'POST',
      url: `/api/tournaments/${secondTournamentId}/join`,
      headers: { cookie: bob.cookie },
    });
    const secondMatchId = secondJoin.json().matchId as string;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/commit',
          headers: { cookie: alice.cookie },
          payload: { ...aliceBody, matchId: secondMatchId },
        })
      ).statusCode,
    ).toBe(403);
    const revoked = await app.inject({
      method: 'POST',
      url: '/api/keys/revoke',
      headers: { cookie: bob.cookie },
      payload: { keyId: bobKey.id },
    });
    expect(revoked.statusCode).toBe(200);
    const other = await signedBody({
      tournamentId,
      matchId,
      playerId: bob.id,
      keyId: bobKey.id,
      privateKey: bobKey.privateKey,
      move: 2,
      blindingFactor: two,
    });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/commit',
          headers: { cookie: bob.cookie },
          payload: other,
        })
      ).statusCode,
    ).toBe(403);
  });
});
