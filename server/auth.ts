import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export interface Session {expires:number;player?:number}
export class Auth {
 sessions=new Map<string,Session>();attempts=new Map<string,{count:number;until:number}>();
 constructor(public hash:string,public origin:string){if(!/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash))throw Error('Missing or invalid password hash: fail closed');}
 async verify(password:string){const [salt,hash]=this.hash.split(':');const actual=await scrypt(password,salt,32) as Buffer;return timingSafeEqual(actual,Buffer.from(hash,'hex'));}
 create(now=Date.now()){const token=randomBytes(32).toString('hex');this.sessions.set(token,{expires:now+8*3600000});return token;}
 token(cookie=''){return cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('qs='))?.slice(3)||'';}
 get(cookie='',now=Date.now()){const token=this.token(cookie),s=this.sessions.get(token);if(!s||s.expires<=now)return null;return s;}
 allow(ip:string,now=Date.now()){if(this.attempts.size>10000){for(const [k,v]of this.attempts)if(v.until<now)this.attempts.delete(k);if(this.attempts.size>10000)return false;}let a=this.attempts.get(ip);if(!a||a.until<=now){a={count:0,until:now+60000};this.attempts.set(ip,a);}return ++a.count<=5;}
 cookie(token:string,maxAge=28800){return `qs=${token}; Path=/quickscope; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;}
}
