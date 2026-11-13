# Repository Guidelines

## Project Structure & Module Organization

This is the CS-3002 Topic 13 project: a browser-based rock-paper-scissors tournament using Pedersen commitments. Read `docs/MASTER_INSTRUCTIONS.md` before changing the design; it defines the protocol, security constraints, phase gates, and deliverables. The planned pnpm workspace puts shared cryptography in `packages/crypto-core`, isolated attack demonstrations in `packages/adversary-sim`, the REST/WebSocket service in `apps/server`, and the React client in `apps/web`. Keep reports, diagrams, and results under `docs/`; put reproducible utilities under `scripts/`. The server must never import attack-demo code into a production path.

## Build, Test, and Development Commands

The repository is at bootstrap, so application scripts do not exist yet. Stage 1 adds a root `package.json` with `pnpm install`, `pnpm test`, `pnpm lint`, and `pnpm typecheck`; check its scripts before running them. Use Node 20 and Corepack's pinned pnpm version. Run the client and server with their workspace `dev` scripts once those packages exist.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, and the project's ESLint and Prettier configuration when added. Name React components in PascalCase, functions and variables in camelCase, and test files `*.test.ts` or `*.test.tsx`. Keep network and database code out of `crypto-core`. Pin cryptographic dependency versions and verify APIs against those exact versions.

## Testing Guidelines

Use Vitest for crypto and API tests and Playwright for the two-browser match flow. Cover correct and rejected openings, malformed points and scalars, known-answer vectors, replay protection, and the reveal barrier. Add a regression test with each security fix. No numeric coverage threshold is specified; report tested behavior at each phase gate.

## Commit & Pull Request Guidelines

The Git history currently has only `Initial commit`; follow the staged guide's small conventional commits, such as `feat(crypto): add Pedersen verification`. Work on `stage-1-core`, `stage-2-ui`, `stage-3-security`, or `stage-4-ship` branches. Include the phase gate results, test commands, linked issue when applicable, and UI screenshots for visual changes in each pull request. Do not force-push or attribute work to teammates who did not do it.

## Security & Configuration

Use audited library primitives and a cryptographic random source; never write custom curve arithmetic or use `Math.random()` in real code. Generate commitments in the browser and keep moves and blinding factors there until reveal. Never commit secrets or log them on the server. Use constant-time server comparisons, validate every network input, and keep intentionally vulnerable examples clearly marked `INSECURE-DEMO` inside `packages/adversary-sim`. Use free services only; update only your own Topic Selection Sheet row.