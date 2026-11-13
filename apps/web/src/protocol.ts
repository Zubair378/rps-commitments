import {
  assertPinnedParams,
  commitHash,
  commitPedersen,
  signedCommitmentMessage,
  verifyHash,
  verifyPedersen,
  type CommitmentContext,
  type Mode,
  type Move,
} from '@rps/crypto-core';
import { api } from './api.js';
import type { LocalKey } from './keys.js';
import type { Commitment, Reveal, StoredPublicKey } from './types.js';

export type Opening = { move: Move; blindingFactor: string; commitment: string; mode: Mode };
export type CommitPayload = {
  matchId: string;
  roundNo: number;
  keyId: string;
  mode: Mode;
  commitment: string;
  signature: string;
};

function storageKey(context: CommitmentContext) {
  return `rps-opening:${context.playerId}:${context.matchId}:${context.roundNo}`;
}

export function saveOpening(context: CommitmentContext, opening: Opening) {
  sessionStorage.setItem(storageKey(context), JSON.stringify(opening));
}
export function loadOpening(context: CommitmentContext): Opening | null {
  const raw = sessionStorage.getItem(storageKey(context));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Opening;
  } catch {
    return null;
  }
}
export function clearOpening(context: CommitmentContext) {
  sessionStorage.removeItem(storageKey(context));
}

export async function buildCommit(
  context: CommitmentContext,
  move: Move,
  mode: Mode,
  key: LocalKey,
  params: unknown,
): Promise<{ payload: CommitPayload; opening: Opening }> {
  assertPinnedParams(params);
  const result =
    mode === 'pedersen'
      ? commitPedersen(move)
      : commitHash(
          { playerId: context.playerId, matchId: context.matchId, roundNo: context.roundNo },
          move,
        );
  const opening = {
    move,
    blindingFactor:
      mode === 'pedersen'
        ? (result as ReturnType<typeof commitPedersen>).blindingFactor
        : (result as ReturnType<typeof commitHash>).salt,
    commitment: result.commitment,
    mode,
  };
  const message = signedCommitmentMessage(context, mode, result.commitment);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key.privateKey,
    Uint8Array.from(message),
  );
  return {
    opening,
    payload: {
      matchId: context.matchId,
      roundNo: context.roundNo,
      keyId: key.id,
      mode,
      commitment: result.commitment,
      signature: Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join(
        '',
      ),
    },
  };
}

export async function verifyTranscript(
  context: CommitmentContext,
  commitments: Commitment[],
  reveals: Reveal[],
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  for (const commitment of commitments) {
    const reveal = reveals.find((r) => r.user_id === commitment.user_id);
    if (!reveal) {
      results[commitment.user_id] = false;
      continue;
    }
    const openingValid =
      commitment.mode === 'pedersen'
        ? verifyPedersen(commitment.commitment, reveal.move, reveal.blinding_factor)
        : verifyHash(
            commitment.commitment,
            { playerId: commitment.user_id, matchId: context.matchId, roundNo: context.roundNo },
            reveal.move,
            reveal.blinding_factor,
          );
    if (!openingValid) {
      results[commitment.user_id] = false;
      continue;
    }
    try {
      const key = await api<StoredPublicKey>(`/api/keys/${commitment.key_id}`);
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        JSON.parse(key.jwk),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
      const message = signedCommitmentMessage(
        { ...context, playerId: commitment.user_id },
        commitment.mode,
        commitment.commitment,
      );
      const signature = Uint8Array.from(commitment.signature.match(/../g) ?? [], (h) =>
        parseInt(h, 16),
      );
      results[commitment.user_id] = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        Uint8Array.from(signature),
        Uint8Array.from(message),
      );
    } catch {
      results[commitment.user_id] = false;
    }
  }
  return results;
}
