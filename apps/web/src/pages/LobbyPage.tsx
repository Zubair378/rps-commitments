import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Radio, Trophy, Users } from 'lucide-react';
import { api } from '../api.js';
import type { Tournament } from '../types.js';
import { EmptyState, Loading, PageTitle, StatusPill } from '../ui.js';

export function LobbyPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<2 | 4 | 8>(4);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await api<Tournament[]>('/api/tournaments');
        if (active) {
          setTournaments(data.slice().reverse());
          setError('');
        }
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Could not load tournaments.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const tournament = await api<{ id: string }>('/api/tournaments', {
        method: 'POST',
        body: { name: name.trim(), capacity },
      });
      navigate(`/tournaments/${tournament.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create tournament.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container content-page">
      <PageTitle
        eyebrow="THE ARENA"
        title="Tournament lobby"
        description="Find a table, invite your friends, and let the bracket settle it."
      />
      <div className="lobby-grid">
        <section className="card create-card">
          <div className="card-topline">
            <span className="card-icon">
              <Plus size={20} />
            </span>
            <span className="mini-label">NEW TOURNAMENT</span>
          </div>
          <h2>Start a fair fight.</h2>
          <p className="muted">Create a tournament and share its link with the other players.</p>
          <form onSubmit={(e) => void create(e)} className="form-stack">
            <label htmlFor="tournament-name">Tournament name</label>
            <input
              id="tournament-name"
              required
              minLength={3}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday game night"
            />
            <label htmlFor="capacity">Players</label>
            <select
              id="capacity"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value) as 2 | 4 | 8)}
            >
              <option value={2}>2 players · quick match</option>
              <option value={4}>4 players · bracket</option>
              <option value={8}>8 players · full tournament</option>
            </select>
            <button className="btn btn-primary full-width" disabled={busy}>
              {busy ? 'Creating…' : 'Create tournament'} <ArrowRight size={18} />
            </button>
          </form>
        </section>
        <section className="lobby-list">
          <div className="list-heading">
            <div>
              <p className="eyebrow">LIVE TABLES</p>
              <h2>Open tournaments</h2>
            </div>
            <span className="list-count">
              <Radio size={15} /> {tournaments.length} listed
            </span>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {loading ? (
            <Loading label="Finding tournaments…" />
          ) : tournaments.length === 0 ? (
            <EmptyState title="The lobby is quiet">
              Create the first tournament and invite another player.
            </EmptyState>
          ) : (
            <div className="tournament-list">
              {tournaments.map((t) => (
                <Link className="tournament-item" key={t.id} to={`/tournaments/${t.id}`}>
                  <span className="tournament-icon">
                    <Trophy size={23} />
                  </span>
                  <span className="tournament-name">
                    <strong>{t.name}</strong>
                    <small>
                      <Users size={13} /> {t.capacity} players ·{' '}
                      {new Date(t.created_at).toLocaleDateString()}
                    </small>
                  </span>
                  <StatusPill
                    tone={
                      t.status === 'COMPLETE'
                        ? 'good'
                        : t.status === 'BLOCKED'
                          ? 'bad'
                          : t.status === 'ACTIVE'
                            ? 'warn'
                            : 'neutral'
                    }
                  >
                    {t.status.toLowerCase()}
                  </StatusPill>
                  <ArrowRight className="item-arrow" size={18} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
