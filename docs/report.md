# Cryptographic Commitments for Fair Rock–Paper–Scissors

**CS-3002 Information Security · Topic 13 · Technical report**  
**Repository:** https://github.com/Zubair378/rps-commitments  
**Team:** Noor Fatima (24i-2012), Muhammad Zubair (24i-2095), Hamayun (24k-2011)

**Live URL:** https://rps-commitments.vercel.app/ (see deployment verification below)

## Abstract and problem statement

In an ordinary online rock–paper–scissors game, the second player to reveal can choose a winning move. This project implements a browser tournament in which players first publish cryptographic commitments, then reveal moves and random opening values. The referee accepts both commitments before entering the reveal phase. Each opening and the original context-bound signature is independently checked in the browser. A 4- or 8-player single-elimination bracket and best-of-three matches make the protocol usable in a classroom demonstration. The project compares Pedersen commitments on P-256 with a salted SHA-256 baseline, tests ten attacks against deliberately weak examples and real defenses, and records reproducible latency data. It also states the remaining trust in the server and deployment platform.

## 1. Background

A commitment has two main properties. **Hiding** prevents an observer from learning the chosen message before opening. **Binding** prevents the committer from opening one commitment to a different message. Pedersen's construction is `C = m·g + r·h` in the P-256 group, where `m ∈ {1,2,3}` represents rock, paper, or scissors and `r` is a uniformly sampled scalar. If `r` is uniform across the full scalar field, the distribution of `C` is independent of `m`: hiding is perfect. Binding is computational when nobody knows the discrete logarithm between the independent generators `g` and `h`. A salted hash commitment encodes domain, player, match, round, move, and 32-byte salt into SHA-256. Its hiding depends on the salt remaining unpredictable, and its binding depends on hash resistance.

The protocol uses the established P-256 group implementation and Web Crypto signatures. It does not implement curve arithmetic, SHA-256, or ECDSA itself. `h` is derived by RFC 9380 hash-to-curve from a fixed project seed and domain separation tag, then pinned to a compressed point. The browser recomputes and checks those parameters before making a commitment. The full scalar field includes zero; excluding it would make the hiding claim only approximate. Identity commitments are resampled or rejected.

## 2. Threat model

An opponent may guess a move, copy a point, replay a signature, submit malformed data, withhold a reveal, or try to open to a different move. A network observer sees HTTPS traffic but should not see plaintext moves before reveal. The server controls state and deadlines; a malicious operator can see a received opening before the second opening and can rewrite its own database. Browser storage and the device are trusted for local secrets. A compromised browser extension or device can read the move and initiate actions on the player's behalf. The full [attack-surface map](threat-model.md) covers REST, WebSocket, cookies, database, local storage, parameter exchange, dependencies, and hosting configuration.

## 3. System architecture and data flow

![Architecture and trust boundaries](diagrams/architecture.png)

The React client generates keys, computes commitments, signs context, stores openings, and re-verifies public transcripts. Fastify manages sessions, tournament brackets, deadlines, signed commitments, reveals, results, WebSocket notifications, and the audit chain. SQLite is used locally; production requires persistent PostgreSQL. Vercel serves the frontend and proxies API requests to the Render backend, allowing same-origin session cookies. A spectator can read a match and public evidence without possessing either player's private key.

![Commit–reveal–verify sequence](diagrams/sequence.png)

![Plaintext-to-proof data flow](diagrams/data-flow.png)

Before the reveal barrier, the `POST /api/commit` body contains the compressed point or hash, mode, key ID, and ECDSA signature. The move and opening value are in the player's tab session storage. After both commitments are accepted, `POST /api/reveal` sends the move and opening value. The server verifies and eventually publishes both openings. A Playwright test inspected the actual commit request and asserted that it contained neither `move` nor `blindingFactor`.

## 4. Cryptographic design and encodings

