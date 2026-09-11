#!/usr/bin/env bash
# Loopback-only human playtest; no nginx or production changes.
set -euo pipefail
image=${1:?Usage: ops/preview.sh ghcr.io/navesucks/quickscope@sha256:DIGEST}
[[ "$image" =~ ^ghcr\.io/navesucks/quickscope@sha256:[a-f0-9]{64}$ ]]
test -f /home/deploy/quickscope-secrets/password_hash || { echo 'Run scripts/setup-password.py first.' >&2; exit 1; }
if docker container inspect quickscope-preview --format '{{.Id}}' >/dev/null 2>&1; then
  [[ $(docker inspect quickscope-preview --format '{{index .Config.Labels "quickscope.role"}}') == preview ]]
  docker stop quickscope-preview
  docker rm quickscope-preview
fi
docker pull "$image"
docker run -d --name quickscope-preview --memory=512m --cpus=1 --pids-limit=128 \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges:true \
  --tmpfs /tmp:size=32m,noexec,nosuid \
  --label quickscope.role=preview --label com.centurylinklabs.watchtower.enable=false \
  --publish 127.0.0.1:8188:8080 \
  --env ORIGIN=http://localhost:8188 \
  --mount type=bind,src=/home/deploy/quickscope-secrets/password_hash,dst=/run/secrets/password_hash,readonly \
  "$image"
printf 'Forward with: ssh -L 8188:127.0.0.1:8188 deploy@85.215.70.94\nThen open http://localhost:8188/quickscope/ in desktop Chrome.\n'
