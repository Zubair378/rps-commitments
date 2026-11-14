import { p256, p256_hasher } from '@noble/curves/nist.js';
import { bytesToHex, equalBytes, hexToBytes } from '@noble/curves/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
export { verifyAuditChain, type HashChainEvent } from './audit.js';

export const H_SEED = 'CS3002-RPS-PEDERSEN-H-v1';
export const H_DST = 'CS3002-RPS-PEDERSEN-v1';
export const HASH_DOMAIN = 'CS3002-RPS-HASH-COMMIT-v1';
export const CURVE = 'P-256';
export const PINNED_H_HEX = '032e99d80e985ad3cbfda47fb8c5db74e3f32c83ac7b7b16b6431da9f517e738f7';
export const Move = { Rock: 1, Paper: 2, Scissors: 3 } as const;
export type Move = (typeof Move)[keyof typeof Move];
export type Mode = 'pedersen' | 'hash';
export type CommitmentContext = {
  tournamentId: string;
  matchId: string;
  roundNo: number;
  playerId: string;
};

const encoder = new TextEncoder();
const point = p256.Point;

export function deriveH() {
  const h = p256_hasher.hashToCurve(encoder.encode(H_SEED), { DST: H_DST });
  h.assertValidity();
  if (h.equals(point.ZERO) || h.equals(point.BASE)) throw new Error('Unsafe second generator');
  return h;
}

export const H = deriveH();
if (H.toHex(true) !== PINNED_H_HEX) throw new Error('Pinned second generator mismatch');
export const PUBLIC_PARAMS = Object.freeze({
  version: 'rps-pedersen-v1',
  curve: CURVE,
  suite: 'P256_XMD:SHA-256_SSWU_RO_',
  seed: H_SEED,
  dst: H_DST,
  g: point.BASE.toHex(true),
  h: PINNED_H_HEX,
});

export function assertPinnedParams(params: unknown): void {
  if (!params || typeof params !== 'object') throw new Error('Missing public parameters');
  const candidate = params as Record<string, unknown>;
  for (const [key, value] of Object.entries(PUBLIC_PARAMS)) {
    if (candidate[key] !== value) throw new Error(`Public parameter mismatch: ${key}`);
  }
  if (deriveH().toHex(true) !== PUBLIC_PARAMS.h) throw new Error('Second generator mismatch');
}

export function parseMove(value: unknown): Move {
  if (value !== 1 && value !== 2 && value !== 3) throw new Error('Move must be 1, 2, or 3');
  return value;
}

export function parseScalar(hex: string): bigint {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('Scalar must be canonical 32-byte hex');
  const scalar = BigInt(`0x${hex}`);
  if (scalar >= point.Fn.ORDER) throw new Error('Scalar out of range');
  return scalar;
}

export function parseCommitment(hex: string) {
  if (!/^(02|03)[0-9a-f]{64}$/.test(hex)) throw new Error('Expected compressed P-256 point');
  const decoded = point.fromBytes(hexToBytes(hex));
  decoded.assertValidity();
  if (decoded.equals(point.ZERO) || decoded.toHex(true) !== hex) {
    throw new Error('Invalid or noncanonical point');
  }
  return decoded;
}

export function randomScalarHex(): string {
  const candidate = new Uint8Array(32);
  for (;;) {
    globalThis.crypto.getRandomValues(candidate);
    const hex = bytesToHex(candidate);
    if (BigInt(`0x${hex}`) < point.Fn.ORDER) return hex;
  }
}

function blindTerm(scalar: bigint) {
  return scalar === 0n ? point.ZERO : H.multiply(scalar);
}

export function commitPedersen(moveInput: unknown, blindingFactor?: string) {
  const move = parseMove(moveInput);
  for (;;) {
    const r = blindingFactor ?? randomScalarHex();
    const scalar = parseScalar(r);
    const commitmentPoint = point.BASE.multiply(BigInt(move)).add(blindTerm(scalar));
    if (!commitmentPoint.equals(point.ZERO)) {
      return { commitment: commitmentPoint.toHex(true), blindingFactor: r };
    }
    if (blindingFactor !== undefined) throw new Error('Identity commitment');
  }
}

