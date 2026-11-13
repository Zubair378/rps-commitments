import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.js';
import { ensureLocalKey, registerBrowserKey } from '../keys.js';
import type { User } from '../types.js';
import { PageTitle } from '../ui.js';

export function AuthPage() {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await api<User>(mode === 'register' ? '/api/register' : '/api/login', {
        method: 'POST',
        body: { username: username.trim(), password },
      });
      if (mode === 'register') await registerBrowserKey(user.id);
      else await ensureLocalKey(user.id);
      setUser(user);
      navigate('/lobby');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container auth-layout">
      <div className="auth-side">
        <div className="auth-icon">
          <Fingerprint size={31} />
        </div>
        <p className="eyebrow">A FAIRER WAY TO PLAY</p>
        <h2>
          Your move.
          <br />
          <em>Your proof.</em>
        </h2>
        <p>
          Your signing key is created in this browser. The private half stays here and cannot be
          exported.
        </p>
        <div className="auth-perks">
          <div>
            <LockKeyhole size={19} />
            <span>Moves hidden until reveal</span>
          </div>
          <div>
            <KeyRound size={19} />
            <span>Non-extractable browser signing key</span>
          </div>
          <div>
            <ShieldCheck size={19} />
            <span>Every opening independently verifiable</span>
          </div>
        </div>
      </div>
      <div className="auth-card card">
        <PageTitle
          eyebrow="PLAYER ACCESS"
          title={mode === 'register' ? 'Create your player account' : 'Welcome back'}
          description={
            mode === 'register'
              ? 'Join the tournament with a key generated on this device.'
              : 'Sign in to continue your matches.'
          }
        />
        <div className="segmented" role="tablist" aria-label="Account action">
          <button
            className={mode === 'register' ? 'selected' : ''}
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Create account
          </button>
          <button
            className={mode === 'login' ? 'selected' : ''}
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Sign in
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="form-stack">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_-]+"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. player_one"
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={mode === 'register' ? 12 : 1}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 12 characters"
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary full-width" disabled={busy} type="submit">
            {busy
              ? 'Preparing your key…'
              : mode === 'register'
                ? 'Create account & key'
                : 'Sign in'}{' '}
            <span>→</span>
          </button>
        </form>
        <p className="auth-footnote">
          Your private key remains in this browser’s IndexedDB. Use key rotation if you change
          devices.
        </p>
      </div>
    </div>
  );
}
