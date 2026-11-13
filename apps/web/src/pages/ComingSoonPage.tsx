import { Link } from 'react-router-dom';
import { ArrowRight, FlaskConical, Gauge } from 'lucide-react';
import { PageTitle } from '../ui.js';

export function ComingSoonPage({ kind }: { kind: 'attacks' | 'benchmarks' }) {
  const attacks = kind === 'attacks';
  return (
    <div className="container content-page">
      <PageTitle
        eyebrow={attacks ? 'SECURITY EXPERIMENTS' : 'PERFORMANCE EVIDENCE'}
        title={attacks ? 'Attack lab' : 'Benchmarks'}
        description={
          attacks
            ? 'Controlled attacks explain which protocol checks stop cheating.'
            : 'Compare commitment generation, signing, and verification costs.'
        }
      />
      <div className="card coming-card">
        {attacks ? <FlaskConical size={38} /> : <Gauge size={38} />}
        <h2>Experiments are being prepared.</h2>
        <p>The project materials will include reproducible results and explanations.</p>
        <Link className="btn btn-primary" to="/lobby">
          Play a verified match <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}
