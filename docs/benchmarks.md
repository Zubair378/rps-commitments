# Benchmarks and security–usability trade-offs

Run `pnpm bench`, `pnpm bench:browser`, `pnpm bench:timing`, then `python scripts/plot_results.py`. Raw samples, summaries, and figures are in `docs/results/`. Each commit/open/verify row uses 1,000 timed samples; browser hash and opening samples time batches and divide by the batch size because Chromium's timer rounds short operations.

## Local latency (milliseconds per operation)

| Environment | Method         |  Commit p50 / p95 |  Open p50 / p95 |  Verify p50 / p95 |
| ----------- | -------------- | ----------------: | --------------: | ----------------: |
| Node 20     | Pedersen P-256 | 13.1205 / 40.7131 | 0.0017 / 0.0034 | 12.6732 / 19.3355 |
| Node 20     | Salted SHA-256 |   0.0337 / 0.1161 | 0.0009 / 0.0021 |   0.0143 / 0.0397 |
| Chromium    | Pedersen P-256 |   2.9000 / 6.8000 | 0.0005 / 0.0007 |   2.9000 / 5.7000 |
| Chromium    | Salted SHA-256 |   0.0260 / 0.0520 | 0.0004 / 0.0009 |   0.0260 / 0.0600 |

The numbers come from this machine and vary with load, browser, JIT warmup, and timer resolution. Compare methods _within_ an environment, not Node against Chromium. Opening is only serialization, so its tiny measured time is a timer-resolution estimate. [Latency figure](results/figures/latency.png) shows the comparison on a logarithmic scale.

## Size and assumptions

| Method         |               Commitment |         Signature |                Opening value | Hiding                                | Binding                                                                                     |
| -------------- | -----------------------: | ----------------: | ---------------------------: | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Pedersen P-256 | 33-byte compressed point | 64-byte raw ECDSA | 1-byte move + 32-byte scalar | Perfect with uniform `r`              | Computational: unknown discrete log between `g` and `h` (~128-bit classical group security) |
| Salted SHA-256 |           32-byte digest | 64-byte raw ECDSA |   1-byte move + 32-byte salt | Computational with unpredictable salt | Computational: hash collision/preimage resistance                                           |

The API sends hex strings inside JSON, so actual wire messages are larger than these binary values. The signature is needed for identity and replay resistance in both modes. Pedersen's extra byte buys a stronger hiding statement, but its group operations add visible CPU time. The salted hash is much faster; its hiding fails if the salt is predictable or reused. A browser key can be lost when storage is cleared, requiring rotation or a new key; a player who loses a round opening may forfeit at the deadline. The UI therefore saves the opening before sending the commit request and explains missing openings.

## Comparison timing study

`pnpm bench:timing` recorded 2,000 batches of 1,000 comparisons per mismatch position and method. For the deliberately early-exit comparator, first-byte mismatches averaged **6.1 ns** (SD 27.0) versus last-byte **194.7 ns** (SD 220.1), Welch p ≈ **3.1×10⁻²⁴⁰**. For Node `timingSafeEqual`, the means were **256.6 ns** (SD 317.5) and **261.8 ns** (SD 323.0), Welch p ≈ **0.605**. The local data detects a strong early-exit difference and does not detect one for `timingSafeEqual` in this run. It does not prove the whole HTTP path is constant-time or that a remote attacker can exploit the weak comparator. [Timing figure](results/figures/timing.png) and [raw data](results/timing.csv) support the numbers.

The two-browser end-to-end test records local click-to-commit and second-reveal-to-verification time in `docs/results/ux-local.json`. Deployed latency and free-tier cold starts require a live service; they must not be inferred from local results.
