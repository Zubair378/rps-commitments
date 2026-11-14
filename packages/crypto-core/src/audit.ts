import { bytesToHex } from '@noble/curves/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';

export type HashChainEvent = {
  seq: number;
  prev_hash: string;
  hash: string;
  event_type: string;
  event_json: string;
  created_at: string;
};

/** Verify a server-provided event chain from its fixed genesis value. */
export function verifyAuditChain(events: HashChainEvent[]): boolean {
  let previous = '0'.repeat(64);
  let sequence = 1;
  for (const event of events) {
    if (event.prev_hash !== previous || event.seq !== sequence) return false;
    const payload = `${previous}|${event.seq}|${event.event_type}|${event.event_json}|${event.created_at}`;
    const expected = bytesToHex(sha256(new TextEncoder().encode(payload)));
    if (event.hash !== expected) return false;
    previous = event.hash;
    sequence++;
  }
  return true;
}
