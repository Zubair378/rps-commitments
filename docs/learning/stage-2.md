# Stage 2: browser game and tournament

The React client generates P-256 ECDSA keys with Web Crypto and stores each non-extractable private key in IndexedDB. A player chooses a move locally. `buildCommit` verifies the pinned public Pedersen parameters, constructs a Pedersen or salted SHA-256 commitment, and signs a message bound to tournament, match, round, player, mode, and commitment. Only the commitment and signature are sent during the commit phase. The opening is kept in this tab's session storage until reveal.

The referee now supports best-of-three matches in 4- and 8-player single-elimination brackets. It rejects duplicate commitments throughout a match and advances winners into later stages. The match page polls and subscribes to WebSocket notifications. After resolution, it checks each available opening and signature in the browser. A crypto inspector shows the public point, signatures, and eventual openings. The audit page checks the hash chain from genesis.

Key registration, rotation, and revocation are available in the client. Old public keys remain available so earlier signatures remain verifiable. A fresh browser creates its own signing key after login; it cannot recover a lost private key. The UI displays a missing-opening warning if the player changes browser or tab mid-round.

Verification: `pnpm test` covers the four-player best-of-three bracket and key rotation; `pnpm test:e2e` runs two independent Chromium contexts through a complete match and asserts the commit request excludes the move and blinding factor. A separate viewport test checks no horizontal overflow at 375px. Screenshots are in `docs/results/ui/`.

Limits: The server can see an opening as soon as it is submitted and a malicious operator could disclose it before resolution. The hash chain detects partial edits but has no external checkpoint; a full rewrite by the server remains possible. Both limits are included in the report's threat model.

## Five likely viva questions

1. **Why use two browser profiles?** Each player needs a separate session and signing key.
2. **When is the move sent?** During reveal, after both commitments have been accepted.
3. **Why save the opening before sending a commitment?** A lost response must not erase the value needed to reveal.
4. **Why keep an old public key?** It verifies signatures made before rotation or revocation.
5. **Does the reveal barrier stop a dishonest server?** It hides an early reveal from other clients, but the server receives it and could leak it.

Read `apps/web/src/protocol.ts`, `apps/web/src/pages/MatchPage.tsx`, and `apps/server/src/bracket.test.ts` first.
