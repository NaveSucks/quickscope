import type {MapDefinition,Vec} from './types.ts';
const boxes:MapDefinition['boxes']=[];
function box(id:string,x:number,y:number,z:number,w:number,h:number,d:number,color=0x88877c,material='concrete'){boxes.push({id,p:{x,y,z},s:{x:w,y:h,z:d},color,material});}
// Metres, Y up; north office at -Z. Authored render and collision source.
// Roof strips leave the central excavation open to the lower connector.
box('west-roof',-15,-.5,0,14,1,54);box('east-roof',15,-.5,0,14,1,54);
box('north-apron',0,-.5,-20,16,1,14);box('south-apron',0,-.5,20,16,1,14);
box('lower-connector',0,-4.5,0,16,1,66,0x565952);
box('lower-west-wall',-8.3,-2.5,0,.6,4,27);box('lower-east-wall',8.3,-2.5,0,.6,4,27);
box('helipad',0,0,0,15,1,15,0x626d65,'roof');
for(const side of [-1,1]){
 const z=side*33;box(`${side}-office-floor`,0,-.5,z,44,1,16,0x777b75);
 box(`${side}-office-roof`,0,5,z,44,.6,16,0x73756d,'roof');
 box(`${side}-back-wall`,0,2.4,side*41,44,5,.5,0x536361);
 for(const x of [-22,22])box(`${side}-side-${x}`,x,2.4,z,.5,5,16,0x657473);
 for(const x of [-20,-10,0,10,20])box(`${side}-front-pillar-${x}`,x,2.3,side*25,.7,5,.7,0x586561);
 for(const x of [-14,14]){box(`${side}-partition-${x}`,x,1.6,side*35,.3,3.2,8);box(`${side}-desk-${x}`,x,0.5,side*30,4,1,1.6,0x61594c,'wood');}
 box(`${side}-interior-divider`,0,1.7,side*36,14,3.4,.35);
 // Stair flights on each end of excavation, open to office/apron.
 for(let n=0;n<16;n++)box(`${side}-stairs-${n}`,0,-4+(n+1)*.25/2,side*(14+n*.55),5,(n+1)*.25,.55,0x71776f);
}
box('utility',14,1.4,-9,8,2.8,7,0x7b8174);box('utility-roof',14,2.9,-9,8.4,.25,7.4,0x585e54,'roof');
box('air-plant',-14,1.5,10,7,3,7,0x6c766f);box('air-plant-top',-14,3.1,10,7.5,.25,7.5,0x4d5b55,'roof');
for(const [x,z] of [[-13,-12],[12,12],[-17,0],[17,20]]){box(`crate-${x}-${z}`,x,.85,z,3,1.7,2,0x877659,'wood');}
// East crane: walkable main boom, raised spine, access ladder and office ledge.
box('crane-base',24,2,-14,3,4,3,0xa0863d,'rust');box('crane-walk',24,4,1,2,.3,33,0xb89844,'rust');
for(const z of [-13,-5,3,11,17]){box(`crane-upright-${z}`,24,5.2,z,.3,2.3,.3,0x9b792c,'rust');}
box('crane-spine',24,6.4,1,.35,.3,33,0xa7893d,'rust');
box('east-office-ledge',22.65,4,28,1.3,.25,24,0x96978b);box('east-ledge-link',23.4,4,17,2.8,.3,2);
// West suspended scaffolding and precarious perimeter path to the opposite roof.
box('scaffold-start',-23.5,1,-18,2,.3,5,0x9a8c69,'rust');box('scaffold-high',-23.5,3,-24,2,.3,4,0x9a8c69,'rust');
box('west-roof-ledge',-22.7,3.8,-33,1.4,.25,16,0x94968b);box('north-roof-ledge',0,3.8,-41.6,46,.25,1.3,0x94968b);
for(const x of [-23,23])for(const z of [-40,-26])box(`roof-post-${x}-${z}`,x,1,z,.2,9,.2,0x686c62,'rust');
export const map:MapDefinition={id:'highrise-greybox',boxes,spawns:[{x:-17,y:1,z:-37},{x:17,y:1,z:37},{x:17,y:1,z:-37},{x:-17,y:1,z:37},{x:-18,y:1,z:20},{x:18,y:1,z:-20},{x:3,y:-3,z:8},{x:-3,y:-3,z:-8}],ladders:[{p:{x:23,y:0,z:-14},top:5},{p:{x:-23.5,y:1,z:-20},top:4.8}],mantles:[{p:{x:-22.4,y:3.8,z:-39},target:{x:-20.8,y:6.2,z:-39}},{p:{x:22.5,y:4,z:35},target:{x:20.8,y:6.2,z:35}},{p:{x:14,y:0,z:-4.8},target:{x:14,y:3.9,z:-6}}]};
export function rayBox(o:Vec,d:Vec,p:Vec,s:Vec):number{
 let lo=0,hi=250;for(const k of ['x','y','z'] as const){if(Math.abs(d[k])<1e-8){if(o[k]<p[k]-s[k]/2||o[k]>p[k]+s[k]/2)return Infinity;}else{let a=(p[k]-s[k]/2-o[k])/d[k],b=(p[k]+s[k]/2-o[k])/d[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return Infinity;}}return lo;
}
export function wallDistance(o:Vec,d:Vec){let t=250;for(const b of boxes)t=Math.min(t,rayBox(o,d,b.p,b.s));return t;}
