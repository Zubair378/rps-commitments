import { useEffect, useState } from 'react';
import { Activity, BadgeCheck, ShieldAlert } from 'lucide-react';
import { api } from '../api.js';
import type { AuditEvent } from '../types.js';
import { EmptyState, Loading, PageTitle, StatusPill } from '../ui.js';

async function verifyChain(events: AuditEvent[]) {
  let previous = '0'.repeat(64);
  for (const event of events) {
    if (event.prev_hash !== previous || event.seq !== events.indexOf(event) + 1) return false;
    const text = `${previous}|${event.seq}|${event.event_type}|${event.event_json}|${event.created_at}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    if (hex !== event.hash) return false;
    previous = event.hash;
  }
  return true;
}

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [valid, setValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    void api<AuditEvent[]>('/api/audit')
      .then(async (data) => {
        setEvents(data);
        setValid(await verifyChain(data));
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Could not load audit log.'),
      )
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="container content-page">
      <PageTitle
        eyebrow="PUBLIC EVIDENCE"
        title="Audit log"
        description="A hash-linked record of accepted commitments, public openings, key changes, and match outcomes."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <Loading label="Checking hash chain…" />
      ) : (
        <>
          <div className="card audit-summary">
            {valid ? <BadgeCheck size={23} /> : <ShieldAlert size={23} />}
            <div>
              <strong>
                {valid ? 'Hash chain verified in this browser' : 'Hash chain failed verification'}
              </strong>
              <p>
                {events.length} events checked. A server operator could rewrite the entire chain;
                external anchoring is future work.
              </p>
            </div>
            <StatusPill tone={valid ? 'good' : 'bad'}>
              {valid ? 'integrity check passed' : 'check failed'}
            </StatusPill>
          </div>
          {events.length === 0 ? (
            <EmptyState title="No events yet">
              The first account or match will start the audit trail.
            </EmptyState>
          ) : (
            <div className="audit-list">
              {events
                .slice()
                .reverse()
                .map((event) => (
                  <article className="card audit-item" key={event.seq}>
                    <span className="audit-icon">
                      <Activity size={17} />
                    </span>
                    <div>
                      <div className="audit-item-header">
                        <strong>{event.event_type.replaceAll('_', ' ')}</strong>
                        <small>
                          #{event.seq} · {new Date(event.created_at).toLocaleString()}
                        </small>
                      </div>
                      <code title={event.hash}>SHA-256 {event.hash.slice(0, 20)}…</code>
                      <details>
                        <summary>View event data</summary>
                        <pre>{JSON.stringify(JSON.parse(event.event_json), null, 2)}</pre>
                      </details>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