P-256 points are encoded canonically as 33-byte compressed hex. Scalars and salts are exactly 32 bytes of lowercase hex; scalars at or above the curve order are rejected. Moves are integers 1, 2, and 3. A rejection sampler draws 32 random bytes from `crypto.getRandomValues` until they are below the group order, avoiding modulo bias. SHA-256 commitment inputs use length-prefixed fields and a round number in four-byte big-endian format, with a project domain string to prevent cross-protocol reuse. ECDSA P-256 with SHA-256 signs a canonical message containing tournament ID, match ID, round number, player ID, commitment mode, and commitment. The server verifies the signature against the registered public JWK and rejects revoked keys. Constant-time comparison is used for fixed-length secret/token checks on the server.

For a valid reveal, the browser recomputes `m·g + r·h` or the salted digest and verifies the signature using the stored public key. It does not treat a server-reported `valid` flag as sufficient evidence. A public key remains readable after revocation so a historical signature can still be checked. The audit chain hashes previous hash, sequence number, event type, event JSON, and timestamp, beginning from 64 zero hex characters.

## 5. Library choices and maintenance

`@noble/curves` 2.4.0 and `@noble/hashes` 2.4.0 provide the group, hash-to-curve, SHA-256, canonical point decoding, and byte helpers. Web Crypto supplies non-extractable ECDSA keys and cryptographic randomness in the browser. Fastify 5, Zod 4, Kysely, PostgreSQL/SQLite drivers, React 19, Vite 8, Vitest 3, and Playwright 1.65 provide the application and test layers. Versions are pinned or recorded in `pnpm-lock.yaml`; CI installs with `--frozen-lockfile`. Dependencies must still be reviewed and updated as security advisories appear. No audit of these third-party libraries was performed by the team.

## 6. Key lifecycle

![Key lifecycle](diagrams/key-lifecycle.png)

At registration, the browser creates a non-extractable P-256 ECDSA private key in IndexedDB and uploads only the public JWK. Rotation creates a new key, registers it, and revokes the old key in one database transaction. Revocation prevents new commitments while preserving historical verification. A login on a new device generates a new local key. A lost private key cannot be recovered, and a lost tab opening can cause a round forfeit; the UI warns when it cannot find an opening for a committed round.

## 7. Implementation, API, and state machine

`packages/crypto-core` contains the protocol and audit verifier. `apps/server` contains the Fastify referee, database migrations, and tests. `apps/web` contains the player, spectator, keys, audit, attack, and benchmark pages. `packages/adversary-sim` contains only `INSECURE-DEMO` examples and is not imported by production server code. `scripts/` contains smoke, attack, benchmark, plotting, and seed tools.

Important routes are `GET /api/params`, `POST /api/register|login|logout`, `POST /api/keys/register|rotate|revoke`, `GET /api/keys/:id`, `POST/GET /api/tournaments`, `POST /api/tournaments/:id/join`, `GET /api/matches/:id`, `POST /api/commit`, `POST /api/reveal`, `GET /api/audit`, and `GET /ws/matches/:id`. Inputs are schema validated. Sessions use random tokens stored only as SHA-256 hashes, expire after one hour, and are revoked on logout.

![Referee state machine](diagrams/referee-state.png)

The referee pairs players, accepts at most one distinct signed commitment per player and match round, opens reveal only after both commitments, resolves on two openings or deadline, and advances a winner. Ties create another round. Four- and eight-player tournaments use best-of-three matches; a two-player tournament uses one round. A forfeiture can resolve a match early. A hurdle was preserving the exact perfect-hiding statement: the staged guide suggested excluding zero from the scalar sample range, which would slightly bias the distribution. The implementation includes zero and documents this choice. Another hurdle was browser key persistence: a lost HTTP response after a successful commit must not destroy the opening, so the UI stores it before sending the request.

## 8. Security evaluation

Ten controlled demonstrations each assert that a deliberately vulnerable example is exploitable and the corresponding protected path blocks the attempt. `pnpm attacks` writes [raw results](results/attacks.json); `pnpm test` checks both outcomes. The [attack notes](attacks.md) contain individual explanations and caveats.

