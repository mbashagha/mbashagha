import * as T from 'three';

export class Clippings {
 constructor(scene){this.particles=[];this.dummy=new T.Object3D();this.mesh=new T.InstancedMesh(new T.PlaneGeometry(.012,.065),new T.MeshStandardMaterial({color:0x62733a,side:T.DoubleSide,roughness:1}),240);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.count=0;this.mesh.frustumCulled=false;scene.add(this.mesh);}
 spawn(x,z,yaw,n){for(let i=0;i<Math.min(n,12)&&this.particles.length<240;i++){const r=Math.random();this.particles.push({x:x+Math.cos(yaw)*.32,y:.18,z:z-Math.sin(yaw)*.32,vx:Math.cos(yaw)*(1+r)+Math.sin(yaw)*.3,vy:1+Math.random(),vz:-Math.sin(yaw)*(1+r)+Math.cos(yaw)*.3,age:0,rot:Math.random()*6});}}
 update(dt){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.age+=dt;p.vy-=5*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.012||p.age>1.2){this.particles.splice(i,1);continue;}}
 this.particles.forEach((p,i)=>{this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(p.rot+p.age*9,p.age*5,p.rot);this.dummy.scale.setScalar(1-p.age*.25);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);});this.mesh.count=this.particles.length;this.mesh.instanceMatrix.needsUpdate=true;}
 reset(){this.particles=[];this.mesh.count=0;}
}

export function makeDestination(scene){const mesh=new T.Mesh(new T.RingGeometry(.16,.19,40),new T.MeshBasicMaterial({color:0xf2edd2,transparent:true,opacity:.75,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.visible=false;scene.add(mesh);return mesh;}
