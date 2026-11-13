import { openDB } from 'idb';
import { api } from './api.js';
import type { StoredPublicKey } from './types.js';

export type LocalKey = {
  id: string;
  userId: string;
  privateKey: CryptoKey;
  createdAt: string;
};

const database = openDB('rps-signing-keys', 1, {
  upgrade(db) {
    db.createObjectStore('keys', { keyPath: 'id' });
  },
});

async function generatePair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
    'verify',
  ]);
  if (pair.privateKey.extractable) throw new Error('Signing key must not be extractable');
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { privateKey: pair.privateKey, publicKey };
}

export async function registerBrowserKey(userId: string): Promise<LocalKey> {
  const pair = await generatePair();
  const response = await api<{ id: string }>('/api/keys/register', {
    method: 'POST',
    body: { publicKey: pair.publicKey },
  });
  const record = {
    id: response.id,
    userId,
    privateKey: pair.privateKey,
    createdAt: new Date().toISOString(),
  };
  await (await database).put('keys', record);
  return record;
}

export async function getActiveLocalKey(userId: string): Promise<LocalKey | null> {
  const remote = await api<StoredPublicKey[]>('/api/keys');
  const activeIds = new Set(remote.filter((k) => !k.revoked_at).map((k) => k.id));
  const local = (await (await database).getAll('keys')) as LocalKey[];
  return (
    local
      .filter((k) => k.userId === userId && activeIds.has(k.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

export async function ensureLocalKey(userId: string): Promise<LocalKey> {
  return (await getActiveLocalKey(userId)) ?? registerBrowserKey(userId);
}

export async function rotateBrowserKey(userId: string, oldKeyId: string): Promise<LocalKey> {
  const pair = await generatePair();
  const response = await api<{ id: string }>('/api/keys/rotate', {
    method: 'POST',
    body: { oldKeyId, publicKey: pair.publicKey },
  });
  const record = {
    id: response.id,
    userId,
    privateKey: pair.privateKey,
    createdAt: new Date().toISOString(),
  };
  await (await database).put('keys', record);
  await (await database).delete('keys', oldKeyId);
  return record;
}

export async function removeLocalKey(keyId: string) {
  await (await database).delete('keys', keyId);
}
