import type { ReactNode } from 'react';
import { ArrowRight, CircleHelp, LoaderCircle } from 'lucide-react';

export function Term({ children, meaning }: { children: ReactNode; meaning: string }) {
  return (
    <span
      className="term"
      title={meaning}
      tabIndex={0}
      aria-label={`${String(children)}: ${meaning}`}
    >
      {children}
      <CircleHelp size={13} aria-hidden="true" />
    </span>
  );
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action && <div className="page-title-action">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-orbit">◎</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={20} />
      <span>{label}</span>
    </div>
  );
}

export function ArrowLink({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
      <ArrowRight size={16} />
    </span>
  );
}
