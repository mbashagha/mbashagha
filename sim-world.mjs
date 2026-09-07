export const LAWN = { width: 20, depth: 24, resolution: 160 };
export const OBSTACLES = [{x:-6.3,z:-4.6,r:1.1},{x:6.4,z:5.7,r:1.15}];
export const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
export function free(x,z,pad=0) { return Math.abs(x)<LAWN.width/2-pad && Math.abs(z)<LAWN.depth/2-pad && OBSTACLES.every(o=>Math.hypot(x-o.x,z-o.z)>o.r+pad); }
export class LawnState {
 constructor(){this.n=LAWN.resolution;this.mask=new Uint8Array(this.n*this.n);this.valid=new Uint8Array(this.mask.length);this.total=0;this.count=0;for(let z=0;z<this.n;z++)for(let x=0;x<this.n;x++){const i=z*this.n+x;if(free((x+.5)/this.n*LAWN.width-LAWN.width/2,(z+.5)/this.n*LAWN.depth-LAWN.depth/2)){this.valid[i]=1;this.total++;}else this.mask[i]=255;}}
 cut(x,z,r=.39){const n=this.n;let changed=0;const x0=clamp(Math.floor((x-r+LAWN.width/2)/LAWN.width*n),0,n-1),x1=clamp(Math.ceil((x+r+LAWN.width/2)/LAWN.width*n),0,n-1),z0=clamp(Math.floor((z-r+LAWN.depth/2)/LAWN.depth*n),0,n-1),z1=clamp(Math.ceil((z+r+LAWN.depth/2)/LAWN.depth*n),0,n-1);for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){const i=iz*n+ix,px=(ix+.5)/n*LAWN.width-LAWN.width/2,pz=(iz+.5)/n*LAWN.depth-LAWN.depth/2;if(this.valid[i]&&!this.mask[i]&&Math.hypot(px-x,pz-z)<r){this.mask[i]=255;this.count++;changed++;}}return changed;}
 sweep(a,b,r=.39){const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.08));let c=0;for(let i=0;i<=steps;i++)c+=this.cut(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,r);return c;}
 get ratio(){return this.count/this.total;}
 get area(){return this.count/(this.n*this.n)*LAWN.width*LAWN.depth;}
 reset(){for(let i=0;i<this.mask.length;i++)this.mask[i]=this.valid[i]?0:255;this.count=0;}
}
export function moveRig(state,throttle,steer,dt){
 dt=clamp(dt,0,.04);const desired=throttle*(throttle<0?.55:1.18);state.speed+=(desired-state.speed)*(1-Math.exp(-dt*4));
 const oldYaw=state.yaw;state.yaw+=steer*dt*1.45*(.3+.7*Math.min(1,Math.abs(state.speed)));
 const dx=Math.sin(state.yaw)*state.speed*dt,dz=Math.cos(state.yaw)*state.speed*dt;
 const nx=state.x+dx,nz=state.z+dz;
 const bodyX=nx-Math.sin(state.yaw)*1.05,bodyZ=nz-Math.cos(state.yaw)*1.05;
 if(free(nx,nz,.38)&&free(bodyX,bodyZ,.24)){state.x=nx;state.z=nz;}else{state.yaw=oldYaw;state.speed=0;}
 return state;
}
