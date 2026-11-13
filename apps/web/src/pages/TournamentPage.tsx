import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Copy, FlagTriangleRight, Trophy, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.js';
import type { BracketMatch, TournamentDetail } from '../types.js';
import { EmptyState, Loading, PageTitle, StatusPill } from '../ui.js';

function stageName(capacity: number, stage: number) {
  const remaining = Math.log2(capacity) - stage;
  return remaining === 0 ? 'Final' : remaining === 1 ? 'Semifinals' : 'Quarterfinals';
}

export function TournamentPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api<TournamentDetail>(`/api/tournaments/${id}`);
      setDetail(data);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load tournament.');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function join() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/tournaments/${id}/join`, { method: 'POST' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not join.');
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      setError('Copy failed. Use the address bar to share this link.');
    }
  }
  if (loading)
    return (
      <div className="container content-page">
        <Loading label="Loading bracket…" />
      </div>
    );
  if (!detail)
    return (
      <div className="container content-page">
        <p className="form-error">{error || 'Tournament not found.'}</p>
      </div>
    );
  const { tournament, participants, matches } = detail;
  const isPlayer = participants.some((p) => p.user_id === user?.id);
  const canJoin =
    user &&
    !isPlayer &&
    participants.length < tournament.capacity &&
    tournament.status !== 'BLOCKED';
  const names = Object.fromEntries(participants.map((p) => [p.user_id, p.username]));
  const stages = Array.from({ length: Math.log2(tournament.capacity) }, (_, i) => i + 1);
  function playerName(playerId: string) {
    return names[playerId] ?? 'Player';
  }
  function MatchCard({ match }: { match: BracketMatch }) {
    return (
      <Link className="bracket-match" to={`/matches/${match.id}`}>
        <div className="bracket-match-top">
          <span>MATCH {match.position.toString().padStart(2, '0')}</span>
          <StatusPill
            tone={
              match.status === 'RESOLVED' ? 'good' : match.status === 'ABANDONED' ? 'bad' : 'warn'
            }
          >
            {match.status.toLowerCase()}
          </StatusPill>
        </div>
        {[match.player_a_id, match.player_b_id].map((playerId) => (
          <div
            className={`bracket-player ${match.winner_user_id === playerId ? 'winner' : ''}`}
            key={playerId}
          >
            <span className="mini-avatar">{playerName(playerId)[0]?.toUpperCase()}</span>
            <strong>{playerName(playerId)}</strong>
            {match.winner_user_id === playerId && <Trophy size={15} />}
          </div>
        ))}
        <div className="bracket-match-bottom">
          {match.wins_required === 2 ? 'BEST OF 3' : 'SINGLE ROUND'} <ArrowRight size={15} />
        </div>
      </Link>
    );
  }
  return (
    <div className="container content-page">
      <Link className="back-link" to="/lobby">
        <ArrowLeft size={16} /> Back to lobby
      </Link>
      <PageTitle
        eyebrow="TOURNAMENT BRACKET"
        title={tournament.name}
        description={`${tournament.capacity} player · single-elimination · every move verifiable`}
        action={
          <button className="btn btn-outline" onClick={() => void share()}>
            <Copy size={16} /> Share link
          </button>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="tournament-meta">
        <StatusPill
          tone={
            tournament.status === 'COMPLETE'
              ? 'good'
              : tournament.status === 'BLOCKED'
                ? 'bad'
                : 'warn'
          }
        >
          {tournament.status.toLowerCase()}
        </StatusPill>
        <span>
          <Users size={16} /> {participants.length} / {tournament.capacity} players
        </span>
        {canJoin && (
          <button className="btn btn-primary btn-small" disabled={busy} onClick={() => void join()}>
            {busy ? 'Joining…' : 'Join tournament'} <ArrowRight size={15} />
          </button>
        )}
        {!user && participants.length < tournament.capacity && (
          <Link className="text-link" to="/auth">
            Sign in to join
          </Link>
        )}
      </div>
      <div className="bracket-panel card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">THE ROAD TO VICTORY</p>
            <h2>Bracket</h2>
          </div>
          <FlagTriangleRight size={21} />
        </div>
        {matches.length === 0 ? (
          <EmptyState title="Waiting for another player">
            Share the tournament link. Matches appear when players are paired.
          </EmptyState>
        ) : (
          <div className="bracket-columns">
            {stages.map((stage) => (
              <section className="bracket-column" key={stage}>
                <div className="bracket-stage-label">
                  <span>0{stage}</span>
                  {stageName(tournament.capacity, stage)}
                </div>
                <div className="bracket-stage-matches">
                  {matches
                    .filter((m) => m.stage === stage)
                    .sort((a, b) => a.position - b.position)
                    .map((m) => (
                      <MatchCard key={m.id} match={m} />
                    ))}
                  {!matches.some((m) => m.stage === stage) && (
                    <div className="bracket-placeholder">Waiting for previous winners</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <div className="players-panel card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">THE LINEUP</p>
            <h2>Players</h2>
          </div>
          <Users size={21} />
        </div>
        <div className="player-list">
          {participants.map((p) => (
            <div className="player-list-item" key={p.user_id}>
              <span className="mini-avatar">{p.username[0]?.toUpperCase()}</span>
              <strong>{p.username}</strong>
              <small>SLOT {String(p.slot).padStart(2, '0')}</small>
            </div>
          ))}
          {Array.from({ length: tournament.capacity - participants.length }, (_, i) => (
            <div className="player-list-item waiting" key={`open-${i}`}>
              <span className="mini-avatar">+</span>
              <span>Open seat</span>
              <small>SLOT {String(participants.length + i + 1).padStart(2, '0')}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
