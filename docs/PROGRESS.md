# Project progress

The requirement definitions and gates are in [MASTER_INSTRUCTIONS.md](MASTER_INSTRUCTIONS.md). Mark an item complete only with a working test or reviewable artifact.

## Must

- [x] M1 Pedersen commitments and verification — `packages/crypto-core/src/index.test.ts`
- [x] M2 Salted SHA-256 baseline — known-answer and context tests
- [x] M3 Browser-side commitment and secret handling — Playwright verifies commit payload has no opening
- [x] M4 Two-player commit/reveal game — two-browser Playwright match
- [x] M5 Tournament lobby and bracket — four-player API bracket test
- [x] M6 Signing keys, rotation, and revocation — API test and browser key management
- [x] M7 Persistent REST/WebSocket backend — API tests and live two-client smoke test
- [x] M8 Guided UI and crypto inspector — first-visit tour, match inspector, 375px Playwright check
- [x] M9 Attack simulations with fixes — A1–A10 assertions, live Attack Lab, raw JSON
- [x] M10 Benchmarks and trade-off analysis — Node/Chromium CSV, plots, timing study
- [ ] M11 Free public deployment
- [x] M12 Report, presentation, and demo material — PDF/source, diagrams, slides, cues, demo plan; human rehearsal pending
- [x] M13 Tests and CI — `.github/workflows/ci.yml`

## Should

- [x] S1 Public hash-chained audit log — chain verifier in browser
- [x] S2 Homomorphic property lab — interactive point-addition page
- [x] S3 Spectator mode — public bracket, match transcript, and audit pages
- [x] S4 Rate limiting and abuse protection — global Fastify request limit and validation

## Could

- [ ] C1 Dark mode and internationalization
- [ ] C2 Offline transcript export

## Gates

| Gate | Status      | Evidence                                                                         |
| ---- | ----------- | -------------------------------------------------------------------------------- |
| 0    | Conditional | Node 20, pnpm, workspace ready; third member and collaborator acceptance pending |
| 1    | Pass        | 9 crypto tests, pinned generator and known-answer vectors                        |
| 2    | Pass        | 6 API tests and live two-client match script                                     |
| 3    | Pass        | Two-context Playwright full match and 375px viewport screenshot                  |
| 4    | Pass        | Key rotation/revocation API tests and key management UI                          |
| 5    | Pass        | A1–A10 unit tests and browser Attack Lab                                         |
| 6    | Pass        | Browser hash-chain verifier and A10 tampering test                               |
| 7    | Pass        | 1,000 Node and Chromium samples per operation, raw CSV, plots                    |
| 8    | Pending     | Render/Neon account connection and public multi-device test                      |
| 9    | Conditional | Report PDF, five diagram pairs, slides, and README exist; live URL/team pending  |
| 10   | Pending     | Three-member rehearsal and next-group questions require people                   |
