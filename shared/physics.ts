import RAPIER from '@dimforge/rapier3d-compat';
import {map} from './map.ts';
import {B,type PlayerState,type Input} from './types.ts';
export const DT=1/60;
export async function initializePhysics(){await RAPIER.init();}
export class Physics {
 world=new RAPIER.World({x:0,y:-22,z:0});
 controller=this.world.createCharacterController(.02);
 characters=new Map<number,RAPIER.Collider>();
 constructor(){for(const b of map.boxes)this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.s.x/2,b.s.y/2,b.s.z/2).setTranslation(b.p.x,b.p.y,b.p.z));this.controller.enableAutostep(.32,.15,false);this.controller.enableSnapToGround(.25);this.world.step();}
 remove(id:number){const c=this.characters.get(id);if(c)this.world.removeCollider(c,true);this.characters.delete(id);}
 move(p:PlayerState,i:Input){
 let c=this.characters.get(p.id);if(!c){c=this.world.createCollider(RAPIER.ColliderDesc.capsule(.55,.3).setTranslation(p.p.x,p.p.y,p.p.z).setSensor(true));this.characters.set(p.id,c);}
 // Collider remains full height when crouching; crouch is a speed/eye-height stance in v1.
 c.setTranslation(p.p);p.crouch=!!(i.buttons&B.crouch);p.yaw=i.yaw;p.pitch=i.pitch;
 const speed=p.crouch?2.5:(i.buttons&B.sprint)&&!(i.buttons&B.ads)?8.4:(i.buttons&B.ads)?3.6:5.6;
 let x=Number(!!(i.buttons&B.right))-Number(!!(i.buttons&B.left)),z=Number(!!(i.buttons&B.back))-Number(!!(i.buttons&B.forward));const len=Math.hypot(x,z)||1;x/=len;z/=len;
 if(p.grounded&&i.buttons&B.jump)p.vy=8.0;else p.vy=Math.max(-35,p.vy-22*DT);
 const ladder=map.ladders.find(l=>Math.hypot(p.p.x-l.p.x,p.p.z-l.p.z)<1.5&&p.p.y>l.p.y-.5&&p.p.y<l.top);
 if(ladder&&i.buttons&B.forward)p.vy=4;
 const mantle=map.mantles.find(m=>Math.hypot(p.p.x-m.p.x,p.p.z-m.p.z)<1.3&&Math.abs(p.p.y-(m.p.y+.85))<1.1);
 if(mantle&&i.buttons&B.jump){const dx=mantle.target.x-p.p.x,dz=mantle.target.z-p.p.z;x=dx*1.5;z=dz*1.5;p.vy=7;}
 const desired={x:(x*Math.cos(i.yaw)+z*Math.sin(i.yaw))*speed*DT,y:p.vy*DT,z:(z*Math.cos(i.yaw)-x*Math.sin(i.yaw))*speed*DT};
 this.controller.computeColliderMovement(c,desired,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);const m=this.controller.computedMovement();p.p={x:p.p.x+m.x,y:p.p.y+m.y,z:p.p.z+m.z};p.grounded=this.controller.computedGrounded();if(p.grounded&&p.vy<0)p.vy=0;c.setTranslation(p.p);
 }
 free(){this.world.free();}
}
