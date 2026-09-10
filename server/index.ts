import {readFileSync} from 'node:fs';
import {initializePhysics} from '../shared/physics.ts';
import {createApp} from './app.ts';
const hash=readFileSync(process.env.PASSWORD_HASH_FILE||'/run/secrets/password_hash','utf8').trim();
await initializePhysics();const {app}=await createApp(hash,process.env.ORIGIN||'https://bug.engineer');
await app.listen({port:Number(process.env.PORT||8080),host:'0.0.0.0'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await app.close();process.exit(0);});
