# Threat model and attack surface

## Assets and trust boundaries

Assets are unrevealed moves and blinding factors, signing keys, session cookies, match outcomes, and the audit trail. The browser is trusted to generate randomness and keep its local key and opening; the network and other players are untrusted. The referee enforces phases, deadlines, and tournament advancement, but a malicious operator can observe received openings and rewrite its database. TLS and the hosting platform are required for a public deployment.

## Attack surface

| Entry point        | Threat and impact                              | Mitigation                                                                                   | Evidence                                  |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| REST API           | Forged or replayed commitment, invalid opening | Zod validation, context-bound ECDSA, duplicate check, opening verification                   | `apps/server/src/app.test.ts`, A4, A5, A9 |
| WebSocket          | Untrusted updates or connection flood          | Notifications carry no secret or authoritative result; state is fetched via REST; rate limit | `apps/server/src/app.ts`                  |
| Session cookie     | Theft, replay, or fixation                     | 256-bit random token, HTTP-only cookie, server-side hash, expiry, logout revocation          | API session test                          |
| Database           | Edited match result or audit row               | Signed commitments and hash-linked public events; browser verifier                           | A10, `packages/crypto-core/src/audit.ts`  |
| IndexedDB          | Lost or compromised private key                | Non-extractable Web Crypto key, revoke/rotate; public keys retained                          | Key lifecycle test and UI                 |
| Session storage    | Lost or exposed opening                        | Per-player/match/round key; local only until reveal; warning on missing opening              | Playwright commit-payload test            |
| `/api/params`      | Trapdoor generator substituted by server       | Browser recomputes and pins hash-to-curve `h`                                                | Crypto test, A3                           |
| Dependencies       | Compromised cryptographic implementation       | Pinned noble versions, CI, lockfile, no custom curve arithmetic                              | `pnpm-lock.yaml`, CI                      |
| Host configuration | Public HTTP, leaked secrets, wrong origin      | HTTPS, environment variables outside Git, production session cookie                          | `.env.example`, deployment checklist      |

## Security goals and residual risks

The commitment must hide a move until reveal and bind its opener to one move. The referee must reject copied commitments, invalid points, stale signatures, late actions, and invalid openings. A spectator can inspect public evidence and recompute the audit chain. The chain has **no external checkpoint**: the server can rewrite the entire chain. The server also receives one opening before the other and could disclose it early. A Web Crypto key stored on a compromised device cannot protect that device. These limits should be stated during the presentation.
