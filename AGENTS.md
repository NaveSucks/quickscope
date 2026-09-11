# Quickscope agent guide

These instructions apply to the entire repository.

Quickscope is a password-gated desktop browser FPS. The public repository is
`NaveSucks/quickscope`, the production URL is `https://bug.engineer/quickscope/`,
and the checkout on the production host is `/home/deploy/projects/quickscope`.

Read `README.md`, `docs/VALIDATION.md`, `docs/MAP.md`, and `docs/ASSETS.md` before
changing gameplay, networking, map content, authentication, or deployment.
Treat the validation ledger as evidence with explicit limits; do not turn a
headless or synthetic result into a claim about real GPU or network performance.

## Repository layout

- `client/`: Three.js WebGL2 renderer, browser input, audio, menus, and HUD.
- `server/`: Fastify HTTP/authentication and the authoritative WebSocket room.
- `shared/`: protocol, simulation, weapons, collision, map, and gameplay types.
- `tests/`: unit, integration, protocol, lifecycle, and route tests.
- `scripts/`: password setup, browser/load tests, secret scan, and map generation.
- `ops/`: app-scoped Compose, nginx, preview, deployment, and rollback tooling.

Keep rendering separate from simulation. Clients send sequenced input and aim;
the server owns movement validation, ammunition, hits, health, scores, rounds,
respawns, and replay data. Preserve the single-room 18-player free-for-all and
the typed definitions intended for later loadout and game-mode expansion.

## Development and verification

Use Node.js 24 and the pinned lockfile. Start with:

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run build
python3 scripts/scan-secrets.py
```

Run `npx tsx scripts/browser-test.ts` after changes to authentication, loading,
browser gameplay, networking, or replay behavior. It requires a built client and
Playwright Chromium. The 18-client load test intentionally lasts 30 minutes; run
it only when performance or release evidence warrants the production-host load.

Use `python3 scripts/setup-password.py` for hidden password entry. Never print,
read into chat, commit, copy into an image layer, or place the password or its
hash in the repository. `.env.example` is intentionally empty.

All shipped geometry, textures, audio, UI, and models must be original or have a
documented compatible license. Never import extracted game assets. Keep map
render placement and simplified collision sourced from the authored shared map.

## Current release and production safety

The human preview was approved and the first release was deployed on
2026-09-11. Production currently runs commit
`c76ab24e670e2875126c1eef0fbb31b8471a4fb0` at manifest digest
`sha256:f1161da71c2c2eca8c5bfd5f250c3b35f2b217b9c701aa1c0d4740c48cf0cf97`.
Later repository commits do not deploy automatically. Update this paragraph and
`docs/VALIDATION.md` after a release changes the live digest.

Ordinary iteration does not authorize production deployment. For an explicitly
requested release on this VPS, first read
`/home/deploy/.agents/skills/vps-web-ops/SKILL.md`, inspect the exact live state,
and use the app-scoped files under `ops/`. Do not use the infrastructure-wide
workflow or broad Compose commands, and do not restart or modify unrelated
services. Validate nginx before reloading it and verify existing public routes.
Runtime secrets and rollback artifacts remain outside Git.

The live release has passed CI, gated HTTPS bundle loading, authenticated
WebSocket verification, and an approved human preview. Remaining evidence gaps
are listed in `docs/VALIDATION.md`; preserve those qualifications while iterating.
