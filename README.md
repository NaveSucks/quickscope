# Quickscope

A password-gated desktop browser rooftop FPS prototype for
https://bug.engineer/quickscope/. One server-owned room, 18 slots, free-for-all
to 15 kills, Intervention/pistol, original procedural assets and final killcam.

**Release status: development; not yet approved by a human gameplay playtest.**
The Highrise-inspired greybox is provisional. Do not describe it as a measured,
validated reconstruction or claim integrated-GPU performance without testing.

## Development

Node 24. `npm ci --ignore-scripts`, `npm run check`, `npm test`, `npm run build`.
Run `python3 scripts/setup-password.py` in your terminal for hidden password entry.
Start with `PASSWORD_HASH_FILE=$HOME/quickscope-secrets/password_hash npm start`.
Use a same-origin HTTPS proxy at `/quickscope/`; the cookie is always Secure.
The empty `.env.example` intentionally contains no secret or hash.

Client: Three.js WebGL2 + DOM + Web Audio. Server: Fastify + ws. Shared:
Rapier 0.19.0, map/collision source, weapon timing, binary input/snapshot codecs.
Render code is separate from the authoritative room and shared movement.

## Checks

`npm test` covers timing, admission, auth, damage, physics and lifecycle.
`npx tsx scripts/browser-test.ts` requires Playwright Chromium and a built client.
`npx tsx scripts/load-test.ts` runs 18 actual sockets for 30 minutes and writes
`test-results/load.json`. Run resource-limited and away from unrelated production
workloads. Browser tests use a generated in-memory secret, never production auth.

See `docs/VALIDATION.md` for evidence and open acceptance requirements,
`docs/MAP.md` for routes, and `docs/ASSETS.md` for provenance.

## Production and rollback

CI builds/tests and publishes `ghcr.io/navesucks/quickscope:<full commit>`.
No automatic deployment, mutable latest tags, or shared infrastructure workflow.
An operator deploys only a verified digest using the dedicated `quickscope`
project and `ops/compose.yml`. This keeps builds off the production VPS.

1. Provision the host-only password hash using the hidden setup script.
2. Record existing app digest/config if replacing a release. For a first release,
   rollback removes only the Quickscope container and added nginx include.
3. Store `QUICKSCOPE_IMAGE=ghcr.io/navesucks/quickscope@sha256:...` in a protected
   host file outside this repository; retain prior digest and configuration.
4. `docker compose --env-file /home/deploy/quickscope-ops/image.env -p quickscope
   -f ops/compose.yml config --quiet`, then app-specific `pull quickscope` and
   `up -d --no-deps --no-build quickscope`.
5. Back up the exact nginx site file, insert `ops/nginx-location.conf` in its HTTPS
   block, run `sudo nginx -t`, then reload. Never replace unrelated routes.
6. Verify gate, direct asset denial, authenticated WebSocket/game, container image
   digest, health and existing Monster/advent routes. Retain rollback artifacts.

Secrets are outside Git and image layers. Public source/assets are copyable;
the password protects hosted downloads and multiplayer, not the public project.
