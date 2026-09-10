import {Physics} from '../shared/physics.ts';
import {map,rayBox,wallDistance} from '../shared/map.ts';
import {mode,weapons,updateWeapon} from '../shared/weapons.ts';
import {type PlayerState,type Input,type Phase,type Snapshot,type GameEvent,type Vec} from '../shared/types.ts';
export function makePlayer(id:number,name:string,now:number):PlayerState{return {id,name,p:{...map.spawns[0]},vy:0,grounded:false,crouch:false,yaw:0,pitch:0,health:100,kills:0,deaths:0,weapon:0,guns:weapons.map(w=>({ammo:w.magazine,ready:0,reloadEnd:0})),ads:0,switchEnd:0,protectedUntil:now+1000,respawnAt:0,lastDamage:now,ack:0};}
export class Room {
 physics=new Physics();players=new Map<number,PlayerState>();queues=new Map<number,Input[]>();lastInput=new Map<number,Input>();lastReceived=new Map<number,number>();history:Snapshot[]=[];events:GameEvent[]=[];phase:Phase='waiting';until=0;now=0;nextId=1;winner=0;impact=0;replaySent=false;
 emit:(e:GameEvent)=>void=()=>{};
 event(e:GameEvent){this.events.push(e);this.emit(e);}
 add(name:string){if(this.players.size>=mode.capacity)return null;const p=makePlayer(this.nextId++,name,this.now);this.players.set(p.id,p);this.queues.set(p.id,[]);this.spawn(p);if(this.phase==='replay'||this.phase==='results'){p.health=0;p.respawnAt=Infinity;}return p;}
 remove(id:number){this.players.delete(id);this.queues.delete(id);this.lastInput.delete(id);this.lastReceived.delete(id);this.physics.remove(id);}
 input(id:number,i:Input){const q=this.queues.get(id);if(!q||i.seq<=(this.lastReceived.get(id)||0)||q.length>=12||i.time>this.now+100||i.time<this.now-1000)return false;this.lastReceived.set(id,i.seq);q.push(i);return true;}
 snapshot():Snapshot{return {time:this.now,phase:this.phase,until:this.until,players:structuredClone([...this.players.values()])};}
 phaseTo(phase:Phase,duration=0){this.phase=phase;this.until=this.now+duration;this.event({type:'phase',phase,until:this.until});}
 spawn(p:PlayerState){let best=map.spawns[0],score=-Infinity;for(const s of map.spawns){let rank=1000;for(const e of this.players.values()){if(e.id===p.id||e.health<=0)continue;const dx=e.p.x-s.x,dy=e.p.y-s.y,dz=e.p.z-s.z,dist=Math.hypot(dx,dy,dz);const visible=wallDistance(s,{x:dx/dist,y:dy/dist,z:dz/dist})>=dist;rank=Math.min(rank,dist-(visible?25:0));}if(rank>score){score=rank;best=s;}}const kills=p.kills,deaths=p.deaths,ack=p.ack;Object.assign(p,makePlayer(p.id,p.name,this.now),{p:{...best},kills,deaths,ack});}
 startRound(){for(const p of this.players.values()){p.kills=0;p.deaths=0;this.spawn(p);}this.history=[];this.events=[];this.winner=0;this.replaySent=false;this.phaseTo('active');}
 tick(now:number){this.now=now;
 if(this.phase==='waiting'&&this.players.size>=2)this.phaseTo('countdown',5000);
 if((this.phase==='active'||this.phase==='countdown')&&this.players.size<2)this.phaseTo('waiting');
 if(this.phase==='countdown'&&now>=this.until)this.startRound();
 if(this.phase==='replay'){if(!this.replaySent&&now>=this.impact+500){this.replaySent=true;this.sendReplay();}if(now>=this.until)this.phaseTo('results',5000);}
 if(this.phase==='results'&&now>=this.until){for(const p of this.players.values()){p.kills=0;p.deaths=0;this.spawn(p);}this.phaseTo(this.players.size>=2?'countdown':'waiting',5000);}
 for(const p of this.players.values()){
 const q=this.queues.get(p.id)!;let i=q.shift();if(i){p.ack=i.seq;this.lastInput.set(p.id,i);}else{const prev=this.lastInput.get(p.id);i=prev?{...prev,buttons:now-prev.time>250?0:prev.buttons&~(16|256|512)}:{seq:p.ack,time:now,yaw:p.yaw,pitch:p.pitch,buttons:0,weapon:p.weapon};}
 if(this.phase==='replay'||this.phase==='results')continue;
 if(p.health<=0){if(now>=p.respawnAt)this.spawn(p);else continue;}
 this.physics.move(p,i);if(p.p.y<-15){this.die(p);continue;}
 if(p.health<100&&now-p.lastDamage>=5000)p.health=Math.min(100,p.health+30/60);
 if(updateWeapon(p,i,now,1000/60))this.shoot(p,i);
 }
 if(Math.floor(now/(1000/60))%3===0||!this.history.length){this.history.push(this.snapshot());while(this.history.length&&this.history[0].time<now-8000)this.history.shift();this.events=this.events.filter(e=>!('time'in e)||e.time>=now-8000);}
 }
 shoot(p:PlayerState,i:Input){
 const spread=(p.weapon===0?.055:.023)*(1-p.ads)+(p.grounded?0:.055),yaw=p.yaw+(Math.random()-.5)*spread,pitch=p.pitch+(Math.random()-.5)*spread;
 const d={x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)},from={x:p.p.x,y:p.p.y+(p.crouch?.25:.6),z:p.p.z};let distance=wallDistance(from,d),victim:PlayerState|undefined,pose:PlayerState|undefined,zone:'head'|'upper'|'lower'|'limb'='limb';
 // Rewind only target poses. Never rewind shooter position, cadence, round, or map.
 const rewind=Math.max(this.now-200,Math.min(this.now,i.time));let frame=this.history[0];for(const f of this.history){if(f.time<=rewind)frame=f;else break;}
 for(const target of this.players.values()){
 if(target.id===p.id||target.health<=0||target.protectedUntil>this.now)continue;
 const old=frame?.players.find(t=>t.id===target.id&&t.health>0);const t=old&&old.respawnAt===target.respawnAt?old:target;
 for(const [part,offset,size] of [['head',.62,{x:.4,y:.4,z:.4}],['upper',.18,{x:.62,y:.48,z:.4}],['lower',-.2,{x:.5,y:.3,z:.4}],['limb',-.58,{x:.64,y:.5,z:.42}]] as const){const hit=rayBox(from,d,{x:t.p.x,y:t.p.y+offset-(t.crouch?.3:0),z:t.p.z},size);if(hit<distance){distance=hit;victim=target;pose=structuredClone(t);zone=part;}}
 }
 const to={x:from.x+d.x*distance,y:from.y+d.y*distance,z:from.z+d.z*distance};
 this.event({type:'shot',time:this.now,id:p.id,weapon:p.weapon,from,to,hit:victim?.id,pose});
 if(victim&&this.phase==='active'){victim.health-=weapons[p.weapon].damage[zone];victim.lastDamage=this.now;if(victim.health<=0)this.die(victim,p);}
 }
 die(p:PlayerState,killer?:PlayerState){if(p.health<=0&&p.respawnAt>this.now)return;p.health=0;p.deaths++;p.respawnAt=this.now+mode.respawnMs;this.event({type:'death',time:this.now,id:p.id,killer:killer?.id});if(killer&&this.phase==='active'){killer.kills++;if(killer.kills>=mode.target){this.winner=killer.id;this.impact=this.now;this.phaseTo('replay',9500);}}}
 sendReplay(){const frames=this.history.filter(f=>f.time>=this.impact-3000&&f.time<=this.impact+500),events=this.events.filter(e=>'time'in e&&e.time>=this.impact-3000&&e.time<=this.impact+500);const chunks=Math.ceil(frames.length/4);for(let index=0;index<chunks;index++)this.emit({type:'replay',index,total:chunks,winner:this.winner,impact:this.impact,frames:frames.slice(index*4,index*4+4),events:index===0?structuredClone(events):[]});}
}
