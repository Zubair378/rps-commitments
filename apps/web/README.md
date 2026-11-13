# Web application

The React/Vite client runs at `http://127.0.0.1:5173` with `pnpm dev`. Vite proxies `/api` and `/ws` to the local Fastify service on port 3000. The browser computes commitments, signs with a non-extractable Web Crypto key, and retains openings in session storage until reveal. Build with `pnpm build`; run the two-browser flow with `pnpm test:e2e`.
