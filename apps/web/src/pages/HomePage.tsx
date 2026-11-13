import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { driver } from 'driver.js';
import {
  ArrowRight,
  BadgeCheck,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../App.js';
import { ArrowLink, Term } from '../ui.js';

function startTour() {
  const tour = driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.7,
    popoverClass: 'rps-tour',
    steps: [
      {
        element: '#tour-intro',
        popover: {
          title: 'Welcome to fair play',
          description:
            'This tournament uses cryptographic commitments so a move stays hidden and fixed until reveal.',
        },
      },
      {
        element: '#tour-commit',
        popover: {
          title: '1 · Commit',
          description:
            'Your browser turns a move and a random blinding factor into a commitment. The server receives only the commitment.',
        },
      },
      {
        element: '#tour-reveal',
        popover: {
          title: '2 · Reveal',
          description:
            'After both commitments arrive, players reveal their moves and blinding factors.',
        },
      },
      {
        element: '#tour-verify',
        popover: {
          title: '3 · Verify',
          description:
            'Everyone can check the opening and the player signature. The audit trail records the outcome.',
        },
      },
      {
        element: '#tour-play',
        popover: {
          title: 'Ready to try it?',
          description: 'Create a tournament or join one in the lobby.',
        },
      },
    ],
  });
  tour.drive();
}

export function HomePage() {
  const { user } = useAuth();
  useEffect(() => {
    if (localStorage.getItem('rps-tour-seen')) return;
    const timeout = window.setTimeout(() => {
      localStorage.setItem('rps-tour-seen', '1');
      startTour();
    }, 900);
    return () => window.clearTimeout(timeout);
  }, []);
  return (
    <>
      <section className="hero container" id="tour-intro">
        <div className="hero-copy">
          <span className="hero-tag">
            <Sparkles size={14} /> THE FAIR PLAY PROTOCOL
          </span>
          <h1>
            Play fair.
            <br />
            <em>Prove every move.</em>
          </h1>
          <p className="hero-lead">
            Rock, paper, scissors with a cryptographic promise. Lock in your move, keep it hidden,
            then reveal it with proof no one can change the story.
          </p>
          <div className="hero-actions">
            <Link id="tour-play" className="btn btn-primary" to={user ? '/lobby' : '/auth'}>
              {user ? 'Enter the lobby' : 'Start playing'} <ArrowRight size={18} />
            </Link>
            <button className="btn btn-ghost" onClick={startTour}>
              <Play size={16} /> Take the tour
            </button>
          </div>
          <div className="hero-proof">
            <span className="proof-avatars">
              <i>R</i>
              <i>P</i>
              <i>S</i>
            </span>
            <span>
              Real games. Verifiable results.
              <br />
              <strong>Openings are checked in your browser.</strong>
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Commitment protocol illustration">
          <div className="visual-grid" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="visual-card visual-card-back">
            <div className="visual-card-label">PLAYER 02</div>
            <div className="choice-symbol">✂</div>
            <span>MOVE HIDDEN</span>
          </div>
          <div className="visual-card visual-card-front">
            <div className="visual-card-top">
              <span>PLAYER 01</span>
              <span className="locked-badge">
                <LockKeyhole size={13} /> LOCKED
              </span>
            </div>
            <div className="choice-symbol">✊</div>
            <div className="commit-line">
              <span>COMMITMENT</span>
              <code>03a41611bb...92ddd</code>
            </div>
          </div>
          <div className="visual-verified">
            <BadgeCheck size={20} />
            <span>CRYPTOGRAPHICALLY VERIFIED</span>
          </div>
          <div className="visual-spark visual-spark-a">✦</div>
          <div className="visual-spark visual-spark-b">✳</div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="container trust-inner">
          <span>
            <LockKeyhole size={17} /> MOVES STAY PRIVATE
          </span>
          <span>
            <ShieldCheck size={17} /> OPENINGS ARE VERIFIED
          </span>
          <span>
            <Fingerprint size={17} /> EVERY ROUND IS AUDITABLE
          </span>
        </div>
      </section>

      <section className="container section how-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE THREE-STEP FLOW</p>
            <h2>
              Fairness you can <em>see.</em>
            </h2>
          </div>
          <p>Learn the protocol once, then watch it protect every match.</p>
        </div>
        <div className="steps-grid">
          <article className="step-card" id="tour-commit">
            <span className="step-index">01 / COMMIT</span>
            <div className="step-icon">
              <EyeOff size={27} />
            </div>
            <h3>Choose in secret</h3>
            <p>
              Your browser creates a{' '}
              <Term meaning="A value that hides your move now but fixes it for later.">
                commitment
              </Term>{' '}
              from your move and a random{' '}
              <Term meaning="A secret random number that hides which move you selected.">
                blinding factor
              </Term>
              . Only the commitment travels to the referee.
            </p>
            <div className="step-code">C = m·g + r·h</div>
          </article>
          <article className="step-card" id="tour-reveal">
            <span className="step-index">02 / REVEAL</span>
            <div className="step-icon amber">
              <LockKeyhole size={27} />
            </div>
            <h3>Open together</h3>
            <p>
              Once both players commit, the{' '}
              <Term meaning="The phase where a player shares their move and blinding factor so others can check the commitment.">
                reveal
              </Term>{' '}
              phase starts. Your move stays hidden from your opponent until both openings arrive or
              the deadline passes.
            </p>
            <div className="step-code">(move, r) → verify</div>
          </article>
          <article className="step-card" id="tour-verify">
            <span className="step-index">03 / VERIFY</span>
            <div className="step-icon violet">
              <BadgeCheck size={27} />
            </div>
            <h3>Proof beats trust</h3>
            <p>
              Everyone checks the opening and signature.{' '}
              <Term meaning="Hiding means the commitment does not disclose the move before reveal.">
                Hiding
              </Term>{' '}
              protects your move;{' '}
              <Term meaning="Binding means you cannot change the move after committing.">
                binding
              </Term>{' '}
              stops changes. The{' '}
              <Term meaning="A public record of match events linked by hashes.">audit log</Term>{' '}
              records the result.
            </p>
            <div className="step-code">m·g + r·h = C ✓</div>
          </article>
        </div>
      </section>

      <section className="container feature-section">
        <div className="feature-panel">
          <div className="feature-copy">
            <p className="eyebrow">UNDER THE HOOD</p>
            <h2>Cryptography, out in the open.</h2>
            <p>
              Inspect the commitment point, compare Pedersen with salted SHA-256, and follow each
              signature from browser to public result.
            </p>
            <Link className="text-link" to="/audit">
              <ArrowLink>Explore the audit log</ArrowLink>
            </Link>
          </div>
          <div className="equation-art">
            <div className="equation-label">PEDERSEN COMMITMENT</div>
            <div className="equation-main">
              C <span>=</span> m·g <span>+</span> r·h
            </div>
            <div className="equation-foot">
              <span>YOUR MOVE</span>
              <span>RANDOM BLIND</span>
              <span>PUBLIC POINT</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container cta-section">
        <div>
          <p className="eyebrow">READY WHEN YOU ARE</p>
          <h2>
            Make your first move.
            <br />
            <em>Prove it was yours.</em>
          </h2>
        </div>
        <Link className="btn btn-primary" to={user ? '/lobby' : '/auth'}>
          Go to tournament lobby <ArrowRight size={18} />
        </Link>
      </section>
    </>
  );
}
