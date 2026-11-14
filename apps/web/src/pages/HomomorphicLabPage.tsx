import { useState } from 'react';
import { homomorphicExample } from '@rps/crypto-core';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { PageTitle, StatusPill } from '../ui.js';

type Result = ReturnType<typeof homomorphicExample>;
export function HomomorphicLabPage() {
  const [result, setResult] = useState<Result | null>(null);
  return (
    <div className="container content-page">
      <PageTitle
        eyebrow="A PROPERTY OF PEDERSEN"
        title="Homomorphic lab"
        description="Add two commitment points without opening them. The sum commits to the sum of their moves."
      />
      <div className="card action-card">
        <FlaskConical size={25} color="#7ee4b4" />
        <h2>C(rock, r₁) + C(paper, r₂) = C(3, r₁+r₂)</h2>
        <p className="muted">
          Here rock is 1 and paper is 2, so the combined point commits to 3. This demonstrates
          algebraic structure; it does not grant a valid move to a player or bypass the signed round
          protocol.
        </p>
        <button className="btn btn-primary" onClick={() => setResult(homomorphicExample())}>
          Generate example <ArrowRight size={17} />
        </button>
        {result && (
          <div className="homomorphic-result">
            <StatusPill tone={result.equal ? 'good' : 'bad'}>
              {result.equal ? 'points match' : 'unexpected mismatch'}
            </StatusPill>
            <p>Rock commitment</p>
            <code>{result.rock}</code>
            <p>Paper commitment</p>
            <code>{result.paper}</code>
            <p>Added point</p>
            <code>{result.combined}</code>
            <p>Fresh commitment to 3 with summed blind</p>
            <code>{result.expected}</code>
          </div>
        )}
      </div>
    </div>
  );
}
