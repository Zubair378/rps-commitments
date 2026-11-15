# Stage 4: release and presentation

The GitHub workflow checks formatting, lint, types, tests, the random-number scan, the build, and browser flows. `render.yaml` prepares one service that serves the browser app and API together; PostgreSQL supplies persistent storage. The cloud service and public four-player check are still pending. `docs/deployment.md` explains provisioning, and `docs/VERIFY.md` explains expected results.

The report, diagrams, slides, and demonstration plan explain the design and measured limits. Before submission, replace unconfirmed team details and add the verified live URL and cloud measurements. Each member must make their own code contribution and understand the entire project. Rehearse three times and prepare questions for the next group after its topic is known.

## Five likely viva questions

1. **Why use PostgreSQL in the cloud?** Persistent storage preserves accounts and matches when a free web service restarts.
2. **Why use the same origin for app and API?** Browser session cookies work without depending on third-party cookie settings.
3. **What does CI prove?** The automated checks passed for the tested revision; it does not prove every attack is impossible.
4. **What must be checked after deployment?** The public site, a four-player match on different devices, keys, attack lab, and audit verification.
5. **What can a malicious referee still do?** It can leak an early opening, manipulate deadlines, or rewrite an unanchored audit chain.

Read `docs/VERIFY.md`, `docs/final-checklist.md`, `docs/demo.md`, `docs/report.pdf`, and `docs/slides.pdf` first. `pnpm smoke:live https://your-host` checks the public endpoints and plays a two-player API match; it creates two test accounts and does not replace the four-device browser test.
