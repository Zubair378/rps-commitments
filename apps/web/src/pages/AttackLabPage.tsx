import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FlaskConical, ShieldCheck, ShieldX } from 'lucide-react';
import { ATTACKS, runAttack, type AttackId, type AttackResult } from '@rps/adversary-sim';
import { PageTitle, StatusPill } from '../ui.js';

export function AttackLabPage() {
  const [results, setResults] = useState<Partial<Record<AttackId, AttackResult>>>({});
  const [running, setRunning] = useState<AttackId | null>(null);
  const [error, setError] = useState('');
  async function run(id: AttackId) {
    setRunning(id);
    setError('');
    try {
      const result = await runAttack(id);
      setResults((previous) => ({ ...previous, [id]: result }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Experiment failed.');
    } finally {
      setRunning(null);
    }
  }
  return (
    <div className="container content-page">
      <PageTitle
        eyebrow="CONTROLLED SECURITY EXPERIMENTS"
        title="Attack lab"
        description="Run each deliberately vulnerable example, then see how the real protocol blocks it. These examples are isolated from the referee."
      />
      <div className="card info-banner">
        <FlaskConical size={23} />
        <p>
          INSECURE-DEMO code lives only in <code>packages/adversary-sim</code>. Every experiment is
          automated and tested. No account or live match is modified.
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="attack-grid">
        {ATTACKS.map((attack) => {
          const result = results[attack.id];
          return (
            <article className="card attack-card" key={attack.id}>
              <div className="attack-head">
                <span className="attack-id">{attack.id}</span>
                <StatusPill tone={result?.patchedBlocked ? 'good' : 'neutral'}>
                  {result ? (result.patchedBlocked ? 'defense held' : 'check failed') : 'ready'}
                </StatusPill>
              </div>
              <h2>{attack.title}</h2>
              <p className="muted">Defense: {attack.defense}</p>
              {result && (
                <div className="attack-result">
                  <div>
                    <ShieldX size={17} /> Vulnerable:{' '}
                    {result.vulnerableSuccess ? 'attack succeeded' : 'unexpected failure'}
                  </div>
                  <div>
                    <ShieldCheck size={17} /> Protected:{' '}
                    {result.patchedBlocked ? 'attack blocked' : 'check failed'}
                  </div>
                  <p>{result.evidence}</p>
                  {result.limitation && <small>{result.limitation}</small>}
                </div>
              )}
              <button
                className="btn btn-outline btn-small"
                disabled={running !== null}
                onClick={() => void run(attack.id)}
              >
                {running === attack.id ? 'Running…' : result ? 'Run again' : 'Run experiment'}{' '}
                <ArrowRight size={15} />
              </button>
            </article>
          );
        })}
      </div>
      <div className="card info-banner">
        <FlaskConical size={23} />
        <p>
          Curious about a property of Pedersen? Add two hidden commitments in the{' '}
          <Link className="text-link" to="/homomorphic-lab">
            homomorphic lab →
          </Link>
        </p>
      </div>
    </div>
  );
}
