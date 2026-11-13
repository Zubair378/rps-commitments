# Stage 1: commitments and referee API

## What we built

`packages/crypto-core` implements Pedersen commitments on P-256 and a salted SHA-256 comparison. A **commitment** is a value sent now that hides a choice but fixes it for later. For a move `m` and secret random **blinding factor** `r`, Pedersen computes `C = m·g + r·h`. The point `h` is derived from a public seed and domain-separation tag using RFC 9380 hash-to-curve, then checked against a pinned value. This avoids giving any player a known `log_g(h)`, which would let them open one commitment two ways.

The staged master guide specifies `r` from 1 through `q−1` while also calling the scheme perfectly hiding. Those statements conflict exactly: omitting zero leaves one possible commitment point out for each move. The implementation samples uniformly from the full field `0` through `q−1` by rejection sampling, which preserves the standard perfect-hiding proof. The teacher's topic guide requires random blinding factors but does not exclude zero. See the [formal Pedersen analysis](https://arxiv.org/abs/1705.05897) for the uniform-field construction.

The API registers players and P-256 signing keys, creates two-player matches, accepts signed commitments, waits for both players before reveal, verifies openings, and resolves a result or deadline forfeit. Sessions use random tokens stored only as hashes with server-checked expiry. The audit table chains event hashes; openings enter public results only after both reveals or a deadline.

## Why these choices matter

- `r` and salted-hash salts come from a cryptographic random source. Predictable values would expose a three-choice move.
- The signed message includes tournament, match, round, player, mode, and commitment. A copied or old signature cannot authorize another context.
- The commit request rejects extra fields, so an early move or blinding factor cannot be accepted accidentally.
- The first reveal remains absent from match and audit responses until the barrier. A malicious server can still leak what it receives. The audit chain has no external checkpoint yet, so it cannot prove a malicious server preserved the entire history.
- Inputs are validated before curve decoding; server tokens and password hashes use constant-time comparisons. JavaScript timing behavior is not a formal side-channel guarantee.

## Five likely viva questions

1. **Why is Pedersen perfectly hiding?** For every commitment and possible move, some blinding factor produces the same point; the commitment alone does not favor one move.
2. **Why is binding computational?** Two different openings would reveal the discrete-log relationship between `g` and `h`, assumed hard to find on P-256.
3. **Why derive `h` by hash-to-curve?** A public, repeatable derivation avoids a person choosing `h` with a secret known discrete log.
4. **Why sign a commitment?** Pedersen does not identify its author or match; the signature binds both and blocks replay in another context.
5. **What if a player never reveals?** The referee waits until the reveal deadline, then records a forfeit or draw without exposing an early opening.

## Read and run first

Read `packages/crypto-core/src/index.ts`, its tests, `apps/server/src/app.ts`, and `apps/server/src/db.ts`. Run `pnpm test`, then `pnpm play:match http://127.0.0.1:3000` with the server running. The known-answer vectors are in `packages/crypto-core/src/index.test.ts`.

The browser, tournament progression, attack demonstrations, benchmarks, and deployment are scheduled for later stages. See `docs/PROGRESS.md` for current gates and pending team details.