| Attack                       | Weak result                              | Protected result                               |
| ---------------------------- | ---------------------------------------- | ---------------------------------------------- |
| A1 Unsalted three-move hash  | Recovered move in 3 guesses              | Unknown 256-bit salt defeats those guesses     |
| A2 Predictable random factor | Recovered move from known PRNG seed      | Cryptographic random factor defeats prediction |
| A3 Known `log_g h`           | Forged second opening                    | Pinned hash-to-curve generator rejects it      |
| A4 Changed move              | Naive referee accepts                    | Opening verification rejects                   |
| A5 Copied commitment         | Naive referee accepts                    | Duplicate and identity checks reject           |
| A6 Early-exit comparison     | Prefix-dependent work and timing         | Constant-work comparison / `timingSafeEqual`   |
| A7 Invalid point             | Length-only parser accepts               | Canonical point parser rejects                 |
| A8 Late reveal               | No-deadline referee accepts              | Deadline rule rejects and can forfeit          |
| A9 Signature replay          | `C`-only signature verifies in new round | Context-bound signature fails                  |
| A10 Edited audit event       | Plain log displays edit                  | Browser detects broken chain                   |

The timing study measured 2,000 batches per condition. An early-exit comparator averaged 6.1 ns for a first-byte mismatch and 194.7 ns for a last-byte mismatch (Welch p ≈ 3.1×10⁻²⁴⁰). Node `timingSafeEqual` averaged 256.6 ns and 261.8 ns (p ≈ 0.605). The local result does not prove a whole network path constant-time or demonstrate a remote exploit. Hash-chain verification detects partial edits; a server operator who rewrites the entire chain can avoid detection until external anchoring exists.

![Comparison timing study](results/figures/timing.png)

## 9. Security versus usability

[Node and browser benchmarks](benchmarks.md) record 1,000 samples per operation and mode. Node median Pedersen commit and verify were 13.1205 ms and 12.6732 ms; salted SHA-256 was 0.0337 ms and 0.0143 ms. Chromium medians were 2.8000 ms and 2.7000 ms for Pedersen, versus 0.0280 ms and 0.0220 ms for salted SHA-256. These are one machine's measurements and are not comparable across environments. Pedersen's 33-byte point is only one byte larger than SHA-256's 32-byte digest. Both send a 64-byte raw ECDSA signature and later a move plus 32-byte opening value, before JSON overhead. Pedersen gives perfect hiding under uniform `r`, while salted hashing is far faster but requires an unpredictable salt. Signing keys and deadlines add user steps; the guided tour, progress states, and key page explain them.

![Commit and verify latency](results/figures/latency.png)

In a local two-browser test, one click-to-committed path took 775 ms and the second reveal-to-both-verified path took 1,458 ms. These include local network, server, UI polling, and cryptographic work, so they are not pure crypto measurements. Cloud latency and cold starts have not been measured.

## 10. Testing and CI

Vitest covers nine crypto properties and vectors, ten attack scenarios, and eight backend tournament/API cases (27 tests total). Playwright covers two independent browser profiles completing a match, a 375px layout check, and the Attack Lab; a separate browser benchmark test records raw samples. CI runs lint, TypeScript checking, unit/API tests, formatting, an insecure-RNG scan, production build, and Chromium E2E on each PR. Tests reject malformed points and scalars, wrong openings, unsigned/copy/replay/revoked commitments, and missed deadlines. Screenshots are committed under `docs/results/ui/`.

## 11. Deployment

`render.yaml` prepares one free Render service using Node 20.20.2, a production build of the React client, Fastify static serving on the same origin, a PostgreSQL `DATABASE_URL`, and `/health`. A local production-style smoke test returned 200 for `/health`, `/`, a deep client route, and `/api/params`. [Deployment instructions](deployment.md) explain how to connect a persistent Neon database and verify the public URL. The public Vercel URL and Render API were reachable in browser tests. The database provider has not been independently inspected. An older completed tournament remained available after a backend redeployment, as described below; no systematic cloud cold-start measurement has been recorded. Render's free web service can spin down after inactivity; its local filesystem is ephemeral and unsuitable for the database.

