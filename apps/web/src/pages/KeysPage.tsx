import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.js';
import { registerBrowserKey, removeLocalKey, rotateBrowserKey } from '../keys.js';
import type { StoredPublicKey } from '../types.js';
import { EmptyState, Loading, PageTitle, StatusPill } from '../ui.js';

export function KeysPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<StoredPublicKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setKeys(await api<StoredPublicKey[]>('/api/keys'));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load keys.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function create() {
    if (!user) return;
    setBusy('new');
    try {
      await registerBrowserKey(user.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create key.');
    } finally {
      setBusy('');
    }
  }
  async function rotate(keyId: string) {
    if (!user) return;
    setBusy(keyId);
    try {
      await rotateBrowserKey(user.id, keyId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rotate key.');
    } finally {
      setBusy('');
    }
  }
  async function revoke(keyId: string) {
    setBusy(keyId);
    try {
      await api('/api/keys/revoke', { method: 'POST', body: { keyId } });
      await removeLocalKey(keyId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not revoke key.');
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="container content-page">
      <PageTitle
        eyebrow="YOUR SIGNING IDENTITY"
        title="My keys"
        description="Sign commitments with a private key stored in this browser. Rotate or revoke keys at any time."
        action={
          <button className="btn btn-primary" disabled={!!busy} onClick={() => void create()}>
            <Plus size={16} /> {busy === 'new' ? 'Creating…' : 'Create new key'}
          </button>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="card info-banner">
        <ShieldCheck size={22} />
        <p>
          Private keys are non-extractable Web Crypto keys in this browser’s IndexedDB. A new device
          creates a new key after sign in. Past signatures remain verifiable using their public
          keys.
        </p>
      </div>
      {loading ? (
        <Loading label="Loading keys…" />
      ) : keys.length === 0 ? (
        <EmptyState title="No keys yet">Create a signing key to play.</EmptyState>
      ) : (
        <div className="key-list">
          {keys
            .slice()
            .reverse()
            .map((key) => (
              <div className="card key-card" key={key.id}>
                <span className="key-icon">
                  <KeyRound size={21} />
                </span>
                <div className="key-details">
                  <strong>ECDSA P-256 signing key</strong>
                  <code>{key.id}</code>
                  <small>Created {new Date(key.created_at).toLocaleString()}</small>
                </div>
                <StatusPill tone={key.revoked_at ? 'bad' : 'good'}>
                  {key.revoked_at ? 'revoked' : 'active'}
                </StatusPill>
                {!key.revoked_at && (
                  <div className="key-actions">
                    <button
                      className="btn btn-outline btn-small"
                      disabled={!!busy}
                      onClick={() => void rotate(key.id)}
                    >
                      <RefreshCw size={15} /> Rotate
                    </button>
                    <button
                      className="btn btn-ghost btn-small"
                      disabled={!!busy}
                      onClick={() => void revoke(key.id)}
                    >
                      <Trash2 size={15} /> Revoke
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
