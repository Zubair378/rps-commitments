# Final acceptance checklist

This records the status against section 12 of `MASTER_INSTRUCTIONS.md`. Recheck pending items before submission.

- [ ] Three confirmed members, each with real code commits and PRs; own Topic Selection Sheet row lists all three. See `TEAM.md`.
- [x] Pedersen and salted hash implementations, library-based primitives, random-number scan, browser commitments, and reveal barrier: `packages/crypto-core`, API tests, CI, and Playwright.
- [ ] A public tournament with at least four players on different devices: cloud deployment and device test pending.
- [x] Signed commitments, key rotation and revocation, deadlines, guided UI, responsive layout, and A1–A10 demonstrations: tests and `docs/attacks.md`.
- [x] Benchmarks, trade-offs, diagrams, report, slides, test suite, and CI: `docs/results/`, `docs/report.pdf`, `docs/slides.pdf`, and GitHub Actions.
- [ ] Demo key revocation on the deployed service; rehearse the complete demo three times and record a fallback video. See `docs/demo.md`.
- [ ] Write targeted questions after learning the next group's topic. See `docs/demo.md`.
- [ ] Update only the team's own Topic Selection Sheet row with the GitHub repository and verified live URL. The course instructions say not to submit on GCR.
- [ ] Confirm team contributions and presentation date; update the report, slides, README, and live URL and cloud measurements after deployment.

Optional features C1 and C2 remain unimplemented; see `docs/PROGRESS.md`. A local success cannot establish public availability or replace a multi-device demonstration.
