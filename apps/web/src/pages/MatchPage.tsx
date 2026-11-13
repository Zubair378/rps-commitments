import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldAlert,
  Swords,
  Trophy,
} from 'lucide-react';
import { Move, PUBLIC_PARAMS, type Mode } from '@rps/crypto-core';
import { api, wsUrl } from '../api.js';
import { useAuth } from '../App.js';
import { ensureLocalKey } from '../keys.js';
import {
  buildCommit,
  clearOpening,
  loadOpening,
  saveOpening,
  verifyTranscript,
} from '../protocol.js';
import type { MatchDetail, TournamentDetail } from '../types.js';
import { Loading, PageTitle, StatusPill, Term } from '../ui.js';

const choices: { move: Move; symbol: string; label: string }[] = [
  { move: Move.Rock, symbol: '✊', label: 'Rock' },
  { move: Move.Paper, symbol: '✋', label: 'Paper' },
  { move: Move.Scissors, symbol: '✌', label: 'Scissors' },
];
const moveName = (value: Move) =>
  choices.find((choice) => choice.move === value)?.label ?? 'Unknown';

export function MatchPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [move, setMove] = useState<Move>(Move.Rock);
  const [mode, setMode] = useState<Mode>('pedersen');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verification, setVerification] = useState<Record<string, boolean> | null>(null);
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const value = await api<MatchDetail>(`/api/matches/${id}`);
      setDetail(value);
      const bracket = await api<TournamentDetail>(`/api/tournaments/${value.match.tournament_id}`);
      setTournament(bracket);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load match.');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl(`/ws/matches/${id}`));
      socket.onmessage = () => void load();
    } catch {
      /* Polling remains available. */
    }
    return () => {
      window.clearInterval(timer);
      socket?.close();
    };
  }, [id, load]);
  useEffect(() => {
    if (!detail || detail.round.status !== 'RESOLVED' || !detail.reveals) {
      setVerification(null);
      return;
    }
    let active = true;
    void verifyTranscript(
      {
        tournamentId: detail.match.tournament_id,
        matchId: detail.match.id,
        roundNo: detail.round.round_no,
        playerId: '',
      },
      detail.commitments,
      detail.reveals,
    ).then((result) => {
      if (active) setVerification(result);
    });
    return () => {
      active = false;
    };
  }, [detail?.round.id, detail?.round.status]);
  if (loading)
    return (
      <div className="container content-page">
        <Loading label="Loading match…" />
      </div>
    );
  if (!detail)
    return (
      <div className="container content-page">
        <p className="form-error" role="alert">
          {error || 'Match not found.'}
        </p>
      </div>
    );
  const { match, round, commitments, reveals, score, revealedUserIds } = detail;
  const context = {
    tournamentId: match.tournament_id,
    matchId: match.id,
    roundNo: round.round_no,
    playerId: user?.id ?? '',
  };
  const opening = user ? loadOpening(context) : null;
  const isPlayer = user && [match.player_a_id, match.player_b_id].includes(user.id);
  const committed = commitments.some((c) => c.user_id === user?.id);
  const revealed = revealedUserIds.includes(user?.id ?? '');
  const names = Object.fromEntries(
    tournament?.participants.map((p) => [p.user_id, p.username]) ?? [],
  );
  const aName = names[match.player_a_id] ?? 'Player A';
  const bName = names[match.player_b_id] ?? 'Player B';
  async function commit() {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      const [key, params] = await Promise.all([ensureLocalKey(user.id), api('/api/params')]);
      const { payload, opening: nextOpening } = await buildCommit(context, move, mode, key, params);
      // Save first: a lost HTTP response must not destroy the only opening.
      saveOpening(context, nextOpening);
      await api('/api/commit', { method: 'POST', body: payload });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Commitment failed.');
    } finally {
      setBusy(false);
    }
  }
  async function reveal() {
    if (!opening) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/reveal', {
        method: 'POST',
        body: {
          matchId: match.id,
          roundNo: round.round_no,
          move: opening.move,
          blindingFactor: opening.blindingFactor,
        },
      });
      clearOpening(context);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reveal failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container content-page match-page">
      <Link className="back-link" to={`/tournaments/${match.tournament_id}`}>
        <ArrowLeft size={16} /> Back to bracket
      </Link>
      <PageTitle
        eyebrow={`ROUND ${round.round_no.toString().padStart(2, '0')} · ${match.wins_required === 2 ? 'BEST OF THREE' : 'SINGLE ROUND'}`}
        title="The fair play arena"
        description="Commit in secret. Reveal when both players are ready. Verify the result."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="match-score card">
        <div className="score-player">
          <span className="mini-avatar">{aName[0]?.toUpperCase()}</span>
          <strong>{aName}</strong>
          <b>{score[match.player_a_id] ?? 0}</b>
        </div>
        <span className="score-vs">
          <Swords size={22} /> VS
        </span>
        <div className="score-player">
          <b>{score[match.player_b_id] ?? 0}</b>
          <strong>{bName}</strong>
          <span className="mini-avatar">{bName[0]?.toUpperCase()}</span>
        </div>
      </div>
      <div className="phase-strip card">
        <span className={round.status === 'COMMIT' ? 'phase-current' : ''}>
          <LockKeyhole size={18} /> 01 Commit
        </span>
        <span className={round.status === 'REVEAL' ? 'phase-current' : ''}>
          <Eye size={18} /> 02 Reveal
        </span>
        <span className={round.status === 'RESOLVED' ? 'phase-current' : ''}>
          <BadgeCheck size={18} /> 03 Verify
        </span>
      </div>
      {match.status === 'RESOLVED' && (
        <div className="result-banner card">
          <Trophy size={23} />{' '}
          {match.winner_user_id
            ? `${names[match.winner_user_id] ?? 'Player'} wins the match`
            : 'Match complete'}
        </div>
      )}
      {round.status === 'COMMIT' && (
        <section className="card action-card">
          <p className="eyebrow">YOUR SECRET MOVE</p>
          <h2>
            {committed
              ? 'Commitment locked in.'
              : isPlayer
                ? 'Choose your move.'
                : 'Players are committing.'}
          </h2>
          <p className="muted">
            {committed
              ? 'Your opponent sees only the commitment. Wait for both players.'
              : 'Your move and blinding factor stay in this browser until reveal.'}
          </p>
          {isPlayer && !committed && (
            <>
              <div className="move-grid" role="group" aria-label="Choose move">
                {choices.map((choice) => (
                  <button
                    key={choice.move}
                    className={`move-card ${move === choice.move ? 'selected' : ''}`}
                    aria-pressed={move === choice.move}
                    onClick={() => setMove(choice.move)}
                  >
                    <span>{choice.symbol}</span>
                    {choice.label}
                  </button>
                ))}
              </div>
              <div className="mode-choice">
                <label htmlFor="commit-mode">
                  <Term meaning="The cryptographic construction used to lock your move.">
                    Commitment mode
                  </Term>
                </label>
                <select
                  id="commit-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                >
                  <option value="pedersen">Pedersen · perfectly hiding</option>
                  <option value="hash">Salted SHA-256 · comparison</option>
                </select>
              </div>
              <button className="btn btn-primary" disabled={busy} onClick={() => void commit()}>
                {busy ? 'Securing move…' : 'Commit my move'} <LockKeyhole size={17} />
              </button>
            </>
          )}
          <p className="phase-note">
            <EyeOff size={16} /> {commitments.length} of 2 commitments received. Deadline:{' '}
            {new Date(round.commit_deadline).toLocaleTimeString()}.
          </p>
        </section>
      )}
      {round.status === 'REVEAL' && (
        <section className="card action-card">
          <p className="eyebrow">OPEN YOUR COMMITMENT</p>
          <h2>{revealed ? 'Your opening is received.' : 'Time to reveal.'}</h2>
          <p className="muted">
            The referee accepts openings only after both players have committed. Public results
            appear after both openings arrive.
          </p>
          {isPlayer &&
            !revealed &&
            (opening ? (
              <>
                <p className="saved-move">
                  Saved move: <strong>{moveName(opening.move)}</strong>
                </p>
                <button className="btn btn-primary" disabled={busy} onClick={() => void reveal()}>
                  {busy ? 'Revealing…' : 'Reveal and verify'} <Eye size={17} />
                </button>
              </>
            ) : (
              <p className="form-error" role="alert">
                <ShieldAlert size={17} /> This browser has no saved opening for this round. Return
                to the browser and tab where you committed; otherwise the reveal deadline will
                determine the outcome.
              </p>
            ))}
          <p className="phase-note">
            <Eye size={16} /> {revealedUserIds.length} of 2 openings received.
          </p>
        </section>
      )}
      {round.status === 'RESOLVED' && (
        <section className="card action-card">
          <p className="eyebrow">PUBLIC VERIFICATION</p>
          <h2>Round {round.round_no} result</h2>
          <p className="muted">
            {round.winner_user_id
              ? `${names[round.winner_user_id] ?? 'Player'} won this round.`
              : 'This round was a tie.'}{' '}
            Each available opening is checked in your browser.
          </p>
          <div className="verification-list">
            {[match.player_a_id, match.player_b_id].map((playerId) => (
              <div key={playerId}>
                <strong>{names[playerId] ?? 'Player'}</strong>
                <span>
                  {reveals?.find((r) => r.user_id === playerId)?.move
                    ? moveName(reveals.find((r) => r.user_id === playerId)!.move)
                    : 'No opening'}
                </span>
                <StatusPill tone={verification?.[playerId] ? 'good' : 'bad'}>
                  {verification === null
                    ? 'checking'
                    : verification[playerId]
                      ? 'verified'
                      : 'unverified'}
                </StatusPill>
              </div>
            ))}
          </div>
          <Link className="text-link" to="/audit">
            View audit trail →
          </Link>
        </section>
      )}
      <div className="round-history card">
        <p className="eyebrow">MATCH PROGRESS</p>
        <h2>Round history</h2>
        <div className="round-chips">
          {detail.rounds.map((r) => (
            <span key={r.round_no} className="round-chip">
              Round {r.round_no} · {r.status.toLowerCase()}{' '}
              {r.winner_user_id ? `· ${names[r.winner_user_id] ?? 'Player'}` : ''}
            </span>
          ))}
        </div>
      </div>
      <details className="card inspector-card">
        <summary>Crypto inspector · public round data</summary>
        <p>
          Before reveal, only the commitment and signature are public. The move and blinding factor
          appear after resolution.
        </p>
        <dl>
          <dt>Curve</dt>
          <dd>{PUBLIC_PARAMS.curve}</dd>
          <dt>Second generator H</dt>
          <dd>
            <code>{PUBLIC_PARAMS.h}</code>
          </dd>
        </dl>
        {commitments.map((commitment) => (
          <div className="inspector-entry" key={commitment.user_id}>
            <strong>
              {names[commitment.user_id] ?? 'Player'} · {commitment.mode}
            </strong>
            <label>Commitment</label>
            <code>{commitment.commitment}</code>
            <label>Signature</label>
            <code>{commitment.signature}</code>
            {round.status === 'RESOLVED' && (
              <>
                <label>Opening</label>
                <code>
                  {reveals?.find((r) => r.user_id === commitment.user_id)
                    ? `${moveName(reveals.find((r) => r.user_id === commitment.user_id)!.move)} / ${reveals.find((r) => r.user_id === commitment.user_id)!.blinding_factor}`
                    : 'Not revealed'}
                </code>
              </>
            )}
          </div>
        ))}
      </details>
    </div>
  );
}
