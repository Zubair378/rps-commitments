import { useState } from 'react';
import { Activity, ArrowRight, Gauge } from 'lucide-react';
import { runBrowserBenchmark, type BrowserBenchmark } from '../browser-bench.js';
import { PageTitle } from '../ui.js';

const modes = [
  { key: 'pedersen', label: 'Pedersen P-256', size: 33 },
  { key: 'hash', label: 'Salted SHA-256', size: 32 },
] as const;
export function BenchmarkPage() {
  const [result, setResult] = useState<BrowserBenchmark | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  async function run() {
    setError('');
    setProgress('Preparing benchmark…');
    try {
      const data = await runBrowserBenchmark(setProgress);
      setResult(data);
      (window as Window & { benchmarkResult?: BrowserBenchmark }).benchmarkResult = data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Benchmark failed.');
    } finally {
      setProgress('');
    }
  }
  return (
    <div className="container content-page">
      <PageTitle
        eyebrow="MEASURED SECURITY COSTS"
        title="Benchmarks"
        description="Compare 1,000 browser samples per operation for Pedersen P-256 and salted SHA-256. Your device measures the cost."
      />
      <div className="card bench-intro">
        <Gauge size={25} />
        <div>
          <strong>Run a local browser benchmark</strong>
          <p>
            Measurements include commitment generation, opening serialization, and verification. The
            page may take several seconds.
          </p>
        </div>
        <button className="btn btn-primary" disabled={!!progress} onClick={() => void run()}>
          {progress ? 'Measuring…' : 'Run 1,000 samples'} <ArrowRight size={16} />
        </button>
      </div>
      {progress && (
        <p className="bench-progress" role="status">
          <Activity size={16} /> {progress}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="card bench-results">
          <h2>Results on this device</h2>
          <p className="muted">
            Median (p50) and 95th percentile (p95), milliseconds. Lower is faster.
          </p>
          <div className="bench-table-wrap">
            <table className="bench-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Operation</th>
                  <th>p50</th>
                  <th>p95</th>
                </tr>
              </thead>
              <tbody>
                {modes.flatMap((mode) =>
                  (['commit', 'open', 'verify'] as const).map((operation) => (
                    <tr key={`${mode.key}-${operation}`}>
                      <th>{mode.label}</th>
                      <td>{operation}</td>
                      <td>{result.summary[mode.key][operation].p50.toFixed(4)} ms</td>
                      <td>{result.summary[mode.key][operation].p95.toFixed(4)} ms</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <div className="bench-bars">
            {modes.map((mode) => (
              <div key={mode.key}>
                <span>{mode.label} · commit</span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(3, (result.summary[mode.key].commit.p50 / Math.max(...modes.map((m) => result.summary[m.key].commit.p50))) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <small>
            Measurements depend on browser, device load, and clock resolution. See committed CSV for
            repeatable Node results.
          </small>
        </div>
      )}
      <section className="card security-table">
        <h2>Security and size</h2>
        <div className="bench-table-wrap">
          <table className="bench-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Hiding</th>
                <th>Binding</th>
                <th>Commitment</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Pedersen P-256</th>
                <td>Perfect, with uniform r</td>
                <td>Discrete-log assumption</td>
                <td>33 bytes</td>
              </tr>
              <tr>
                <th>Salted SHA-256</th>
                <td>Computational, with 32-byte salt</td>
                <td>Collision/preimage resistance</td>
                <td>32 bytes</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted">
          Both add a 64-byte raw ECDSA P-256 signature in this app. A reveal includes the move and
          32-byte opening value, plus JSON framing.
        </p>
      </section>
    </div>
  );
}