## 12. Limitations and future work

The server sees an opening when the first player submits it and could leak it before the second reveal. A malicious server can manipulate deadlines or rewrite the entire audit chain; an external timestamped checkpoint or multi-party witness would improve accountability. Cryptographic proofs do not prevent a compromised browser or stolen session from acting as the player. The local E2E test covers a complete two-player match and the API test covers a four-player bracket; a public four-device tournament must be tested after deployment. Future work includes external audit anchoring, device-to-device key recovery, offline transcript export, and independent security review.

## 13. Team contributions

The team comprises Noor Fatima (24i-2012), Muhammad Zubair (24i-2095), and Hamayun (24k-2011). Each member should be prepared to explain the design and defend the work. Individual contributions and GitHub usernames still require confirmation; Git history attributes commits to the account that performed them. No work is attributed to another member without evidence.

## 14. References

1. RFC 9380, _Hashing to Elliptic Curves_: https://www.rfc-editor.org/rfc/rfc9380
2. NIST FIPS 186-5, _Digital Signature Standard_: https://csrc.nist.gov/pubs/fips/186-5/final
3. NIST FIPS 180-4, _Secure Hash Standard_: https://csrc.nist.gov/pubs/fips/180-4/upd1/final
4. `@noble/curves` project documentation: https://github.com/paulmillr/noble-curves
5. Web Crypto API specification: https://www.w3.org/TR/WebCryptoAPI/
6. Render Blueprint specification: https://render.com/docs/blueprint-spec
7. Render free service limitations: https://render.com/docs/free
8. Vercel external rewrites: https://vercel.com/docs/routing/rewrites

## Deployment verification update (17 November 2026)

The public Vercel home, health, and parameters endpoints returned HTTP 200. A two-browser deployed match verified both openings and the correct winner; registration, session refresh, key rotation and revocation also worked. A separate four-player API test completed two semifinals and a final with the correct champion. The public audit chain verified in the browser. At that stage, a separate-device browser test and persistence check were still outstanding. At that time the Vercel WebSocket endpoint failed to connect while direct Render WebSocket opened; the deployed browser match progressed using polling.

A further four-profile browser attempt reached a semifinal, then encountered an HTTP rate-limit error during a reveal after substantial test traffic. The server currently applies a global limit of 100 requests per minute. The precise effect of proxying and shared networks needs investigation and a repeat test before the multi-device demo; the rate limit should not simply be disabled.

A subsequent local fix configures the Vercel build to connect match WebSockets directly to Render via `VITE_WS_ORIGIN` while leaving API traffic on the Vercel origin. The local end-to-end match received a WebSocket notification, and a production-configured local build opened the Render socket. The change was later merged and deployed; a subsequent live two-browser test received a match notification over the Render WebSocket.

## Classroom tournament test and screenshots (27 November 2026)

Four separate player accounts joined a tournament. In the first semifinal, Amna beat Zubair 2–0; the screenshot shows the second-round openings for both players verified in the browser. The page also displayed a rate-limit error, so this is evidence of that verified round, not evidence that the entire four-player tournament passed without interruption.

![Amna wins the semifinal; both openings are verified.](results/user-tournament/verified-semifinal.png)

The second semifinal recorded AbdulMoiz as winner. The displayed round had no openings and both entries were unverified. That result cannot be presented as proof that both players successfully opened their commitments. A timeout is a possible explanation, but the screenshot alone does not establish the exact cause.

![Second semifinal result, showing missing openings and unverified status.](results/user-tournament/unverified-semifinal.png)

The public audit page verified 215 linked events in the user's browser. A complete server-side rewrite remains possible without an external checkpoint.

![The browser verifies the audit hash chain.](results/user-tournament/audit.png)

