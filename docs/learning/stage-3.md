# Stage 3: attacks, audit, and measurements

The Attack Lab compares deliberately weak examples with protected versions. `packages/adversary-sim` isolates the unsafe code; it is never imported by the production server. `pnpm attacks` saves results and `pnpm test` checks the demonstrations.

| Attack                            | Why the defense matters                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| A1: guess an unsalted hash        | A random salt prevents guessing from only three hash values.                   |
| A2: predictable randomness        | A cryptographic random generator prevents predicting the opening.              |
| A3: known relation between points | Public hash-to-curve derivation avoids a deliberately chosen known relation.   |
| A4: change a revealed move        | Verification rejects an opening that does not match the commitment.            |
| A5: copy a commitment             | The referee rejects duplicate points and signatures bind the player.           |
| A6: early-exit comparison         | Fixed-length secret comparisons use Node's timing-safe function.               |
| A7: invalid curve point           | Strict parsing rejects malformed and noncanonical points.                      |
| A8: withhold or reveal late       | Deadlines reject late actions and allow forfeits.                              |
| A9: replay a signature            | Signed context includes the tournament, match, round, player, and mode.        |
| A10: alter an audit entry         | Hash chaining exposes a modified entry when the rest of the chain is retained. |

The benchmark stores 1,000 samples per operation in each environment. The timing study is local evidence, not proof that the network service has no timing leak. A server can rewrite an entire unanchored audit chain; an external checkpoint would strengthen it.

## Eight likely viva questions

1. **Why is an unsalted hash weak here?** An attacker hashes all three moves and compares them.
2. **What if the random value is predictable?** An attacker can try the possible moves with that value.
3. **What if someone knows `log_g(h)`?** They can calculate another opening for a Pedersen commitment.
4. **Why validate points?** Invalid encodings must not enter curve operations or verification.
5. **Why sign the context?** A signature for one player or round cannot authorize a different one.
6. **What does the audit chain detect?** Changes that conflict with the retained chain; a complete rewrite can evade it.
7. **Does a timing test prove constant time?** No. It measures particular inputs and conditions only.
8. **Why is Pedersen slower than hashing?** It performs elliptic-curve point operations rather than only hashing bytes.

Read `docs/attacks.md`, `docs/benchmarks.md`, `docs/threat-model.md`, and `packages/adversary-sim/src/index.ts` first. Run `pnpm attacks` and inspect Attack Lab in the app.
