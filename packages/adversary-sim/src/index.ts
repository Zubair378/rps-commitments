/** INSECURE-DEMO: deliberately weak examples for teaching, never used by the referee. */
import { p256 } from '@noble/curves/nist.js';
import { bytesToHex } from '@noble/curves/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  Move,
  commitHash,
  commitPedersen,
  parseCommitment,
  signedCommitmentMessage,
  verifyAuditChain,
  verifyHash,
  verifyPedersen,
  type CommitmentContext,
  type HashChainEvent,
} from '@rps/crypto-core';

export const ATTACKS = [
  { id: 'A1', title: 'Unsalted hash brute force', defense: '32-byte salt / Pedersen hiding' },
  { id: 'A2', title: 'Predictable blinding factor', defense: 'Cryptographic random source' },
  { id: 'A3', title: 'Trapdoor second generator', defense: 'Pinned hash-to-curve generator' },
  { id: 'A4', title: 'Change move after commit', defense: 'Opening verification' },
  { id: 'A5', title: 'Copy a commitment', defense: 'Duplicate check and signed context' },
  { id: 'A6', title: 'Early-exit comparison leak', defense: 'Constant-work comparison' },
  { id: 'A7', title: 'Malformed curve point', defense: 'Strict point parsing' },
  { id: 'A8', title: 'Late reveal / abort', defense: 'Deadline and forfeit' },
  { id: 'A9', title: 'Replay old signature', defense: 'Round-bound signed message' },
  { id: 'A10', title: 'Audit event tampering', defense: 'Hash-chain verification' },
] as const;
export type AttackId = (typeof ATTACKS)[number]['id'];
export type AttackResult = {
  id: AttackId;
  vulnerableSuccess: boolean;
  patchedBlocked: boolean;
  evidence: string;
  limitation?: string;
};

const ctx: CommitmentContext = {
  tournamentId: 'demo-tournament',
  matchId: 'demo-match',
  roundNo: 1,
  playerId: 'demo-player',
};
const hex32 = (value: bigint) => value.toString(16).padStart(64, '0');

function weakFactor(seed: number) {
  // INSECURE-DEMO: predictable linear congruential generator.
  return hex32(BigInt((Math.imul(1664525, seed) + 1013904223) >>> 0));
}
function earlyExit(a: string, b: string) {
  // INSECURE-DEMO: prefix-dependent work.
  let inspected = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    inspected++;
    if (a[i] !== b[i]) return { equal: false, inspected };
  }
  return { equal: a.length === b.length, inspected };
}
function constantWork(a: string, b: string) {
  if (a.length !== b.length) return { equal: false, inspected: 0 };
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return { equal: difference === 0, inspected: a.length };
}
function insecureAcceptOpening(commitment: string, move: number) {
  // INSECURE-DEMO: no binding check.
  return commitment.length > 0 && [1, 2, 3].includes(move);
}
function insecureAcceptDuplicate(existing: string[], incoming: string) {
  // INSECURE-DEMO.
  return existing.length >= 0 && /^[0-9a-f]+$/.test(incoming);
}
function insecureAcceptLateReveal(arrival: number) {
  // INSECURE-DEMO: ignores deadline.
  return Number.isFinite(arrival);
}
function insecureDisplayWinner(eventJson: string) {
  // INSECURE-DEMO: no hash-chain check.
  return (JSON.parse(eventJson) as { winner: string }).winner;
}
function auditEvent(seq: number, previous: string, eventJson: string): HashChainEvent {
  const event_type = 'round_resolved';
  const created_at = '2026-11-13T00:00:00.000Z';
  const hash = bytesToHex(
    sha256(new TextEncoder().encode(`${previous}|${seq}|${event_type}|${eventJson}|${created_at}`)),
  );
  return { seq, prev_hash: previous, hash, event_type, event_json: eventJson, created_at };
}