Multiple players encountered request-rate errors during the live tournament. The subsequent update reduces match polling from 3 to 10 seconds, increases the general request budget from 100 to 600 per minute, keeps a separate 30-per-minute limit for each login and registration route, and increases the commit/reveal deadline from 2 to 10 minutes. This is a trade-off: longer deadlines give players more time but also lengthen potential waiting for a non-responsive player; the larger shared budget needs monitoring. The update passed local tests and was deployed to both frontend and backend. A subsequent four-profile live tournament completed without an observed rate-limit error; broader load and separate-device testing remain useful.

![A rate-limit error during the tournament.](results/user-tournament/rate-limit.png)

The live two-player browser match on 25 November verified both openings and received a match update over the direct Render WebSocket. A later four-profile live test and a post-redeploy persistence check are described below; testing on separate physical devices remains to be completed. The team members and roll numbers are recorded; their individual contributions still need confirmation before submission.

## Student screenshots: application walkthrough

The screenshots below were captured by the student during testing. They illustrate the interface and should be read alongside the measured results and limitations above. A screen showing a feature does not by itself establish a completed four-device test.

### Homepage and player access

![Homepage explaining fair play.](results/student-screenshots/01-homepage.png)

![Player sign-in and account creation.](results/student-screenshots/02-sign-in.png)

### Tournament and match workflow

![Tournament lobby and available matches.](results/student-screenshots/03-tournament-lobby.png)

![A tournament bracket and player information.](results/student-screenshots/04-tournament-bracket.png)

![Match interface and the public verification section.](results/student-screenshots/05-match-result.png)

### Security evaluation and evidence

![Attack Lab experiments.](results/student-screenshots/06-attack-lab.png)

![Benchmark measurements.](results/student-screenshots/07-benchmarks.png)

![Signing-key management and revocation status.](results/student-screenshots/08-keys.png)

![Audit log and browser integrity verification.](results/student-screenshots/09-audit-log.png)

## Latest four-profile retest (27 November 2026)

A fresh live test registered four independent browser profiles on one computer and created a four-player bracket. The test advanced into the next round but did not finish: one client did not reach the reveal control before the 30-second test timeout. This is not a complete tournament pass. The Render backend was still serving the old two-minute deadline during this check; a redeployment of the updated backend and a repeated test are required. Browser profiles on one computer do not replace a physical multi-device demonstration.

## Local four-profile tournament after the timing change

On 27 November 2026, the updated application was run locally with four independent browser profiles and an isolated SQLite database. Both best-of-three semifinals and the final completed; the browser verified both openings at the end of each match and the tournament reached COMPLETE. This is a local single-computer test of the updated code, not evidence that the Render backend has been updated or that four physical devices have passed.

![Completed four-player bracket in the local test.](results/student-screenshots/13-local-complete-bracket.png)

## Live four-player retest and persistence check (27 November 2026)

After the updated backend was deployed to Render, a new four-player tournament was tested on the public Vercel URL using four isolated browser profiles on one computer. The commit deadline was measured at 600 seconds. Both best-of-three semifinals and the final completed; both final-round openings in each match were verified in the browser, and the bracket reached COMPLETE with the expected champion. No rate-limit error was observed in this test. A single four-profile run cannot establish behavior under all traffic or replace a test on separate physical devices.

![The live final result, with both openings verified.](results/student-screenshots/20-final-verified.png)

![Completed live tournament bracket, showing four players and resolved matches.](results/student-screenshots/21-live-complete-bracket.png)

A completed four-player test tournament created before this backend redeploy, `e3a52fe8-f493-452a-a6e3-4c0fed6a4fc4`, remained accessible afterwards with four participants, three matches, and a final winner. This supports persistence across this redeployment; it does not independently identify the database provider or prove future durability.

![Earlier tournament remains available after the Render redeploy.](results/student-screenshots/22-data-after-redeploy.png)

The live test created four accounts and a completed tournament in the project database. The team still needs to confirm its actual individual contributions, rehearse the demonstration, and verify any course-specific file naming instructions.
