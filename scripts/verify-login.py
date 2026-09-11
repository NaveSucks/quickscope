#!/usr/bin/env python3
"""Interactive production gate verification. Password/cookies never leave memory."""
import base64,getpass,hashlib,http.cookiejar,json,re,secrets,socket,ssl,urllib.request
origin='https://bug.engineer'
jar=http.cookiejar.CookieJar()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
password=getpass.getpass('Lobby password for HTTPS verification (hidden): ')
request=urllib.request.Request(origin+'/quickscope/api/session',data=json.dumps({'password':password}).encode(),headers={'Origin':origin,'Content-Type':'application/json'})
del password
try:
    with client.open(request,timeout=20) as response:
        assert response.status==200
    with client.open(origin+'/quickscope/game/',timeout=20) as response:
        html=response.read().decode();assert response.headers.get('Cache-Control')=='no-store'
    assets=re.findall(r'(?:src|href)="(/quickscope/game/[^\"]+)"',html)
    assert assets,'No authenticated game assets found'
    for asset in assets:
        with client.open(origin+asset,timeout=20) as response:
            assert response.status==200;response.read()
    cookie='; '.join(f'{c.name}={c.value}' for c in jar)
    key=base64.b64encode(secrets.token_bytes(16)).decode()
    with socket.create_connection(('bug.engineer',443),timeout=20) as raw:
        with ssl.create_default_context().wrap_socket(raw,server_hostname='bug.engineer') as connection:
            connection.sendall(('GET /quickscope/ws?name=ReleaseCheck HTTP/1.1\r\nHost: bug.engineer\r\nOrigin: '+origin+'\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: '+key+'\r\nCookie: '+cookie+'\r\n\r\n').encode())
            response=b''
            while b'\r\n\r\n' not in response and len(response)<16384:response+=connection.recv(4096)
            assert response.startswith(b'HTTP/1.1 101 '),'Authenticated WebSocket rejected'
            expected=base64.b64encode(hashlib.sha1((key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest())
            assert expected in response,'Invalid WebSocket handshake'
    print('HTTPS password login, gated bundles, no-store headers and authenticated WebSocket passed.')
finally:
    try:client.open(urllib.request.Request(origin+'/quickscope/api/session',method='DELETE',headers={'Origin':origin}),timeout=20).close()
    except Exception:pass
