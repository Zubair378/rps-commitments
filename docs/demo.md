# Live demo and defense preparation

## Five-to-six-minute demo

1. **0:00–0:30:** Open the live URL and use **Take the tour**. If cloud access is unavailable, use the local app at `http://127.0.0.1:5173`.
2. **0:30–1:20:** Sign in with two pre-created demo accounts in separate browser profiles. Open the seeded tournament link. A third/fourth profile can fill a 4-player bracket.
3. **1:20–2:10:** Select moves and commit. Open DevTools network payload or Crypto Inspector: only `C`, signature, mode, and key ID are visible before reveal.
4. **2:10–3:00:** Reveal in both profiles. Show green local verification and the result. Explain `C = m·g + r·h`.
5. **3:00–3:45:** Run A1 in Attack Lab: three guesses break the unsalted hash, while the unknown salt prevents them.
6. **3:45–4:30:** Revoke or rotate a key and explain why old public keys remain verifiable.
7. **4:30–5:15:** Open the audit log and its browser integrity result; state the lack of external anchoring.
8. **5:15–6:00:** Show benchmark chart and one honest limitation, then take questions.

## Fallback and rehearsal

Keep two profiles signed in and a four-seat tournament created with `pnpm seed:demo` using environment-provided `DEMO_USERNAME` and `DEMO_PASSWORD`. Never commit passwords. Capture the screenshots in `docs/results/ui/` and record a short local screen video before class. On Render's free tier, open `/health` ten minutes before the slot to wake the service; it may take about a minute after 15 minutes idle. If Wi-Fi fails, demonstrate the local two-browser app and use the committed evidence.

Rehearsal record: **not yet performed by the three presenters**. Each member should run the demo and explain A1, A3, A9, the server's limits, and the benchmark plot.

## Questions each member should answer

- **Why perfectly hiding?** For each move, uniform `r` makes `m·g + r·h` uniform over the group, independent of `m`.
- **Why computationally binding?** Two different openings reveal the discrete logarithm relation between `g` and `h`; this is assumed hard when `h` is derived and pinned.
- **What if `log_g(h)` is known?** A committer can algebraically adjust `r` and open the same point to another move; A3 demonstrates it.
- **Why not only SHA-256?** A bare hash of three possible moves is guessed instantly; a random salt fixes that practical problem but gives computational hiding rather than Pedersen's perfect hiding.
- **Why P-256?** It is widely supported by Web Crypto and offers roughly 128-bit classical group security; this project avoids custom curve arithmetic.
- **Why moves 1–3?** They are canonical nonzero scalar encodings of the three choices. The mapping is fixed in signed context and tests.
- **Modulo bias?** The scalar sampler uses rejection sampling below the curve order, not `% order`.
- **What does the server learn?** It sees a commitment and signature before reveal, then sees each submitted opening as soon as it arrives.
- **Can a malicious server cheat?** It can leak the first opening, manipulate deadlines, or rewrite the entire unanchored audit chain. Clients can detect wrong openings/signatures, not all referee misbehavior.
- **Never reveals?** The deadline can forfeit or abandon the match.
- **Copying?** The server rejects duplicate commitments across the match; signatures bind player and round.
- **Which primitives were reused?** Noble P-256/hash-to-curve/SHA-256, Web Crypto ECDSA and CSPRNG, and Node `timingSafeEqual`.

## Questions for the next group

Their topic is not known yet. After seeing it, write two or three specific technical questions about its threat model, key management, and failure assumptions here. Generic questions would not satisfy the course requirement.
