# Project progress

The requirement definitions and gates are in [MASTER_INSTRUCTIONS.md](MASTER_INSTRUCTIONS.md). Mark an item complete only with a working test or reviewable artifact.

## Must

- [x] M1 Pedersen commitments and verification — `packages/crypto-core/src/index.test.ts`
- [x] M2 Salted SHA-256 baseline — known-answer and context tests
- [ ] M3 Browser-side commitment and secret handling
- [ ] M4 Two-player commit/reveal game
- [ ] M5 Tournament lobby and bracket
- [ ] M6 Signing keys, rotation, and revocation
- [x] M7 Persistent REST/WebSocket backend — API tests and live two-client smoke test
- [ ] M8 Guided UI and crypto inspector
- [ ] M9 Attack simulations with fixes
- [ ] M10 Benchmarks and trade-off analysis
- [ ] M11 Free public deployment
- [ ] M12 Report, presentation, and demo material
- [x] M13 Tests and CI — `.github/workflows/ci.yml`

## Should

- [ ] S1 Public hash-chained audit log — chain exists; independent verifier comes in Stage 3
- [ ] S2 Homomorphic property lab
- [ ] S3 Spectator mode
- [ ] S4 Rate limiting and abuse protection

## Could

- [ ] C1 Dark mode and internationalization
- [ ] C2 Offline transcript export

## Gates

| Gate | Status      | Evidence                                                                         |
| ---- | ----------- | -------------------------------------------------------------------------------- |
| 0    | Conditional | Node 20, pnpm, workspace ready; third member and collaborator acceptance pending |
| 1    | Pass        | 9 crypto tests, pinned generator and known-answer vectors                        |
| 2    | Pass        | 5 API tests and live two-client match script                                     |
