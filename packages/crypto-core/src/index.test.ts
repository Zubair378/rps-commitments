import { describe, expect, it } from 'vitest';
import { p256 } from '@noble/curves/nist.js';
import {
  H,
  PINNED_H_HEX,
  PUBLIC_PARAMS,
  assertPinnedParams,
  commitHash,
  commitPedersen,
  parseCommitment,
  parseScalar,
  randomSaltHex,
  randomScalarHex,
  signedCommitmentMessage,
  verifyHash,
  verifyPedersen,
} from './index.js';

const one = '0'.repeat(63) + '1';
const two = '0'.repeat(63) + '2';
const context = { tournamentId: 'tour-1', matchId: 'match-1', roundNo: 1, playerId: 'alice' };

describe('Pedersen P-256 commitments', () => {
  it('keeps the public generator pinned', () => {
    expect(H.toHex(true)).toBe(PINNED_H_HEX);
    expect(PUBLIC_PARAMS.g).toBe(p256.Point.BASE.toHex(true));
    expect(() => assertPinnedParams(PUBLIC_PARAMS)).not.toThrow();
    expect(() => assertPinnedParams({ ...PUBLIC_PARAMS, h: PUBLIC_PARAMS.g })).toThrow();
  });

  it('matches the committed known-answer vector', () => {
    const result = commitPedersen(1, one);
    expect(result.commitment).toBe(
      '03a41611bb3063f30b90bfbe3d8c32fe2c597ba4759859ef61e054b92059fb2ddd',
    );
    expect(verifyPedersen(result.commitment, 1, one)).toBe(true);
  });

  it('rejects wrong openings and invalid encodings', () => {
    const { commitment } = commitPedersen(2, one);
    expect(verifyPedersen(commitment, 3, one)).toBe(false);
    expect(verifyPedersen(commitment, 2, two)).toBe(false);
    expect(verifyPedersen(commitment, 0, one)).toBe(false);
    expect(verifyPedersen('00', 2, one)).toBe(false);
    expect(() => parseCommitment('02' + 'ff'.repeat(32))).toThrow();
    expect(() => parseCommitment(commitment.toUpperCase())).toThrow();
    expect(parseScalar('0'.repeat(64))).toBe(0n);
    expect(() => parseScalar(p256.Point.Fn.ORDER.toString(16).padStart(64, '0'))).toThrow();
    expect(() => parseScalar('f')).toThrow();
  });

  it('is additively homomorphic', () => {
    const a = parseCommitment(commitPedersen(1, one).commitment);
    const b = parseCommitment(commitPedersen(2, two).commitment);
    const sum = p256.Point.BASE.multiply(3n).add(H.multiply(3n));
    expect(a.add(b).equals(sum)).toBe(true);
  });

  it('supports zero blinding so the sampled scalar field is complete', () => {
    const zero = '0'.repeat(64);
    const commitment = commitPedersen(1, zero).commitment;
    expect(commitment).toBe(p256.Point.BASE.toHex(true));
    expect(verifyPedersen(commitment, 1, zero)).toBe(true);
  });

  it('generates canonical unpredictable scalars', () => {
    const a = randomScalarHex();
    const b = randomScalarHex();
    expect(parseScalar(a)).toBeGreaterThanOrEqual(0n);
    expect(a).not.toBe(b);
  });
});

describe('salted SHA-256 baseline', () => {
  it('matches the committed known-answer vector and checks context', () => {
    const result = commitHash(context, 2, one);
    expect(result.commitment).toBe(
      'b8e014c5aa14c6b94da54850f371b68548cb71f734706c4f3c9e026d7339028e',
    );
    expect(verifyHash(result.commitment, context, 2, one)).toBe(true);
    expect(verifyHash(result.commitment, { ...context, playerId: 'bob' }, 2, one)).toBe(false);
    expect(verifyHash(result.commitment, context, 1, one)).toBe(false);
    expect(verifyHash(result.commitment, context, 2, two)).toBe(false);
  });

  it('generates a 32-byte salt and rejects malformed salts', () => {
    expect(randomSaltHex()).toMatch(/^[0-9a-f]{64}$/);
    expect(() => commitHash(context, 1, 'aa')).toThrow();
  });
});

describe('signed context', () => {
  it('changes for a new round, player, mode, or match', () => {
    const c = commitPedersen(1, one).commitment;
    const baseline = signedCommitmentMessage(context, 'pedersen', c);
    expect(signedCommitmentMessage({ ...context, roundNo: 2 }, 'pedersen', c)).not.toEqual(
      baseline,
    );
    expect(signedCommitmentMessage({ ...context, playerId: 'bob' }, 'pedersen', c)).not.toEqual(
      baseline,
    );
    expect(signedCommitmentMessage({ ...context, matchId: 'match-2' }, 'pedersen', c)).not.toEqual(
      baseline,
    );
  });
});
