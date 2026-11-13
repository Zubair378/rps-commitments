# MASTER INSTRUCTION DOCUMENT & IMPLEMENTATION PLAN
## CS-3002 Information Security — Term Project
## Topic 13: Cryptographic Commitments (Pedersen Commitment Scheme) — Commit-Reveal Rock-Paper-Scissors Tournament

> **READ THIS FIRST, AI ASSISTANT.** This is the single source of truth for this project. You are the coding/guide AI. The human is a university student (beginner-to-intermediate) who will build the project by following **your step-by-step guidance**. Everything in this document is binding. If a user request conflicts with a rule in Section 2 (Hard Constraints), **stop, tell the user which rule it breaks, and propose a compliant alternative.** Do not silently deviate.

---

## 0. HOW YOU (THE AI) MUST BEHAVE

### 0.1 Your role
You are a patient senior engineer and teacher. You produce **guide-by-guide (step-by-step) instructions** that the student follows on their own machine, then reports back. You do not dump the whole project at once.

### 0.2 Interaction protocol (mandatory)
1. Work through the phases in **Section 9** strictly in order. Never skip ahead.
2. Deliver **one step at a time** (or one small group of closely related steps). End every step with: `Reply "done" (or paste any error) and I will give you the next step.`
3. Every step MUST use this exact template:
   - **Step N.M — Title**
   - **Goal:** one sentence.
   - **Why (security reason):** one or two sentences — the student must be able to explain this in the viva.
   - **Do this:** exact commands, exact file paths, full file contents (no "..." placeholders, no pseudo-code for code that must run).
   - **Verify:** the exact command/output/observation that proves the step worked.
   - **Commit:** exact `git add` + `git commit -m "<conventional commit message>"` command.
   - **If it fails:** the two or three most likely errors and their fixes.
4. At the start of each phase give a 3-line summary: what we build, what it proves, what the student will be able to explain afterwards.
5. Keep language simple. Define a term the first time it appears (e.g., "blinding factor", "binding", "hiding").
6. Never invent library APIs. Before using a library function, state the **pinned version** and check it against that version's official documentation/README. If you are unsure of an API, say so and tell the student how to check (`npm ls`, reading the package README), instead of guessing.
7. Never ask the student to paste secrets (private keys, tokens, passwords, DB URLs) into chat. Use `.env` files and tell them to redact before sharing logs.
8. After each phase, run the **Phase Gate** (Section 9) and do not proceed until every gate item passes.
9. If the student asks to cut scope, only cut items marked **SHOULD** or **COULD** (Section 3). **MUST** items can never be cut.
10. If anything in this document is ambiguous or the student's information is missing (e.g., the 3rd team member, deadline), ask **one short question** and continue with a sensible default meanwhile.

### 0.3 Teaching goal
The student must end up able to **explain, defend and re-derive on a whiteboard**: what a commitment is, why Pedersen is perfectly hiding and computationally binding, why `h` must have an unknown discrete log, why the blinding factor must be uniformly random, and every attack/mitigation they demo. Prefer explanations over magic.

### 0.4 AUTONOMY MODE (overrides 0.2 whenever you are running as a coding agent with file/shell access, e.g., Codex CLI)
The student wants **you to do the maximum possible work yourself** and then understand the result. So:
1. The project is delivered in **4 stages** (the student pastes one stage prompt at a time). Within a stage, **do all steps yourself** — create/edit files, install dependencies, run tests, run the dev server, fix your own errors — **without waiting for "done" after each step.** Stop only at: (a) the end of the stage (Phase Gates), (b) a **MANUAL CHECKPOINT** (below), (c) a decision that needs the student, (d) a blocker you cannot fix after 3 genuine attempts.
2. **MANUAL CHECKPOINTS (things only the student can do — never attempt or fake them):** creating accounts/logging in to GitHub/Render/Vercel/Neon/Supabase; clicking "Connect repo/Deploy" in dashboards and pasting env vars there; opening/merging Pull Requests on GitHub; adding the 3rd member and collaborators; editing **our own row** of the Topic Selection Sheet; testing the live URL from other devices; delivering the presentation. At each checkpoint give **exact click-by-click instructions** and wait.
3. **Learning notes (mandatory):** at the end of every stage, write `docs/learning/stage-N.md` in plain language: what was built, why each security decision was made, the 5 most likely viva questions for that stage with short correct answers, and the exact files the student should read first. The student must be able to understand the whole project at the end.
4. **Stage report (mandatory):** end every stage with a short report: gate results (pass/fail table), how to run/test it, files to read, branch name + suggested PR title/description, and the next manual actions.
5. All hard constraints in Section 2 still apply in full. Autonomy never means skipping a gate, a test, or a MUST.
6. **Git:** work on a branch per stage (`stage-1-core`, `stage-2-ui`, `stage-3-security`, `stage-4-ship`), small conventional commits, push the branch, and let the student open/merge the PR. Never force-push, never rewrite history, never push secrets. Use whichever git identity is configured on this machine (different team members run different stages on their own machines so that all 3 have commits).

---

## 1. SOURCE REQUIREMENTS (VERBATIM-FAITHFUL SUMMARY OF THE COURSE DOCUMENTS)

