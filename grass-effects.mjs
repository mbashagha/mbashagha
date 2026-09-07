/** Sparse, recovering wheel compression in lawn coordinates. */
export class WheelTracks {
 constructor(n=256){this.n=n;this.data=new Uint8Array(n*n);this.strength=new Float32Array(n*n);this.active=new Set();this.dirty=false;}
 stamp(x,z,r=.11){const n=this.n,px=(x/20+.5)*n,pz=(z/24+.5)*n;
  for(let iz=Math.floor(pz-r/24*n);iz<=Math.ceil(pz+r/24*n);iz++)for(let ix=Math.floor(px-r/20*n);ix<=Math.ceil(px+r/20*n);ix++){
   if(ix<0||ix>=n||iz<0||iz>=n)continue;
   const d=Math.hypot((ix+.5-px)/n*20,(iz+.5-pz)/n*24);if(d>r)continue;
   const i=iz*n+ix;this.strength[i]=255;this.data[i]=255;this.active.add(i);this.dirty=true;
  }
 }
 sweep(a,b){const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<.0001)return;const steps=Math.ceil(length/.06),ox=dz/length*.34,oz=-dx/length*.34;
  for(let j=0;j<=steps;j++){const x=a.x+dx*j/steps,z=a.z+dz*j/steps;this.stamp(x+ox,z+oz);this.stamp(x-ox,z-oz);}
 }
 update(dt){let changed=this.dirty;this.dirty=false;for(const i of this.active){this.strength[i]=Math.max(0,this.strength[i]-dt*255/6);const value=Math.round(this.strength[i]);if(value!==this.data[i]){this.data[i]=value;changed=true;}if(!value)this.active.delete(i);}return changed;}
}
