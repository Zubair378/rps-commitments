# How to verify the project

These steps use Windows PowerShell from the repository root. Install Node 20.20.2 and enable the pinned pnpm package manager first. The app works locally without any cloud account.

## 1. Automated checks

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm check:rng
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Expected: all commands exit 0; Vitest reports **27 tests**, Playwright reports **3 passing and 1 skipped** (the long browser benchmark is a separate command). The E2E test creates two isolated browser profiles, inspects the commit request for missing plaintext, plays a complete match, checks both signatures/openings, and tests the 375px layout and Attack Lab. CI repeats these checks on every GitHub PR.

To regenerate the empirical evidence, run `pnpm attacks`, `pnpm bench`, `pnpm bench:browser`, `pnpm bench:timing`, and `python scripts/plot_results.py`. Each benchmark mode collects 1,000 samples; the timing study uses 2,000 batches per condition. Compare generated outputs with `docs/results/`. These timings vary with machine load.

## 2. Manual two-player check

```powershell
Copy-Item .env.example apps/server/.env
pnpm dev
```

Open `http://127.0.0.1:5173` in two separate browser profiles, not two tabs of one profile. In each profile, register a different username and password of at least 12 characters. In profile A, create a **2-player** tournament and share its URL with profile B. B joins; each follows the match link. Choose different moves and click **Commit my move**. Before B commits, A should see “Commitment locked in.” and no plaintext opponent move. In DevTools Network, the `/api/commit` JSON must have `commitment`, `signature`, `mode`, and `keyId`, and must **not** have `move` or `blindingFactor`. After both commit, click **Reveal and verify** in each profile. Both should show green **verified** labels and the correct winner. Open **Crypto inspector** to compare public points, signatures, and openings.

Open `/audit`; the browser should report **Hash chain verified**. Open **Attack Lab**, run A1, and verify “Vulnerable: attack succeeded” and “Protected: attack blocked.” Open **My Keys**, rotate a key, then revoke it; an old public key remains available for past verification. Open **Homomorphic Lab** and generate an example; the two points must match.

For a 4-player bracket, create a 4-seat tournament and join with four independent profiles. Complete each best-of-three match by winning two rounds. The winner should advance from semifinal to final and the bracket should show a champion. A 4-player automated API test already covers this advancement; the manual check confirms the UI.

## 3. Production-style local check

Build first with `pnpm build`, then start the server with `SERVE_WEB=1` and an isolated SQLite path. In PowerShell:

```powershell
$env:SERVE_WEB='1'
$env:PORT='3100'
$env:DATABASE_URL='file:./data/deploy-smoke.sqlite'
pnpm --filter @rps/server start
```

In another terminal, `Invoke-WebRequest http://127.0.0.1:3100/health` and `Invoke-WebRequest http://127.0.0.1:3100/` should return 200. A deep route such as `/tournaments/example` should serve the client shell, while `/api/params` should return pinned P-256 parameters. Stop the server with Ctrl+C.

## 4. Public release gate

After Render and a persistent PostgreSQL account are connected, verify `https://<assigned-host>/health`, the home page, two-profile play, a four-player bracket from different devices, key rotation, Attack Lab, and audit verification. Record the actual URL and cloud click/cold-start times in the README and report. The cloud gate is **not complete** until those checks are performed. A green local build alone is insufficient.