export async function runAttack(id: AttackId): Promise<AttackResult> {
  switch (id) {
    case 'A1': {
      const vulnerable = bytesToHex(sha256(Uint8Array.of(Move.Paper))); // INSECURE-DEMO.
      const found = [Move.Rock, Move.Paper, Move.Scissors].find(
        (m) => bytesToHex(sha256(Uint8Array.of(m))) === vulnerable,
      );
      const protectedCommit = commitHash(ctx, Move.Paper);
      const zeroSalt = '0'.repeat(64);
      const guessed = [Move.Rock, Move.Paper, Move.Scissors].some((m) =>
        verifyHash(protectedCommit.commitment, ctx, m, zeroSalt),
      );
      return {
        id,
        vulnerableSuccess: found === Move.Paper,
        patchedBlocked: !guessed,
        evidence: `Unsalted SHA-256 reveals move ${found} in 3 guesses. The same guesses with an unknown 256-bit salt produce no match.`,
      };
    }
    case 'A2': {
      const predicted = weakFactor(42);
      const vulnerable = commitPedersen(Move.Paper, predicted); // INSECURE-DEMO.
      const recovered = [Move.Rock, Move.Paper, Move.Scissors].find((m) =>
        verifyPedersen(vulnerable.commitment, m, predicted),
      );
      let secure = commitPedersen(Move.Paper);
      while (secure.blindingFactor === predicted) secure = commitPedersen(Move.Paper);
      const guessed = [Move.Rock, Move.Paper, Move.Scissors].some((m) =>
        verifyPedersen(secure.commitment, m, predicted),
      );
      return {
        id,
        vulnerableSuccess: recovered === Move.Paper,
        patchedBlocked: !guessed,
        evidence: `Known PRNG seed predicts r=…${predicted.slice(-8)} and reveals move ${recovered}. Predicting that r does not open a CSPRNG commitment.`,
      };
    }
    case 'A3': {
      const order = p256.Point.Fn.ORDER;
      const x = 7n;
      const r = 11n;
      const trapdoorH = p256.Point.BASE.multiply(x); // INSECURE-DEMO: known discrete log.
      const vulnerable = p256.Point.BASE.multiply(BigInt(Move.Rock)).add(trapdoorH.multiply(r));
      const alternateR =
        (r + ((BigInt(Move.Rock - Move.Scissors) * p256.Point.Fn.inv(x)) % order) + order) % order;
      const forged = p256.Point.BASE.multiply(BigInt(Move.Scissors)).add(
        trapdoorH.multiply(alternateR),
      );
      const protectedCommit = commitPedersen(Move.Rock, hex32(r));
      return {
        id,
        vulnerableSuccess: vulnerable.equals(forged),
        patchedBlocked: !verifyPedersen(
          protectedCommit.commitment,
          Move.Scissors,
          hex32(alternateR),
        ),
        evidence: `Known x=7 lets one point open as rock (r=11) or scissors (r'=${alternateR}). The same forged opening fails against the pinned generator.`,
        limitation:
          'No experiment can prove an unknown discrete logarithm; the pinned hash-to-curve construction provides the binding assumption.',
      };
    }
    case 'A4': {
      const original = commitPedersen(Move.Rock);
      const naiveAccepts = insecureAcceptOpening(original.commitment, Move.Paper);
      return {
        id,
        vulnerableSuccess: naiveAccepts,
        patchedBlocked: !verifyPedersen(original.commitment, Move.Paper, original.blindingFactor),
        evidence:
          'A naive referee trusts a changed move. Pedersen opening verification rejects paper against a rock commitment.',
      };
    }
    case 'A5': {
      const commitment = commitPedersen(Move.Rock).commitment;
      const naiveAcceptsCopy = insecureAcceptDuplicate([commitment], commitment);
      const seen = new Set([commitment]);
      const signed1 = signedCommitmentMessage(ctx, 'pedersen', commitment);
      const signed2 = signedCommitmentMessage(
        { ...ctx, playerId: 'copycat' },
        'pedersen',
        commitment,
      );
      return {
        id,
        vulnerableSuccess: naiveAcceptsCopy,
        patchedBlocked: seen.has(commitment) && bytesToHex(signed1) !== bytesToHex(signed2),
        evidence:
          'An unguarded match accepts the copied point. The referee rejects duplicates, and the signature payload changes with player ID.',
      };
    }
    case 'A6': {
      const target = 'a'.repeat(64);
      const short = earlyExit(target, 'b' + 'a'.repeat(63));
      const long = earlyExit(target, 'a'.repeat(63) + 'b');
      const fixed1 = constantWork(target, 'b' + 'a'.repeat(63));
      const fixed2 = constantWork(target, 'a'.repeat(63) + 'b');
      return {
        id,
        vulnerableSuccess: short.inspected !== long.inspected,
        patchedBlocked: fixed1.inspected === fixed2.inspected && !fixed1.equal && !fixed2.equal,
        evidence: `Early exit inspects ${short.inspected} versus ${long.inspected} characters. Fixed-work comparison inspects ${fixed1.inspected} in both cases.`,
        limitation:
          'Operation counts demonstrate the branch difference; they do not establish a remotely exploitable timing leak.',
      };
    }
    case 'A7': {
      const invalid = '00' + '00'.repeat(32); // INSECURE-DEMO: correct length, invalid point.
      const naiveAccepts = invalid.length === 66;
      let patchedAccepts = true;
      try {
        parseCommitment(invalid);
      } catch {
        patchedAccepts = false;
      }
      return {
        id,
        vulnerableSuccess: naiveAccepts,
        patchedBlocked: !patchedAccepts,
        evidence:
          'A length-only validator accepts a 33-byte identity-like encoding; strict compressed-point parsing rejects it.',
      };
    }
    case 'A8': {
      const deadline = 1000;
      const arrival = 1001;
      const naiveAccepts = insecureAcceptLateReveal(arrival);
      const patchedAccepts = arrival <= deadline;
      return {
        id,
        vulnerableSuccess: naiveAccepts,
        patchedBlocked: !patchedAccepts,
        evidence:
          'A reveal arriving one millisecond after the deadline is accepted without a timer and rejected by the referee deadline rule. The API test checks actual forfeit behavior.',
      };
    }
    case 'A9': {
      const point = commitPedersen(Move.Rock).commitment;
      const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
        'sign',
        'verify',
      ]);
      const weakMessage = new TextEncoder().encode(point); // INSECURE-DEMO: missing context.
      const weakSignature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.privateKey,
        weakMessage,
      );
      const vulnerable = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.publicKey,
        weakSignature,
        weakMessage,
      );
      const original = signedCommitmentMessage(ctx, 'pedersen', point);
      const replay = signedCommitmentMessage({ ...ctx, roundNo: 2 }, 'pedersen', point);
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.privateKey,
        Uint8Array.from(original),
      );
      const patched = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.publicKey,
        signature,
        Uint8Array.from(replay),
      );
      return {
        id,
        vulnerableSuccess: vulnerable,
        patchedBlocked: !patched,
        evidence:
          'A signature over C alone verifies again in another round. A signature over tournament, match, round, player, mode, and C fails when round changes.',
      };
    }
    case 'A10': {
      const first = auditEvent(1, '0'.repeat(64), '{"winner":"alice"}');
      const second = auditEvent(2, first.hash, '{"winner":"bob"}');
      const original = verifyAuditChain([first, second]);
      const modified = { ...first, event_json: '{"winner":"mallory"}' };
      const naiveAccepts = insecureDisplayWinner(modified.event_json) === 'mallory';
      return {
        id,
        vulnerableSuccess: original && naiveAccepts,
        patchedBlocked: !verifyAuditChain([modified, second]),
        evidence:
          'A plain log displays an altered winner. The browser verifier detects the changed event hash and broken chain.',
        limitation: 'An operator could rewrite the entire chain without an external checkpoint.',
      };
    }
  }
}