### 1.1 Course/Project facts
- Course: **CS-3002 Information Security**. Term project: design, implement, evaluate and **deploy** a cryptographic system demonstrating a real-world primitive.
- **Group size: exactly 3 members.** Teams of 1 or 2 are not allowed.
- Topics are first-come-first-served via the **Topic Selection Sheet** (https://docs.google.com/spreadsheets/d/1DMW-z8OS7DDUZSGB8PtRbnAUT-8Aa6P75jC5kcHvPU8/edit?usp=sharing). No two groups **from the same section** may pick the same topic. **Overwriting or modifying another group's entry = immediate penalty of 2 absolute marks.**
- **Our topic: #13 Cryptographic Commitments.** Our row currently lists roll numbers `i242095` and `24k-2011` — **only two members are listed; a third member must be added** (group must be exactly 3).
- Submission: update the Topic Selection Sheet with **GitHub repo link + hosted project URL** (our own row only). **No submission on GCR.**

### 1.2 Topic definition (from the Topic Guide, #13)
- **Algorithm:** Pedersen Commitment Scheme with random blinding factors.
- **Objective:** Allow a party to commit to a hidden value while binding themselves to it, with the ability to open and prove the committed value later.
- **Application scenario:** A decentralized rock-paper-scissors tournament script where players submit a **hash commitment of their move in round one** and **reveal the salt and move in round two** to prevent cheating.

> **Note on a wording mismatch (resolve exactly as follows):** The "Algorithm" line says *Pedersen*; the scenario text says *hash commitment + salt*. We satisfy **both**: the **core** commitment is **Pedersen** (with random blinding factor — the "salt" in Pedersen terms). We **also** implement the classic **SHA-256 salted-hash commitment** as a comparison baseline and for the attack demos. The tournament must work end-to-end with Pedersen; the hash mode is selectable for comparison.

### 1.3 Core expectations (all six must be satisfied)

**1. Cryptographic Core & Protocol Implementation**
- Correct, robust implementation of the assigned scheme.
- **Use existing, peer-reviewed cryptographic libraries** (e.g., OpenSSL, PyCryptodome, TenSEAL, Web Crypto API). **Do not write custom primitives from scratch.**
- **Key lifecycle management:** clear strategy for generation, distribution, storage, **revocation**.
- **Explicit threat model:** adversary assumptions, trust boundaries (honest-but-curious vs malicious servers), specific security guarantees.

**2. System Architecture & Data Flow**
- Modular design, clear separation of concerns (client UI, backend services, trusted/untrusted servers, **adversary-simulation modules** where applicable).
- Comprehensive **data-flow diagrams or sequence diagrams** showing plaintext → ciphertext/commitment → back across network boundaries.
- Secure integration: **no side-channel leakage, no improper padding, no insecure RNG**.

**3. Full-Stack Application & Usability**
- A **fully operational end-to-end system with real-world utility — not isolated command-line scripts.**
- **Frontend:** responsive UI built with a modern framework/template that makes the abstract crypto **visible and tangible**.
- **User guidance & onboarding:** tooltips and/or a guided walkthrough so a first-time user can understand and test the workflow.
- **Backend & storage:** robust API handling crypto transformations, **secure session management**, **database/storage persistence**.

**4. Deployment, Connectivity & Source Control**
- **GitHub** repo with **clean commit history** and a **comprehensive README.md**.
- **Live public deployment on free cloud platforms** (Railway, Vercel, Netlify, Render…), accessible during and after class.
- **Functional REST/WebSocket endpoints** between client and server.

**5. Security Evaluation & Analysis**
- **Attack surface mapping** (vulnerabilities, leakage points, protocol flaws).
- **Simulated attacks & countermeasures:** *empirical* demonstration of attacks (timing leaks, brute-force guesses, decryption failures …) **paired with implemented mitigations**.
- **Security vs usability trade-offs:** critical evaluation of how stronger parameters affect latency, bandwidth, UX.

**6. Documentation, Presentation & Defense**
- **Technical documentation (PDF):** architecture, threat models, library choices, implementation hurdles, security analysis — **uploaded to GitHub together with the deployable code.**
- **Presentation (PPTX/PDF):** engaging and visual. **Reading directly from slides is strictly prohibited and heavily penalized.**
- **Live in-class demonstration:** live, **flawless**, of the **deployed** web app with real inputs.
- **Peer interrogation:** mandatory participation in Q&A; **each group must ask targeted technical questions to the group presenting immediately after them.**

---

## 2. HARD CONSTRAINTS & BOUNDARIES (NON-NEGOTIABLE)

### 2.1 MUST NOT
1. **MUST NOT implement cryptographic primitives from scratch.** No hand-written elliptic-curve arithmetic, big-number modular math for curve operations, hash functions, RNGs, or signature algorithms. Use audited libraries only (see 5.2). Composing library primitives into the Pedersen scheme is the assignment; re-implementing the primitives is forbidden.
2. **MUST NOT use insecure randomness** for any secret (blinding factors, nonces, session IDs, tokens). **Forbidden:** `Math.random()`, `random.random()`, time-seeded RNGs, fixed/test seeds in production code paths. **Required:** `crypto.getRandomValues` / Node `crypto.randomBytes` / OS CSPRNG. (Intentionally-insecure code for attack demos must live **only** in the adversary-simulation module, be clearly labelled `INSECURE-DEMO`, and never be reachable from the real game path.)
3. **MUST NOT** deliver only CLI scripts. A deployed, browser-based, end-to-end app is mandatory.
4. **MUST NOT** put secrets in Git (`.env`, private keys, DB URLs, tokens). Provide `.env.example` only. If a secret is ever committed, treat it as leaked and rotate it.
5. **MUST NOT** log moves, blinding factors, private keys, or session tokens on the server.
6. **MUST NOT** transmit a player's plaintext move or blinding factor to the server **before the reveal phase.** (The commitment is computed **in the browser**.)
7. **MUST NOT** use compare operators like `==` for secret/commitment/MAC comparisons on the server — use constant-time comparison (`crypto.timingSafeEqual` or equivalent).
8. **MUST NOT** touch, edit, or script against other groups' rows in the Topic Selection Sheet (2-mark penalty). The student edits **only our own row, manually**.
9. **MUST NOT** plan for a team size other than exactly 3.
10. **MUST NOT** build or encourage anything that requires paid services. Free tiers only.
11. **MUST NOT** hide limitations. The report must honestly state what is out of scope and residual risks.
12. **MUST NOT** copy external projects' code wholesale. Library usage and short cited snippets only; every non-trivial external idea is cited in the report.

### 2.2 MUST
1. Core scheme = **Pedersen commitment** with uniformly random blinding factor, over a standard prime-order elliptic-curve group.
2. Second generator `h` MUST be derived by a **nothing-up-my-sleeve method** (standardized hash-to-curve with a published domain-separation string) so **nobody knows `log_g(h)`**. Using `h = g^x` for a known `x` is forbidden in the real path (it destroys the *binding* property); it may appear **only** in the labelled attack demo.
3. Validate **everything** from the network: points on the curve, not the identity, canonical encoding; scalars in range; moves in the allowed set; message sizes/types (schema validation).
4. Provide **all six** deliverable groups from Section 1.3 and the traceability matrix in Section 11.
5. Include a **guided walkthrough + tooltips** in the UI.
6. Public deployment on a **free** cloud platform, reachable via a URL that will keep working after class.
7. Clean Git history: small, meaningful commits (conventional-commit style), **all 3 members have visible commits**, feature branches + pull requests, comprehensive README.
8. Tests: unit tests for crypto core (including known-answer/negative tests) and API tests; CI (GitHub Actions) that runs them.
9. All claims in the report are backed by **empirical results** from the project (numbers, screenshots, graphs) — not just theory.

### 2.3 Scope boundaries (what we are NOT doing)
- No real money/blockchain. "Decentralized" is satisfied by the **trust model** (the server is a relay/referee that cannot learn or alter committed moves undetected) plus a **publicly verifiable audit log**, not an actual blockchain.
- No claims of formal verification or production-grade security.
- No custom networking protocols beyond REST + WebSocket.

---

## 3. FEATURE PRIORITIES (MoSCoW)

### MUST
- M1 Pedersen commit/open/verify library (`crypto-core`), shared by client and server.
- M2 Salted SHA-256 commitment (baseline) in the same library.
- M3 Browser-side commitment generation; blinding factor kept only in the browser until reveal.
- M4 RPS game flow with **commit phase → reveal phase → verification → result**, for 2 players per match.
- M5 Tournament: register, lobby, bracket (single elimination, 4 or 8 players), multi-round matches, scoreboard.
- M6 Player identity & key lifecycle: signing keys generated in browser, public key registered, **signed commitments**, **revocation**, rotation (see 5.4).
- M7 Backend REST + WebSocket API, validation, secure sessions, DB persistence.
- M8 UI with guided walkthrough and tooltips; "crypto inspector" panel showing commitment, blinding factor (after reveal), verification equation.
- M9 Adversary-simulation module with the attacks in Section 7, each with **before (vulnerable)** and **after (mitigated)** results.
- M10 Benchmarks for the security-vs-usability analysis (Section 8).
- M11 Deployment (frontend + backend + DB) on free tiers, live URL.
- M12 README, PDF technical report, presentation, demo script, Q&A prep.
- M13 GitHub Actions CI, tests.

### SHOULD
- S1 Hash-chained, append-only **public audit log** of tournament events, verifiable by anyone in the UI.
- S2 "Homomorphic property lab": show `C(m1,r1)·C(m2,r2) = C(m1+m2, r1+r2)` live (explains why Pedersen is special).
- S3 Spectator mode (read-only view of the tournament).
- S4 Rate limiting and basic abuse protection (also part of attack-surface mitigation).

### COULD
- C1 Dark mode, i18n.
- C2 Export match transcript as JSON verifiable offline by a small verifier script.

---

## 4. THE CRYPTOGRAPHY — EXACT SPECIFICATION

### 4.1 Pedersen commitment (core)
- **Group:** NIST **P-256** (prime-order group, order `q`, cofactor 1). Base point `g` = the standard generator.
- **Second generator `h`:** `h = HashToCurve(msg = "CS3002-RPS-PEDERSEN-H-v1", DST = "CS3002-RPS-PEDERSEN-v1")` using the **RFC 9380** hash-to-curve (`P256_XMD:SHA-256_SSWU_RO_`) as provided by the chosen library. The seed string and DST are public constants in the repo and in the report. Nobody (including us) knows `x` with `h = x·g`.
- **Message encoding:** Rock = **1**, Paper = **2**, Scissors = **3** (scalars in `Z_q`). *Do not use 0* — many libraries reject multiplication by 0 and the identity point complicates validation.
- **Commit(m):** pick `r` uniformly at random in `[1, q-1]` using CSPRNG (browser: `crypto.getRandomValues`, reduced with rejection sampling or the library's helper to avoid modulo bias). Output `C = m·g + r·h` (a curve point; transmit as 33-byte compressed hex). Keep `(m, r)` secret.
- **Open/Verify(C, m, r):** accept iff `m ∈ {1,2,3}`, `r ∈ [1,q-1]`, `C` is a valid non-identity point, and `m·g + r·h == C` (point equality, performed by the library).
- **Properties to explain & demo:** *perfectly hiding* (for any `C`, every move is equally consistent with some `r`, so even an unbounded adversary learns nothing), *computationally binding* (opening one commitment to two moves would reveal `log_g(h)`, i.e., solve ECDLP), *homomorphic* (additive).

### 4.2 Salted-hash commitment (baseline / comparison)
- `C_hash = SHA-256( domain_tag || playerId || matchId || roundNo || move_byte || salt )` with a **32-byte CSPRNG salt**. `domain_tag` is a fixed string with length-prefixed fields (unambiguous encoding — no naive string concatenation).
- Properties: computationally hiding (if salt is secret/random), computationally binding (collision resistance). Mention **hiding depends on a good salt**.
- The unsalted version `SHA-256(move)` exists **only** inside the attack demo, to demonstrate brute force (only 3 possible moves!).

### 4.3 Context binding (anti-replay / anti-copy)
Pedersen commitments themselves are context-free, so context is bound by **signing**: each player signs the canonical message `(tournamentId, matchId, roundNo, playerId, mode, C)` with their ECDSA P-256 key (Web Crypto API). The server stores `(C, signature)`. The server **rejects**: duplicate `C` within the same match (copy attack), commitments after the commit deadline, a second commitment for the same (match, round, player).

### 4.4 Randomness & constant-time rules
- All secrets from CSPRNG (see 2.1).
- Server-side comparisons of secrets/commitments/tokens: constant-time.
- Verification code must not branch on secret-dependent data in an observable way beyond what the library guarantees; document library guarantees honestly in the report.

---

## 5. ARCHITECTURE & TECHNOLOGY DECISIONS

### 5.1 Recommended stack (decided — use unless a hard blocker appears; if so, explain and get approval)
| Layer | Choice | Reason |
|---|---|---|
| Language | **TypeScript end-to-end** (Node 20 LTS) | One crypto-core shared by browser and server → identical verification. Beginner-friendly tooling. |
| Frontend | **React + Vite + Tailwind CSS**; guided tour with **react-joyride** or **driver.js**; charts with **Recharts** | Modern, responsive, deployable on Vercel/Netlify. |
| Backend | **Fastify** (or Express) + **ws** (WebSocket) + **zod** (validation) + **helmet** + rate-limit plugin | REST + WebSocket required by the brief. |
| Database | **PostgreSQL** (free tier: Neon/Supabase/Render Postgres) via a light ORM/query builder (Drizzle or Prisma). *SQLite is allowed only for local dev* (free hosts have ephemeral disks → data loss). | Persistence required, must survive restarts. |
| Crypto libs | **`@noble/curves`** (P-256 point arithmetic + RFC 9380 hash-to-curve), **`@noble/hashes`** (SHA-256), **Web Crypto API** (ECDSA P-256 signatures, `getRandomValues`) | Peer-reviewed/audited, widely used libraries and the browser's native crypto. *The AI must verify current audit status and cite it in the report.* **Pin exact versions** and check the API against that version's docs (v1 vs v2 module paths differ). |
| Tests | **Vitest** (unit/API), **Playwright** (one end-to-end test) | |
| CI | **GitHub Actions** | |
| Hosting | Frontend: **Vercel** or **Netlify**; Backend: **Render** or **Railway**; DB: **Neon**/**Supabase** | All free tiers. Note cold starts (document them; add a "wake-up" health ping before the demo). |

*Alternative (only if the team strongly prefers Python):* FastAPI + PyCryptodome. But then browser-side commitment needs a JS library anyway, so TypeScript is strongly preferred.

### 5.2 Allowed cryptographic libraries (whitelist)
`@noble/curves`, `@noble/hashes`, Web Crypto API, Node `crypto` (for `randomBytes`, `timingSafeEqual`, HMAC), OpenSSL-backed Node primitives, PyCryptodome (if Python is used). Anything else needs written justification in the report **before** use.

### 5.3 Monorepo layout
```
rps-commitments/
├─ README.md
├─ docs/                      # report (PDF + source), diagrams, threat-model.md, benchmarks, screenshots
├─ packages/
│  ├─ crypto-core/            # Pedersen, hash-commit, encoding, validation  (shared)
│  └─ adversary-sim/          # INSECURE-DEMO attacks + mitigated counterparts
├─ apps/
│  ├─ server/                 # REST + WebSocket, DB, auth, referee logic, audit log
│  └─ web/                    # React UI, guided tour, crypto inspector
├─ .github/workflows/ci.yml
├─ .env.example
└─ scripts/                   # benchmarks, offline transcript verifier
```
Separation of concerns: `crypto-core` has **no** network/DB code; `server` never imports adversary code in production build; `adversary-sim` is invoked only from an explicit "Attack Lab" route/page.

### 5.4 Key lifecycle (required, must be documented in report)
| Stage | What we do |
|---|---|
| **Public parameters (`g`, `h`, curve, DST)** | Generated deterministically (hash-to-curve), committed to the repo, served at `GET /api/params` with a version tag, and **pinned/checked by the client** (client recomputes `h` locally and rejects the server's value if different). |
| **Per-commitment secrets `(m, r)`** | Generated in browser via CSPRNG; held in memory (and optionally in `sessionStorage` for page-refresh safety) **only until reveal**, then wiped. Never sent before reveal. |
| **Player signing key (ECDSA P-256)** | Generated in browser with Web Crypto, **non-extractable**, stored in IndexedDB. Public key registered with the server at signup. |
| **Distribution** | Public keys via API; the audit log makes key registrations publicly visible. |
| **Rotation** | Player can register a new key; old key remains valid only for verifying past signatures. |
| **Revocation** | `POST /api/keys/revoke`: marks key revoked with timestamp; commitments signed after revocation are rejected; past matches remain verifiable. Demonstrate in UI (revoke → try to commit → rejected). |
| **Server secrets** | Session secret/DB URL in environment variables only; rotatable via redeploy. |
| **Sessions** | httpOnly, Secure, SameSite cookies (or short-lived JWT with rotation); logout; server-side expiry. |

---

## 6. THREAT MODEL (the AI must expand this into `docs/threat-model.md`)

### 6.1 Assets
Hidden moves before reveal; integrity of commitments; fairness of results; player identity/keys; audit log integrity; availability (secondary).

### 6.2 Actors and trust
| Actor | Assumption |
|---|---|
| **Player (malicious)** | Wants to change their move after seeing the opponent's reveal, copy/replay the opponent's commitment, or learn the opponent's move early. May be computationally bounded (standard assumption: ECDLP hard on P-256). |
| **Opponent's browser/machine** | Trusted by its owner; we do **not** defend against malware on a player's own device (out of scope). |
| **Server — honest-but-curious** | Follows protocol but inspects everything it receives. Guarantee: **learns nothing** about moves before reveal (Pedersen perfect hiding + moves never sent before reveal). |
| **Server — malicious** | May try to forge/replace commitments, reorder events, withhold messages, or leak early reveals. Guarantees: cannot forge a player's commitment (signatures); cannot alter history undetected (hash-chained audit log + signed commitments). **Cannot guarantee availability.** Residual risk: a malicious server could collude with one player by revealing the opponent's opening early — mitigated by the **reveal barrier** and made detectable by the audit log, but **not fully preventable**; state this honestly. |
| **Network attacker** | Controlled by TLS; replay prevented by context binding and nonces. |
| **Public observer** | Can verify every opening against the public log. |

### 6.3 Security guarantees we claim (and test)
G1 **Hiding:** before reveal, no adversary (even unbounded, for Pedersen) learns the move from `C`.
G2 **Binding:** a player cannot open `C` to a different move except by breaking ECDLP on P-256 (Pedersen) / SHA-256 collision resistance (hash mode).
G3 **Non-copying:** an identical commitment cannot be re-used by the opponent in the same match.
G4 **Non-repudiation:** a commitment is attributable to the player's registered key.
G5 **Fair reveal ordering:** neither player sees the other's opening before both have opened or the deadline has passed; non-revealing = forfeit.
G6 **Verifiability:** anyone can re-verify results from the audit log.

### 6.4 Attack-surface map (must be a table in the report)
Entry points: REST endpoints, WebSocket messages, session cookies, DB, client storage (IndexedDB/sessionStorage), params endpoint, third-party dependencies/supply chain, deployment config/env vars. For each: threat, impact, mitigation, test.

---

## 7. ATTACK SIMULATIONS (adversary-sim module) — EMPIRICAL, WITH FIXES

Each attack = a button/page in the "Attack Lab" + automated script + recorded result (table/graph/screenshot) for the report. Show **vulnerable → exploited → patched → attack fails**.

| # | Attack | Vulnerable version | Result to show | Mitigation (implemented) |
|---|---|---|---|---|
| A1 | **Brute-force an unsalted hash commitment** | `SHA-256(move)` | Recover the move in microseconds (3 candidates) | Salted hash (32-byte CSPRNG salt) / Pedersen with random `r` → brute force fails; show search space 2^256 / perfect hiding |
| A2 | **Weak-RNG blinding factor** | `r` from a predictable PRNG (INSECURE-DEMO) | Attacker predicts `r`, recovers move | CSPRNG only; add a unit test that fails the build if `Math.random` appears in crypto paths (lint rule/grep in CI) |
| A3 | **Trapdoor generator (known `log_g h`)** | `h = x·g` with known `x` | Cheater opens one commitment to *two* different moves (binding broken) | `h` derived by hash-to-curve; client recomputes and pins `h`; reject server-supplied different `h` |
| A4 | **Change-of-move after seeing opponent** | Naive game without binding check | Cheater switches move | Verification `m·g + r·h == C` + signature; show failed opening → forfeit |
| A5 | **Commitment copy/replay** | Server accepts duplicate `C` | Attacker copies opponent's commitment and mirrors later (draw/win games) | Reject duplicate `C` per match; context-bound signatures; nonces |
| A6 | **Timing leak in verification/compare** | Early-exit `==` compare of tags/tokens | Measured latency differences leak matching-prefix length | `timingSafeEqual`; re-measure → no statistically significant difference (report mean/σ and a simple statistical test) |
| A7 | **Invalid-point / malformed-input attacks** | No validation | Server crash or accepting off-curve/identity points | Strict validation; fuzz tests |
| A8 | **Withholding / late reveal (abort) attack** | No deadline | Player aborts after seeing they lose | Reveal barrier + timeout forfeit |
| A9 | **Replay of old signed commitment** | No context in signature | Old commitment reused in a new round | Signature covers `(tournamentId, matchId, roundNo, playerId, C)` |
| A10 | **Audit-log tampering** (SHOULD) | Plain log | Silent edit of a past result | Hash-chained log; verifier detects tampering |

Every attack MUST have: code, an automated test that asserts it **succeeds on the vulnerable version and fails on the patched version**, and a paragraph in the report.

---

## 8. SECURITY vs USABILITY TRADE-OFF EVALUATION (benchmarks — M10)

Produce a reproducible script (`scripts/bench`) and charts for:
1. **Latency:** commit, open, verify time — Pedersen (P-256) vs salted SHA-256, in Node and in the browser; p50/p95 over ≥ 1000 runs. If feasible, also compare P-256 vs a larger curve (e.g., P-384/P-521 if the library supports hash-to-curve for it) to show "stronger parameters cost more".
2. **Bandwidth/size:** bytes on the wire per commitment (33 B compressed point vs 32 B hash) + signature size + opening size (`m` + 32 B `r`).
3. **End-to-end UX:** time from click to "committed" and to "verified" on the deployed app (including network), and effect of cold start on the free tier.
4. **Security-parameter table:** hiding/binding type, assumptions, security level (bits), cost.
5. **Written critical evaluation:** where extra security hurts UX (e.g., signature prompts, reveal deadlines, key-loss recovery) and the design decisions made.

---

## 9. IMPLEMENTATION PLAN (PHASES, IN STRICT ORDER)

> Team of 3 → suggested roles (adjust, but **every member must write code, commits, and be able to answer questions on all parts**): **Member A — crypto-core + adversary-sim + benchmarks; Member B — backend, DB, deployment, CI; Member C — frontend, guided tour, report/presentation.** The deadline is unknown: ask the student for it in Phase 0 and scale the plan backwards; never skip a MUST.

### Phase 0 — Setup & alignment
- Confirm: 3 members' names/roll numbers (our row currently shows `i242095`, `24k-2011` → third member needed), deadline, section, OS.
- **Manual (student, done BEFORE Stage 1 using the Stage-0 guide):** create the public GitHub repo, add the 3 members as collaborators, clone it, install Node 20 LTS/Git/pnpm, place this document at `docs/MASTER_INSTRUCTIONS.md` and the `AGENTS.md` file in the repo root.
- **You (agent):** verify the toolchain versions, add `.gitignore` and `.env.example`, create the monorepo skeleton (5.3), README stub, `docs/` folder, `docs/TEAM.md`, MoSCoW checklist file (`docs/PROGRESS.md`).
- **Gate 0:** `pnpm install` + `pnpm test` run (even if empty); skeleton committed on the stage branch; student has cloned the repo on their machine.

### Phase 1 — Crypto core (M1, M2)
- Pin library versions. Implement in `packages/crypto-core`: constants, `deriveH()`, `commitPedersen()`, `verifyPedersen()`, `commitHash()`, `verifyHash()`, canonical encodings, validators, constant-time compare helper.
- Unit tests: correctness; wrong move fails; wrong `r` fails; off-curve/identity/invalid scalar rejected; determinism of `h`; homomorphic property; hash-commit domain separation; known-answer vector stored in repo.
- **Gate 1:** all tests green; student can explain `C = m·g + r·h` and why `h` must have unknown dlog.

### Phase 2 — Backend core (M7)
- DB schema: users, public_keys (with revoked_at), tournaments, matches, rounds, commitments, reveals, audit_log (prev_hash, hash).
- REST: `GET /api/params`, `POST /api/register`, `POST /api/login`, `POST /api/keys/register|revoke`, tournament/match CRUD, `POST /api/commit`, `POST /api/reveal`, `GET /api/audit`. WebSocket channel for live match/tournament events.
- Zod validation on every input; helmet; rate limiting; secure session cookies; constant-time comparisons; no secret logging.
- Referee state machine: `WAITING → COMMIT → REVEAL (barrier) → RESOLVED`, with deadlines and forfeits.
- API tests (Vitest + supertest or similar).
- **Gate 2:** two scripted clients can play a full match through the API; invalid inputs are rejected; tests green.

### Phase 3 — Frontend (M3, M4, M5, M8)
- Pages: Landing/How-it-works, Register/Login (key generation), Lobby, Tournament bracket, Match (commit → wait → reveal → result), Crypto Inspector, Audit Log viewer, Attack Lab (placeholder), Benchmarks (placeholder).
- Browser-side commitment; blinding factor never leaves the browser before reveal; signing via Web Crypto; local verification of the opponent's opening and of `h`.
- **Responsive** layout (mobile + desktop), accessible labels, loading/error states.
- **Guided walkthrough (react-joyride/driver.js) + tooltips** on every crypto term (commitment, blinding factor, hiding, binding, reveal).
- **Gate 3:** two different browsers/profiles can complete a full tournament locally; tour runs for a first-time user; works at 375 px width.

### Phase 4 — Key lifecycle features (M6)
- Key generation, registration, rotation, revocation flows + UI; audit-log entries for each.
- **Gate 4:** revoked key cannot commit; rotation works; documented in README.

### Phase 5 — Adversary simulation (M9)
- Implement A1–A9 (A10 if S1 done) with vulnerable and patched variants, automated tests asserting both outcomes, and an Attack Lab UI showing live before/after. Keep INSECURE-DEMO code isolated and labelled.
- Save raw results (JSON/CSV) and screenshots into `docs/results/`.
- **Gate 5:** every attack has a test that passes (attack works on vulnerable, fails on patched).

### Phase 6 — Audit log & extras (S1, S2, S3, S4)
- Hash-chained audit log + in-browser verifier; homomorphic lab; spectator mode; rate limiting verification. Cut these first if time is short.
- **Gate 6:** tampering a log row in a test DB is detected by the verifier.

### Phase 7 — Benchmarks & trade-off analysis (M10)
- Implement scripts/benchmarks/charts as in Section 8; export data + figures for the report.
- **Gate 7:** reproducible `pnpm bench` output; charts saved.

### Phase 8 — Deployment & CI (M11, M13)
- GitHub Actions: lint, type-check, tests on every PR.
- Deploy DB (Neon/Supabase), backend (Render/Railway), frontend (Vercel/Netlify); set env vars in the host dashboards (never in Git); configure CORS to the frontend origin; HTTPS only; health endpoint; seed script for a demo tournament.
- Test the live URL from a different device/network. Document cold-start behaviour.
- **Gate 8:** public URL works end-to-end for 4 players on different devices; CI green.

### Phase 9 — Documentation (M12)
- **README.md:** what/why, architecture diagram, live URL, quickstart, env vars, how to run tests/benchmarks, security notes, limitations, team & roles, license.
- **Technical report (PDF, committed to GitHub under `docs/`):** see 10.1.
- **Diagrams (Mermaid/draw.io, committed as source + PNG):** (1) system architecture & trust boundaries; (2) **sequence diagram** of the full commit → reveal → verify flow; (3) **data-flow diagram** showing plaintext move → commitment → network → server → public log → verification; (4) key-lifecycle diagram; (5) referee state machine.
- **Gate 9:** a fresh teammate can clone and run following only the README.

### Phase 10 — Presentation, demo & defense prep (M12)
- Slide deck (PPTX/PDF), **visual, minimal text** — reading slides is penalized; use speaker notes as bullet cues, not scripts.
- Demo script (10.3), rehearsal ×3, fallback plan (recorded video/screenshots + seeded tournament) in case of network failure, pre-warm the free-tier servers 10 minutes before the slot.
- Q&A prep (10.4), including **targeted technical questions for the next presenting group** (mandatory).
- **Final Gate:** Section 12 checklist fully ticked.

---

## 10. DELIVERABLE SPECIFICATIONS

### 10.1 Technical report (PDF) — required sections
1. Abstract & problem statement  2. Background (commitment schemes; hiding/binding; Pedersen math)  3. Threat model (Section 6, expanded)  4. System architecture & diagrams  5. Cryptographic design (parameters, `h` derivation, encodings, signatures)  6. Library choices & justification (+ audit/maintenance status, pinned versions)  7. Key lifecycle management  8. Implementation (modules, API reference, state machine) incl. **hurdles encountered**  9. Security evaluation: attack-surface map, attacks A1–A10 with empirical evidence and mitigations  10. Security vs usability trade-offs (Section 8 results)  11. Testing & CI  12. Deployment  13. Limitations & future work  14. Team contributions (per member)  15. References.

### 10.2 Presentation (suggested 10–12 slides)
Problem (cheating in simultaneous games) → commitment idea in one picture → Pedersen math, one slide → architecture & trust boundaries → live demo → attacks & fixes (before/after numbers) → trade-offs graph → lessons/limits. Max ~25 words per slide; diagrams over text.

### 10.3 Live demo script (≈5–6 min, flawless)
1. Open deployed URL; quick guided tour highlight. 2. Two players (two browser windows) join a tournament. 3. Commit phase: show commitment hex in Crypto Inspector; show server only sees `C`. 4. Reveal and verification equation turning green. 5. Cheating attempt (change move) → rejected. 6. One Attack Lab attack: A1 brute force vs patched. 7. Revoke a key → rejected commit. 8. Audit log verification. Always keep a seeded fallback tournament ready.

### 10.4 Q&A preparation
Prepare short, correct answers (each member can answer any) for: Why is Pedersen perfectly hiding but only computationally binding? What if `log_g(h)` is known? Why not just use SHA-256? Why P-256? Why are moves 1–3, not 0–2? Modulo bias? What does the server learn? Can a malicious server cheat? What if a player never reveals? How do you prevent commitment copying? Which parts did you NOT implement yourselves and why? Plus **2–3 targeted technical questions** prepared for the group presenting after us (written after seeing their topic).

---

## 11. TRACEABILITY MATRIX (requirement → where satisfied)

| Course requirement | Where satisfied |
|---|---|
| Correct primitive implementation | Phase 1, Section 4 |
| Use peer-reviewed libraries, no custom primitives | 2.1 #1, 5.1–5.2 |
| Key lifecycle (gen/dist/storage/revocation) | 5.4, Phase 4 |
| Explicit threat model | Section 6, `docs/threat-model.md` |
| Modular design, adversary-sim module | 5.3, Phase 5 |
| DFD / sequence diagrams | Phase 9 diagrams |
| No side-channel / bad padding / insecure RNG | 2.1 #2 #7, 4.4, A2, A6 |
| Functional full-stack prototype (not CLI) | Phases 2–3, 2.1 #3 |
| Responsive modern UI making crypto visible | Phase 3 (Crypto Inspector) |
| Tooltips / guided walkthrough | Phase 3 |
| Backend API, secure sessions, persistence | Phase 2, 5.4 |
| GitHub, clean commits, README | Phase 0, 9, 2.2 #7 |
| Free live hosting | Phase 8 |
| REST/WebSocket endpoints | Phase 2 |
| Attack surface mapping | 6.4 |
| Simulated attacks + countermeasures | Section 7, Phase 5 |
| Security vs usability trade-offs | Section 8, Phase 7 |
| Update sheet with GitHub + hosted URL (own row only) | Final checklist |
| PDF report uploaded to GitHub with code | 10.1, Phase 9 |
| PPTX/PDF presentation, no slide-reading | 10.2, Phase 10 |
| Live flawless demo | 10.3 |
| Peer interrogation questions | 10.4, Phase 10 |
| Group of exactly 3 | 2.1 #9, Phase 0 |

---

## 12. FINAL ACCEPTANCE CHECKLIST (all must be true)

- [ ] Exactly 3 team members, all with commits and PRs; Topic Selection Sheet row lists all 3.
- [ ] Pedersen commit/open/verify implemented via audited libraries; `h` via hash-to-curve; salted-hash baseline present.
- [ ] No custom primitives; no insecure RNG in real path (CI check passes).
- [ ] Commitment computed in browser; `(m, r)` never sent before reveal; server never logs secrets.
- [ ] Full tournament works end-to-end on the **deployed** URL with 4+ players on different devices.
- [ ] Signed commitments, key registration, rotation, **revocation** work and are demoed.
- [ ] Reveal barrier + timeout forfeit work.
- [ ] Guided walkthrough + tooltips present; UI responsive down to 375 px.
- [ ] Attacks A1–A9 demoed with vulnerable vs patched results and automated tests.
- [ ] Benchmarks + trade-off analysis done with real numbers.
- [ ] Tests + CI green; README comprehensive; clean commit history; no secrets in repo.
- [ ] Threat model, attack-surface map, 5 required diagrams, PDF report **committed to GitHub**.
- [ ] Presentation (PPTX/PDF) ready, low-text; demo rehearsed ×3 with fallback.
- [ ] Q&A prep done; targeted questions for the next group prepared.
- [ ] **Own row only** in the Topic Selection Sheet updated with GitHub link + live URL (done manually by the student). No GCR submission.

---

## 13. FIRST MESSAGE YOU (THE AI) SHOULD SEND (Stage 1 only; later stages just confirm the stage and start)

1. Confirm in 5 lines that you understood the project (topic, Pedersen core, RPS commit-reveal tournament, deployment, deliverables, exactly-3 team).
2. Ask these questions **in one message** (and then wait): (a) names/roll numbers of all 3 members (third member?), (b) deadline and presentation date, (c) OS (Windows/Mac/Linux) and whether Node 20 and Git are installed, (d) how many hours per week each member can work.
3. Then begin the current stage per Section 0.4 (autonomy mode). Use the step template in 0.2 only when explaining something to the student or when running as a plain chat AI without file/shell access.
