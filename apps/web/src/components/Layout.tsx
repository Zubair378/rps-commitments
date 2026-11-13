import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Fingerprint,
  Gamepad2,
  KeyRound,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../App.js';

const links = [
  { to: '/lobby', label: 'Tournaments' },
  { to: '/attack-lab', label: 'Attack Lab' },
  { to: '/benchmarks', label: 'Benchmarks' },
  { to: '/audit', label: 'Audit Log' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-shell min-h-screen">
      <div className="topline">
        <span>
          <span className="live-dot" /> CRYPTOGRAPHIC COMMITMENTS, MADE PLAYABLE
        </span>
        <span className="topline-right">
          <ShieldCheck size={13} /> P-256 · VERIFIED IN YOUR BROWSER
        </span>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Link
            to="/"
            className="brand"
            aria-label="RPS Commitments home"
            onClick={() => setMobileOpen(false)}
          >
            <span className="brand-mark">
              <Fingerprint size={24} strokeWidth={2.2} />
            </span>
            <span>
              <strong>
                RPS<span className="brand-accent">.</span>
              </strong>
              <small>COMMITMENTS</small>
            </span>
          </Link>
          <nav className={`site-nav ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                {link.label}
              </NavLink>
            ))}
            {user && (
              <NavLink
                to="/keys"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                My Keys
              </NavLink>
            )}
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <span className="user-chip">
                  <span className="avatar">{user.username[0]?.toUpperCase()}</span>
                  {user.username}
                </span>
                <button className="text-button logout-button" onClick={() => void logout()}>
                  Sign out
                </button>
              </>
            ) : (
              <Link className="btn btn-small btn-outline" to="/auth">
                Sign in <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          <button
            className="menu-toggle"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </header>
      <main className="main-content">{children}</main>
      <footer className="site-footer">
        <div className="footer-inner">
          <Link to="/" className="footer-brand">
            <Fingerprint size={22} /> RPS<span>.</span>COMMITMENTS
          </Link>
          <p>Every move has a proof. Every result has a trail.</p>
          <div className="footer-links">
            <Link to="/lobby">
              <Gamepad2 size={15} /> Play
            </Link>
            <Link to="/keys">
              <KeyRound size={15} /> Keys
            </Link>
            <Link to="/audit">
              <Activity size={15} /> Audit
            </Link>
          </div>
          <small>CS-3002 INFORMATION SECURITY · TOPIC 13</small>
        </div>
      </footer>
    </div>
  );
}
