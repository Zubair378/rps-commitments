import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { commitPedersen, signedCommitmentMessage } from '../packages/crypto-core/src/index.js';

const origin = process.argv[2] ?? 'http://127.0.0.1:3000';
const suffix = randomUUID().slice(0, 8);

async function call(path: string, method = 'GET', body?: object, cookie?: string) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`${method} ${path} failed with HTTP ${response.status}`);
  return {
    data: (await response.json()) as Record<string, unknown>,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

async function player(username: string) {
  const registered = await call('/api/register', 'POST', {
    username,
    password: randomBytes(24).toString('hex'),
  });
  const cookie = registered.cookie;
  if (!cookie) throw new Error('Registration did not create a session');
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
    'verify',
  ]);
  const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const key = await call('/api/keys/register', 'POST', { publicKey }, cookie);
  return {
    id: registered.data.id as string,
    cookie,
    keyId: key.data.id as string,
    privateKey: pair.privateKey,
  };
}

async function run() {
  const alice = await player(`alice_${suffix}`);
  const bob = await player(`bob_${suffix}`);
  const created = await call(
    '/api/tournaments',
    'POST',
    { name: `Demo ${suffix}`, capacity: 2 },
    alice.cookie,
  );
  const tournamentId = created.data.id as string;
  const joined = await call(`/api/tournaments/${tournamentId}/join`, 'POST', undefined, bob.cookie);
  const matchId = joined.data.matchId as string;
  async function commit(playerData: typeof alice, move: 1 | 2 | 3) {
    const opening = commitPedersen(move);
    const message = signedCommitmentMessage(
      { tournamentId, matchId, roundNo: 1, playerId: playerData.id },
      'pedersen',
      opening.commitment,
    );
    const signature = await webcrypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      playerData.privateKey,
      message,
    );
    await call(
      '/api/commit',
      'POST',
      {
        matchId,
        roundNo: 1,
        keyId: playerData.keyId,
        mode: 'pedersen',
        commitment: opening.commitment,
        signature: Buffer.from(signature).toString('hex'),
      },
      playerData.cookie,
    );
    return { move, blindingFactor: opening.blindingFactor };
  }
  const aliceOpening = await commit(alice, 1);
  const bobOpening = await commit(bob, 3);
  await call('/api/reveal', 'POST', { matchId, roundNo: 1, ...aliceOpening }, alice.cookie);
  await call('/api/reveal', 'POST', { matchId, roundNo: 1, ...bobOpening }, bob.cookie);
  const final = await call(`/api/matches/${matchId}`);
  const round = final.data.round as { status: string; winner_user_id: string | null };
  if (round.status !== 'RESOLVED' || round.winner_user_id !== alice.id)
    throw new Error('Unexpected result');
  process.stdout.write(`Match ${matchId} resolved; winner: first simulated player.\n`);
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Match script failed'}\n`);
  process.exitCode = 1;
});
