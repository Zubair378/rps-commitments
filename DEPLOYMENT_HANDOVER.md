# Deployment handover: RPS Commitments

This guide is for the student and any assisting AI, including Claude. It describes the current repository and the steps to deploy it using Neon, Render, and Vercel. Complete the checks before calling the project deployed. Dashboard labels may change; consult the official links at the end if they differ.

## Current state and important files

- Repository: https://github.com/Zubair378/rps-commitments, branch `main`. Local Windows path: `E:\infosec_proj\rps-commitments`.
- React/Vite frontend: `apps/web`; Fastify API and WebSocket server: `apps/server`; shared crypto: `packages/crypto-core`.
- `render.yaml` defines a free Node web service, Node is pinned in `.node-version`, and `docs/VERIFY.md` explains functional checks. The server migrates the database at startup.
- On 17 November 2026, the Vercel site and Render API responded, a deployed two-browser match passed, and a four-player API bracket completed. Cloud database persistence after restart and four-device browser play remain unverified.
- `AGENTS.md` already exists. Read it and `docs/MASTER_INSTRUCTIONS.md`; do not overwrite `AGENTS.md`.
- Prior local results: 27 Vitest tests passed; Playwright reported 3 passed and 1 intentionally skipped benchmark. CI also passed. Run the checks again if code changes.

## How the deployment works

Neon stores persistent PostgreSQL data. Render runs the API. Vercel serves the built React frontend and forwards `/api/*` and `/health` requests to Render. These rewrites keep API requests on the Vercel origin in the browser so the app's `Secure`, `HttpOnly`, `SameSite=Lax` session cookie can work. The frontend already polls for match updates every three seconds if WebSocket connection fails. Test this on the deployed system.

`vercel.json` exists and routes API traffic to the Render URL. The following provisioning steps describe the original setup and should be adapted to the existing deployment. Do not set `VITE_API_URL` to the Render URL for this setup: cross-site cookies and CORS require a separate design and verification.

The student's cloud accounts are available to them. Plugin installation alone does not prove a particular assistant can access those accounts. If tools are unavailable, guide the student through the dashboards; ask only for public URLs and sanitized error messages. Never ask for a password, API token, database URL, or other secret in chat. Do not publish, invent, or mark untested steps as complete.

## 1. Check the repository and accounts

1. Open the GitHub repository, select `main`, and confirm `render.yaml`, `.node-version`, `apps/web`, and `apps/server` exist. Confirm any deployment configuration changes are committed and pushed to `main` before a dashboard deploy.
2. Sign in to Neon, Render, and Vercel in separate tabs. Authorize Render and Vercel to access the GitHub repository when prompted. Select the intended account and a free plan; check any displayed charges before confirming.
3. Choose a Neon region close to Render's configured **Singapore** region if available. Record the actual choices for the report.

## 2. Create a Neon database

1. In the Neon dashboard, create a project on the free plan, for example `rps-commitments`. Keep the default database and role unless there is a reason to change them.
2. Open **Connect**, select the database and role, and select a **direct connection** (turn off pooled connection). Copy the PostgreSQL connection string with TLS enabled (normally `sslmode=require`) directly into a private password manager or the Render field in the next step. The current Kysely migrator uses a session-level advisory lock; transaction-mode pooling can break that assumption. This single Render service uses its own small Node PostgreSQL connection pool.
3. Keep that string private: it contains the database password. Do not paste it into chat, GitHub, screenshots, or the Vercel public build settings. Use a fresh database for this project.

## 3. Deploy the backend to Render

1. In Render, choose **New → Blueprint** and connect `Zubair378/rps-commitments` on `main`. Render should find the root `render.yaml`.
2. Review the proposed service and free plan. When prompted for `DATABASE_URL`, paste the private Neon connection string. The Blueprint sets `NODE_ENV=production` and `SERVE_WEB=1`; do not add a cross-site API URL. It builds with `corepack enable && pnpm install --prod=false --frozen-lockfile && pnpm build`, then starts with `pnpm --filter @rps/server start`.
3. Deploy and wait for the build and startup logs to show success. Migrations run at startup; the first database connection may take time. Do not share log lines containing credentials.
4. Copy the public Render origin, for example `https://YOUR-SERVICE.onrender.com`. Visit its `/health`, `/api/params`, and `/` paths. `/health` and `/api/params` should return HTTP 200; `/` should display the app. Record the **actual** origin, without a trailing slash, for step 4.
5. If startup fails, inspect the Render logs. Check that the Neon URL is correct, TLS is enabled, the database is reachable, and the Node version/build command match the Blueprint. Never replace the Neon URL with local SQLite for a public deployment: a free service's local filesystem is not persistent.

## 4. Add the Vercel routing configuration

