#!/usr/bin/env bash
# Restore only Quickscope. No broad project operations or unrelated restarts.
set -euo pipefail
backup=${1:?Usage: ops/rollback.sh /home/deploy/quickscope-ops/rollback-TIMESTAMP}
[[ "$backup" =~ ^/home/deploy/quickscope-ops/rollback-[0-9TZ]+$ ]]
test -f "$backup/nginx-site"
ops=/home/deploy/quickscope-ops
if test -f "$backup/image.env"; then
  cp "$backup/image.env" "$ops/image.env"
  cp "$backup/compose.yml" "$ops/compose.yml"
  compose=(docker compose --env-file "$ops/image.env" -p quickscope -f "$ops/compose.yml")
  "${compose[@]}" config --quiet
  "${compose[@]}" pull quickscope
  "${compose[@]}" up -d --no-deps --no-build --pull never quickscope
else
  # First release: remove this service only, retaining secret and rollback files.
  docker compose --env-file "$ops/image.env" -p quickscope -f "$ops/compose.yml" stop quickscope
  docker compose --env-file "$ops/image.env" -p quickscope -f "$ops/compose.yml" rm -f quickscope
fi
if test -f "$backup/nginx-snippet"; then
  sudo cp "$backup/nginx-snippet" /etc/nginx/snippets/quickscope.conf
else
  # Remove only our include, preserving edits to unrelated routes since release.
  python3 - "$ops/nginx-rollback" <<'PY'
import pathlib,sys
p=pathlib.Path('/etc/nginx/sites-available/bug.engineer')
s=p.read_text().replace('    include /etc/nginx/snippets/quickscope.conf;\n','')
pathlib.Path(sys.argv[1]).write_text(s)
PY
  sudo install -m 644 "$ops/nginx-rollback" /etc/nginx/sites-available/bug.engineer
fi
sudo nginx -t
sudo systemctl reload nginx
printf 'Quickscope rollback applied from %s\n' "$backup"
