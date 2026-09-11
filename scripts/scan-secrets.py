#!/usr/bin/env python3
"""Scan tracked source and built assets without printing matched secret material."""
import pathlib,re,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
files=[root/p for p in tracked if p]+list((root/'dist').rglob('*'))
patterns=[rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----',rb'(?<![a-f0-9])[a-f0-9]{32}:[a-f0-9]{64}(?![a-f0-9])']
failed=[]
for p in files:
    if p.is_file() and any(re.search(pattern,p.read_bytes()) for pattern in patterns):failed.append(str(p.relative_to(root)))
if failed:
    print('Possible secrets found in: '+', '.join(failed));sys.exit(1)
print(f'No matching credentials or password hashes in {len(files)} tracked/build paths.')