export function verifyPedersen(
  commitment: string,
  moveInput: unknown,
  blindingFactor: string,
): boolean {
  try {
    const move = parseMove(moveInput);
    const received = parseCommitment(commitment);
    const expected = point.BASE.multiply(BigInt(move)).add(blindTerm(parseScalar(blindingFactor)));
    return expected.equals(received);
  } catch {
    return false;
  }
}

/** Classroom illustration: C(rock,r1) + C(paper,r2) = C(3,r1+r2). */
export function homomorphicExample() {
  const rock = commitPedersen(Move.Rock);
  const paper = commitPedersen(Move.Paper);
  const sumScalar =
    (parseScalar(rock.blindingFactor) + parseScalar(paper.blindingFactor)) % point.Fn.ORDER;
  const combined = parseCommitment(rock.commitment)
    .add(parseCommitment(paper.commitment))
    .toHex(true);
  const expected = commitPedersen(Move.Scissors, sumScalar.toString(16).padStart(64, '0'));
  return {
    rock: rock.commitment,
    paper: paper.commitment,
    combined,
    expected: expected.commitment,
    equal: combined === expected.commitment,
  };
}

function field(value: string): Uint8Array {
  const data = encoder.encode(value);
  if (data.length < 1 || data.length > 256) throw new Error('Invalid field length');
  const out = new Uint8Array(2 + data.length);
  new DataView(out.buffer).setUint16(0, data.length, false);
  out.set(data, 2);
  return out;
}

function roundBytes(roundNo: number): Uint8Array {
  if (!Number.isSafeInteger(roundNo) || roundNo < 1 || roundNo > 0xffffffff) {
    throw new Error('Invalid round number');
  }
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, roundNo, false);
  return out;
}

function join(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function randomSaltHex(): string {
  const salt = new Uint8Array(32);
  globalThis.crypto.getRandomValues(salt);
  return bytesToHex(salt);
}

export function commitHash(
  context: Pick<CommitmentContext, 'playerId' | 'matchId' | 'roundNo'>,
  moveInput: unknown,
  salt = randomSaltHex(),
) {
  const move = parseMove(moveInput);
  if (!/^[0-9a-f]{64}$/.test(salt)) throw new Error('Salt must be canonical 32-byte hex');
  const input = join(
    field(HASH_DOMAIN),
    field(context.playerId),
    field(context.matchId),
    roundBytes(context.roundNo),
    Uint8Array.of(move),
    hexToBytes(salt),
  );
  return { commitment: bytesToHex(sha256(input)), salt };
}

export function verifyHash(
  commitment: string,
  context: Pick<CommitmentContext, 'playerId' | 'matchId' | 'roundNo'>,
  moveInput: unknown,
  salt: string,
): boolean {
  try {
    if (!/^[0-9a-f]{64}$/.test(commitment)) return false;
    const expected = commitHash(context, moveInput, salt).commitment;
    return equalBytes(hexToBytes(expected), hexToBytes(commitment));
  } catch {
    return false;
  }
}

export function signedCommitmentMessage(
  context: CommitmentContext,
  mode: Mode,
  commitment: string,
) {
  if (mode === 'pedersen') parseCommitment(commitment);
  else if (mode === 'hash') {
    if (!/^[0-9a-f]{64}$/.test(commitment)) throw new Error('Invalid hash commitment');
  } else throw new Error('Invalid mode');
  return join(
    field('CS3002-RPS-SIGNED-COMMIT-v1'),
    field(context.tournamentId),
    field(context.matchId),
    roundBytes(context.roundNo),
    field(context.playerId),
    field(mode),
    field(commitment),
  );
}
