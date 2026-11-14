# Deployment preparation

The app can run as one free Render web service: the Node referee serves the built React client on the same HTTPS origin. This keeps the HTTP-only `SameSite=Lax` session cookie working without third-party cookies or cross-origin credentials. `render.yaml` defines the service; `.node-version` pins Node 20.20.2. A persistent PostgreSQL `DATABASE_URL` is required because Render's free web-service filesystem is ephemeral. Render's own free Postgres expires after 30 days, so a free Neon project is the recommended database for a classroom URL that persists longer.

## Provisioning checklist

1. Create a free Neon Postgres project. Copy its pooled connection string into a private password manager; require TLS (`sslmode=require`, or `verify-full` for hostname validation). Never commit it.
2. Connect this GitHub repository to Render and create a Blueprint from `render.yaml` on `main`. Choose the free plan and provide `DATABASE_URL` when prompted. The Blueprint builds the web client, starts the API, runs migrations at startup, and checks `/health`.
3. Open the assigned `https://…onrender.com/health` URL, then the root page. Test two accounts in separate browser profiles, including commit, reveal, audit verification, and a 4-player bracket.
4. Optionally connect Vercel after the Render URL is known. Configure an external rewrite for `/api/:path*` to the Render origin so browser requests stay same-origin. The browser has a 3-second polling fallback if WebSocket proxying is unavailable. Do not set `VITE_API_URL` to a cross-site API without revisiting cookie behavior.
5. Record the live URL, deployed end-to-end timing, and cold-start duration in the README and report. Render's free web service may spin down after 15 minutes idle, so pre-warm it before the presentation.

Local production-style smoke test already passed with `SERVE_WEB=1`: `/health`, `/`, a deep React route, and `/api/params` each returned HTTP 200. The actual cloud deployment remains unverified until the account connections are available.

Official references: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [Render free tier](https://render.com/docs/free), [Render Node version](https://render.com/docs/node-version), [Neon connection security](https://neon.com/docs/connect/connect-securely), and [Vercel external rewrites](https://vercel.com/docs/routing/rewrites).
