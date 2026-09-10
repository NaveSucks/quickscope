#!/usr/bin/env python3
"""Run interactively on the host. Never pass the password as a CLI argument."""
import getpass, hashlib, os, pathlib, secrets
path = pathlib.Path.home() / 'quickscope-secrets' / 'password_hash'
if path.exists():
    raise SystemExit('Password hash already exists. Rotate deliberately after stopping active sessions.')
a = getpass.getpass('Temporary lobby password (hidden): ')
b = getpass.getpass('Repeat password (hidden): ')
if a != b or len(a) < 8:
    raise SystemExit('Passwords must match and contain at least 8 characters.')
salt = secrets.token_hex(16)
digest = hashlib.scrypt(a.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=32).hex()
path.parent.mkdir(mode=0o700, exist_ok=True)
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(salt + ':' + digest + '\n')
print('Password hash provisioned. No plaintext stored.')
