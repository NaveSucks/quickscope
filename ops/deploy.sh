#!/usr/bin/env bash
# App-scoped manual release. Run only after required human playtest and password setup.
set -euo pipefail
cd /home/deploy/projects/quickscope
image=${1:?Usage: ops/deploy.sh ghcr.io/navesucks/quickscope@sha256:DIGEST}
if [[ ! "$image" =~ ^ghcr\.io/navesucks/quickscope@sha256:[a-f0-9]{64}$ ]]; then
  echo 'An immutable Quickscope manifest digest is required.' >&2
  exit 1
fi
python3 - <<'PY'
import pathlib,re,stat
p=pathlib.Path('/home/deploy/quickscope-secrets/password_hash')
if not p.is_file() or p.is_symlink() or not re.fullmatch(r'[a-f0-9]{32}:[a-f0-9]{64}\n?',p.read_text()):
    raise SystemExit('Provision the password using scripts/setup-password.py first.')
if stat.S_IMODE(p.stat().st_mode)!=0o600:
    raise SystemExit('Password hash must have mode 0600.')
PY
ops=/home/deploy/quickscope-ops
mkdir -p "$ops"
chmod 700 "$ops"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$ops/rollback-$stamp"
mkdir -m 700 "$backup"
sudo cp /etc/nginx/sites-available/bug.engineer "$backup/nginx-site"
if sudo test -f /etc/nginx/snippets/quickscope.conf; then sudo cp /etc/nginx/snippets/quickscope.conf "$backup/nginx-snippet"; fi
if test -f "$ops/image.env"; then cp "$ops/image.env" "$backup/image.env"; fi
if test -f "$ops/compose.yml"; then cp "$ops/compose.yml" "$backup/compose.yml"; fi
cp ops/compose.yml "$ops/compose.yml"
printf 'QUICKSCOPE_IMAGE=%s\n' "$image" > "$ops/image.env"
chmod 600 "$ops/image.env"
compose=(docker compose --env-file "$ops/image.env" -p quickscope -f "$ops/compose.yml")
"${compose[@]}" config --quiet
"${compose[@]}" pull quickscope
"${compose[@]}" up -d --no-deps --no-build --pull never quickscope
ready=false
for attempt in {1..30}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:8187/readyz > /dev/null; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then echo "App failed readiness. Rollback saved at $backup" >&2; exit 1; fi
sudo install -m 644 ops/nginx-location.conf /etc/nginx/snippets/quickscope.conf
python3 - "$backup/nginx-site" "$ops/nginx-proposed" <<'PY'
import pathlib,sys
source=pathlib.Path(sys.argv[1]).read_text()
include='    include /etc/nginx/snippets/quickscope.conf;'
if include not in source:
    marker='    server_name bug.engineer www.bug.engineer;'
    if marker not in source:raise SystemExit('Expected HTTPS site structure missing. Review nginx manually.')
    source=source.replace(marker,marker+'\n'+include,1)
pathlib.Path(sys.argv[2]).write_text(source)
PY
sudo install -m 644 "$ops/nginx-proposed" /etc/nginx/sites-available/bug.engineer
if ! sudo nginx -t; then
  sudo cp "$backup/nginx-site" /etc/nginx/sites-available/bug.engineer
  echo "Nginx validation failed; site restored. App-only rollback: $backup" >&2
  exit 1
fi
sudo systemctl reload nginx
for route in quickscope/ Monster/ adventskalender/; do
  curl --fail --silent --show-error --max-time 20 "https://bug.engineer/$route" > /dev/null
done
status=$(curl --silent --max-time 20 --output /dev/null --write-out '%{http_code}' https://bug.engineer/quickscope/game/index.html)
[[ "$status" == 401 ]]
printf 'Deployed %s\nRollback files: %s\nAuthenticated login/gameplay must be verified with the hidden-password verifier and human client.\n' "$image" "$backup"