The assisting AI can make this change; otherwise, edit it locally. Review the existing `vercel.json` at the **repository root**; for a new deployment, replace `https://YOUR-SERVICE.onrender.com` in both destinations with the real Render origin from step 3. Preserve `/api/:path*` in the destination:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "corepack enable && pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build",
  "outputDirectory": "apps/web/dist",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-SERVICE.onrender.com/api/:path*"
    },
    {
      "source": "/health",
      "destination": "https://YOUR-SERVICE.onrender.com/health"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The origin is public; it is safe to commit. Never insert the Neon connection string here. Keep the API and health rules before the frontend fallback. The `/ws` route is not forwarded by this example: confirm that polling updates matches; investigate and test WebSocket forwarding separately if desired. Commit and push `vercel.json` to `main` through the team's normal branch and PR process. Confirm it is visible on GitHub.

## 5. Deploy the frontend to Vercel

1. In Vercel select **Add New → Project**, import the GitHub repository, and select `main`. Set **Root Directory** to the repository root, not `apps/web`, because the install and build use the pnpm workspace.
2. Review the settings from `vercel.json`: Vite, install `corepack enable && pnpm install --frozen-lockfile`, build `pnpm build`, output `apps/web/dist`. Node must satisfy the root package's `>=20.19 <27` engine; verify the Node version in Vercel project settings and build logs.
3. Leave `VITE_API_URL` unset. The Neon `DATABASE_URL` belongs only in Render. Deploy and read the logs until Vercel reports success. Copy the public Vercel URL.
4. Open the Vercel URL, then `/health` and `/api/params`. Each endpoint must reach Render and return HTTP 200. Refresh a client route such as `/audit`: it should load the React app, not a 404 page. The public Render site remains available as a useful independent fallback.

## 6. Verify the real deployment

From the repo on a computer with Node and pnpm, run:

```powershell
pnpm smoke:live https://YOUR-VERCEL-PROJECT.vercel.app
```

This checks the home page, `/health`, and `/api/params`, then **creates two test accounts and a tournament in the real database** and completes a signed two-player API match. It requires a full HTTPS origin without a path. A passing result does not prove browser cookies or a four-player tournament work.

1. Open the Vercel site in two independent browser profiles. Register distinct accounts, create a two-player tournament, join, commit different moves, and reveal. Confirm both players see the correct result and verified openings. In browser developer tools, confirm the commit request does not include the move or blinding factor before reveal.
2. Confirm sign-in survives a page refresh and `/api/me` returns the signed-in user. If API smoke passes but browsers cannot stay signed in, inspect the Vercel rewrite and cookie domain, `Secure`, and `SameSite` settings; avoid cross-site `VITE_API_URL`.
3. Use four independent players on different devices and, where possible, networks to finish a four-seat best-of-three tournament. Check semifinal winners advance and a champion appears. Test key rotation/revocation, Attack Lab, and browser audit verification. Confirm polling advances a waiting screen if WebSockets are unavailable.
4. Restart or redeploy the Render service, then log in and confirm the previously created data remains. This checks that Neon, rather than ephemeral SQLite, stores the data. Measure and record first-load/cold-start and normal response times with the date and conditions.
5. If any check fails, preserve the sanitized error and relevant URL, fix the issue, redeploy, and repeat the failed check. Do not mark the cloud gate complete until the four-device test passes.

## 7. Course handover after successful testing

- Update the real Vercel and Render URLs, measured cloud timings, and any actual limitations in `README.md`, `docs/report.md`, and the report PDF. Update `docs/PROGRESS.md`, `docs/final-checklist.md`, and this guide only with verified results.
- Confirm all three members' names, roll numbers, GitHub usernames, and real code contributions/PRs. Update `docs/TEAM.md`, report, and presentation. The student must update **only their own row** in the Topic Selection Sheet with the repository and verified live URL.
- Rehearse the demo three times, record a fallback video, and prepare questions specific to the next presenting group's topic. Review `docs/demo.md`, `docs/slides.pdf`, and `docs/learning/`.

## Troubleshooting

- **Render build fails:** compare build output, Node version, pnpm lockfile, and `render.yaml`. Share only sanitized logs.
- **Render health fails or migrations fail:** check service logs and Neon availability, connection string, TLS, and free-plan status. Check the database was created in the expected account.
- **Vercel root loads but API returns 404 or HTML:** check rewrite order, destination including `/api/`, the actual Render origin, and that the commit containing `vercel.json` was deployed.
- **Refresh on a page returns 404:** check the final frontend fallback rewrite and redeploy.
- **A match doesn't update live:** wait for the three-second polling fallback, check both clients' network requests, and inspect Render logs. A working API alone does not prove browser sessions or WebSockets.
- **A free service is slow after inactivity:** retry the health endpoint and record the observed delay; pre-warm the app before the demo. Check current provider quotas and free-plan conditions in their dashboards.

## Official references

- [Render Blueprints](https://render.com/docs/infrastructure-as-code) and [Blueprint specification](https://render.com/docs/blueprint-spec)
- [Neon connection security](https://neon.com/docs/connect/connect-securely)
- [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [monorepos](https://vercel.com/docs/monorepos), and [build settings](https://vercel.com/docs/builds/configure-a-build)
- [Render free tier](https://render.com/docs/free)
