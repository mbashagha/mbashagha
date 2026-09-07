import * as T from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import {buildBorders} from './sim-borders.js?v=17';
import { OBSTACLES } from './sim-world.mjs';

export function buildScenery(scene,random,maps){
 const existing=new Set(scene.children),materialCache=new Map();
 const mat=(color,r=1,m=0)=>{const key=[color,r,m].join(':');if(!materialCache.has(key))materialCache.set(key,new T.MeshStandardMaterial({color,roughness:r,metalness:m}));return materialCache.get(key);};
 const cream=mat(0xd6c8aa),stone=mat(0xbab4a0),dark=mat(0x243b32),wood=mat(0x73604a),trunk=mat(0x65513d),soil=mat(0x544831);
 wood.map=maps.woodColor||null;if(wood.map)wood.color.set(0xffffff);wood.normalMap=maps.woodNormal||null;wood.roughnessMap=maps.woodRoughness||null;
 cream.map=maps.plaster;cream.color.set(0xf0e1c7);const wallBump=maps.plaster.clone();wallBump.colorSpace=T.NoColorSpace;wallBump.needsUpdate=true;cream.bumpMap=wallBump;cream.bumpScale=.025;
 stone.map=maps.paving;stone.color.set(0xf1ead9);const stoneBump=maps.paving.clone();stoneBump.colorSpace=T.NoColorSpace;stoneBump.needsUpdate=true;stone.bumpMap=stoneBump;stone.bumpScale=.025;trunk.map=maps.bark;trunk.color.set(0xc4ad94);const barkBump=maps.bark.clone();barkBump.colorSpace=T.NoColorSpace;barkBump.needsUpdate=true;trunk.bumpMap=barkBump;trunk.bumpScale=.06;
 const box=(x,y,z,w,h,d,m)=>{const geom=new T.BoxGeometry(w,h,d);if(m===cream||m===stone){const uv=geom.attributes.uv;for(let i=0;i<uv.count;i++){const face=Math.floor(i/4),sx=face<2?d:w,sy=face===2||face===3?d:h;uv.setXY(i,uv.getX(i)*sx/2,uv.getY(i)*sy/2);}}const o=new T.Mesh(geom,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;};
 box(0,-.12,0,120,.15,120,mat(0x536b34));
 // A pale stone perimeter and warm plaster enclosure make the scale legible.
 for(const x of [-10.6,10.6]){box(x,.025,0,1.15,.12,27,stone);box(x*1.17,1.2,0,.35,2.4,31,cream);box(x*1.17,2.43,0,.50,.12,31,stone);}
 for(const z of [-12.6,12.6])box(0,.025,z,22,.12,1.1,stone);
 for(let z=-13;z<=13;z+=.7)for(const x of [-10.6,10.6])box(x,.089,z,1.14,.012,.012,mat(0x877f6c));
 box(0,1.2,-14.2,25,2.4,.28,cream);box(0,2.43,-14.2,25,.12,.5,stone);
 box(0,.12,16,25,.2,6,stone);
 // An open building shell gives the glazing real rooms to look into.
 box(-9.42,2.35,19,.36,4.7,7,cream);
 box(8.22,2.35,19,.36,4.7,7,cream);
 box(-.6,2.35,22.32,18,4.7,.36,cream);
 box(-.6,.25,19,18,.12,7,stone);
 box(-.6,4.46,19,18,.25,7,cream);
 box(-.6,4.55,15.56,18,.30,.35,cream);
 for(const x of [-8.25,-5.15,-2.05,1.05,4.15,7.25])box(x,2.35,15.56,.65,4.4,.38,cream);
 box(-8.98,2.35,15.56,1.24,4.4,.38,cream);
 box(7.98,2.35,15.56,.84,4.4,.38,cream);
 box(-.6,4.76,19,18.35,.20,7.3,stone);
 const glass=new T.MeshPhysicalMaterial({color:0xe4eee9,roughness:.09,metalness:0,transparent:true,opacity:.24,depthWrite:false,clearcoat:1,clearcoatRoughness:.08});
 glass.envMapIntensity=2;const curtain=mat(0xc8c3ae),inside=mat(0x827763);
 for(const x of [-6.7,-3.6,-.5,2.6,5.7]){
  for(const side of [-1,1])box(x+side*1.18,2.35,15.40,.065,4.2,.10,dark);
  for(const y of [.28,4.42])box(x,y,15.40,2.43,.065,.10,dark);
  const pane=box(x,2.35,15.43,2.29,4.06,.018,glass);pane.castShadow=false;
  box(x,2.35,15.36,.045,4.12,.08,dark);
  // Curtains sit behind the pane, with vertical folds instead of opaque front strips.
  for(const side of [-1,1])for(let fold=0;fold<7;fold++)box(x+side*(.91+fold*.035),2.30,15.81+Math.sin(fold*1.8)*.025,.048,3.92,.045,curtain);
 }
 // Furnished rooms establish depth, occlusion and believable window silhouettes.
 box(-1.4,2.25,20.3,.18,4.1,4,cream);
 const upholstery=mat(0xc2b6a0),rug=mat(0xaaa08a);
 box(3.8,.33,19.3,5.6,.018,3.6,rug);
 box(4.0,.62,20.4,3.8,.50,1.0,upholstery);
 box(4.0,1.08,20.8,3.8,.80,.25,upholstery);
 for(const x of [2.1,5.9])box(x,.95,20.4,.20,.65,1.0,upholstery);
 box(3.8,.63,18.8,2.1,.08,.95,wood);
 for(const x of [3,4.6])box(x,.47,18.8,.065,.30,.7,dark);
 box(-5.5,.98,19.2,3.4,.10,1.1,wood);
 for(const x of [-6.9,-4.1])box(x,.63,19.2,.09,.60,.8,dark);
 box(-5.4,1.15,22.02,4.5,1.7,.30,inside);
 // Slatted pergola and long table, visible at the far end of the lawn.
 for(const x of [-6,6])for(const z of [13.1,16.4])box(x,1.5,z,.14,3,.14,wood);
 for(let x=-6.25;x<6.4;x+=.37)box(x,3.05,14.7,.12,.16,4.2,wood);
 box(0,3.0,13.1,12.7,.2,.15,wood);box(0,3.0,16.4,12.7,.2,.15,wood);
 box(0,.79,14.7,3.7,.08,.95,wood);for(const x of [-1.5,1.5])box(x,.39,14.7,.08,.78,.72,dark);
 for(const z of [13.8,15.6]){box(0,.45,z,3.8,.07,.35,wood);for(const x of [-1.5,1.5])box(x,.23,z,.09,.45,.28,dark);}
 // Terrace furnishings and planted pots give the house a lived-in depth.
 const cushion=mat(0xb9b6a1),potMat=mat(0xa8a493);
 for(const x of [-4.7,4.7]){
  box(x,.53,14.5,1.20,.22,.72,cushion);box(x,.88,14.85,1.20,.53,.16,cushion);
  for(const side of [-1,1]){box(x+side*.66,.65,14.5,.075,.12,.85,wood);for(const z of [14.18,14.8])box(x+side*.53,.27,z,.06,.53,.06,wood);}
 }
 for(const [x,z,r] of [[-7.5,13.9,.43],[7.3,13.9,.48],[-3.2,15.0,.28],[3.2,15.0,.30]]){
  const points=[[.12,0],[r*.70,.04],[r,.22],[r*.97,.55],[r*.90,.60],[r*.81,.58],[r*.82,.53]].map(p=>new T.Vector2(...p));
  const pot=new T.Mesh(new T.LatheGeometry(points,24),potMat);pot.position.set(x,.23,z);pot.castShadow=true;pot.receiveShadow=true;scene.add(pot);
  const soilTop=new T.Mesh(new T.CylinderGeometry(r*.82,r*.82,.04,24),soil);soilTop.position.set(x,.77,z);scene.add(soilTop);
  for(let n=0;n<24;n++){const a=n*2.399,leaf=new T.Mesh(new T.SphereGeometry(1,7,5),mat(n%2?0x627448:0x7b8656));leaf.position.set(x+Math.sin(a)*r*.48,.87+(n%6)*.063,z+Math.cos(a)*r*.48);leaf.scale.set(.075,.18,.05);leaf.rotation.z=Math.sin(a)*.8;leaf.rotation.x=Math.cos(a)*.8;leaf.castShadow=true;scene.add(leaf);}
 }
 for(const x of [-6,6]){const light=new T.PointLight(0xffce91,0,7,2);light.position.set(x,2.5,14.8);light.userData.gardenLamp=true;scene.add(light);}
 // Leaves are true small meshes, combined into an instanced draw call per tree.
 const leafGeo=new T.BufferGeometry(),leafP=[],leafI=[];
 for(let j=0;j<=6;j++)for(let i=0;i<3;i++){const t=j/6,w=Math.sin(t*Math.PI)*.56,x=(i-1)*w;leafP.push(x,Math.sin(t*Math.PI)*(.08+(i===1?.08:0)),t*2-1);if(j<6&&i<2){const k=j*3+i;leafI.push(k,k+3,k+1,k+1,k+3,k+4);}}
 leafGeo.setAttribute('position',new T.Float32BufferAttribute(leafP,3));leafGeo.setIndex(leafI);leafGeo.computeVertexNormals();const leafMat=mat(0xffffff);leafMat.side=T.DoubleSide;
 function tree(x,z,size=1){
  const parts=[],tips=[];
  function branch(points,radius,segments=12){
   const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),geo=new T.TubeGeometry(curve,segments,radius,9,false),pos=geo.attributes.position;
   for(let j=0;j<=segments;j++){const t=j/segments,center=curve.getPointAt(t);for(let k=0;k<=9;k++){const i=j*10+k,point=new T.Vector3().fromBufferAttribute(pos,i);const scale=(1-.77*t)*(.91+.14*Math.sin(k*4.3+j*.83));point.sub(center).multiplyScalar(scale).add(center);pos.setXYZ(i,point.x,point.y,point.z);}}
   geo.computeVertexNormals();parts.push(geo);
  }
  branch([[x,0,z],[x+.11*size,.65*size,z-.07*size],[x-.12*size,1.35*size,z+.1*size],[x+.08*size,2.6*size,z]],.27*size,18);
  for(let j=0;j<6;j++){const a=j*2.399+random()*.3;branch([[x+Math.sin(a)*.85*size,.012,z+Math.cos(a)*.85*size],[x+Math.sin(a)*.35*size,.13*size,z+Math.cos(a)*.35*size],[x,.42*size,z]],.10*size,8);}
  for(let b=0;b<7;b++){
   const a=b*2.399,dx=Math.sin(a),dz=Math.cos(a),h=(2.7+random()*.7)*size;
   const end=[x+dx*(1.15+random()*.45)*size,h,z+dz*1.55*size];
   branch([[x,1.2*size,z],[x+dx*.45*size,1.9*size,z+dz*.35*size],[x+dx*.85*size,h-.5*size,z+dz*.95*size],end],.125*size,12);
   for(let j=0;j<3;j++){const aa=a+(j-1)*.85,tip=[end[0]+Math.sin(aa)*.55*size,h+(.15+random()*.4)*size,end[2]+Math.cos(aa)*.55*size];branch([[end[0]-dx*.4*size,h-.25*size,end[2]-dz*.4*size],end,tip],.039*size,6);tips.push(tip);}
  }
  const branches=new T.Mesh(mergeGeometries(parts),trunk);branches.castShadow=true;branches.receiveShadow=true;scene.add(branches);parts.forEach(g=>g.dispose());
  const count=6500,leaves=new T.InstancedMesh(leafGeo,leafMat,count),dummy=new T.Object3D(),color=new T.Color();
  for(let i=0;i<count;i++){const c=tips[i%tips.length],a=random()*Math.PI*2,r=Math.pow(random(),.55)*.85*size,yy=(random()-.5)*.9*size;dummy.position.set(c[0]+Math.sin(a)*r,c[1]+yy,c[2]+Math.cos(a)*r);dummy.rotation.set(random()*3,random()*6,random()*3);dummy.scale.set(.064*size,.047*size,.125*size);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leaves.setColorAt(i,color.setHSL(.19+random()*.065,.16+random()*.22,.23+random()*.20,T.SRGBColorSpace));}leaves.castShadow=true;leaves.receiveShadow=true;scene.add(leaves);
 }
 OBSTACLES.forEach(o=>{const ring=new T.Mesh(new T.CylinderGeometry(o.r,o.r,.06,48),soil);ring.position.set(o.x,.02,o.z);ring.receiveShadow=true;scene.add(ring);tree(o.x,o.z,1.15);});
 for(let i=0;i<11;i++)tree(i%2?-15:15,-14+i*3,1.65+random()*.6);
 for(let i=0;i<8;i++)tree(-18+i*5,-19,1.6+random()*.7);
 for(let i=0;i<9;i++)tree(-20+i*5,25,1.7+random()*.7);
 buildBorders(scene,random,maps);
 // Bake immobile architecture and branches into material batches.
 const batches=new Map();for(const child of [...scene.children]){if(existing.has(child)||!child.isMesh||child.isInstancedMesh||Array.isArray(child.material))continue;child.updateMatrixWorld();const key=child.material.uuid+':'+child.castShadow;if(!batches.has(key))batches.set(key,{mat:child.material,castShadow:child.castShadow,geometry:[]});batches.get(key).geometry.push(child.geometry.clone().applyMatrix4(child.matrixWorld));scene.remove(child);child.geometry.dispose();}
 for(const batch of batches.values()){const combined=mergeGeometries(batch.geometry);if(!combined)throw new Error('Scenery geometry batch failed');const mesh=new T.Mesh(combined,batch.mat);mesh.castShadow=batch.castShadow;mesh.receiveShadow=true;scene.add(mesh);batch.geometry.forEach(g=>g.dispose());}

}

export function buildMower(){
 const root=new T.Group(),wheels=[];
 const red=new T.MeshStandardMaterial({color:0xb74827,metalness:.45,roughness:.33});
 const metal=new T.MeshStandardMaterial({color:0x767d79,metalness:.87,roughness:.23});
 const black=new T.MeshStandardMaterial({color:0x1c2521,roughness:.7});
 const rubber=new T.MeshStandardMaterial({color:0x151916,roughness:1});
 function add(g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;}
 add(new RoundedBoxGeometry(.69,.16,.84,4,.07),red,0,.2,0);
 add(new RoundedBoxGeometry(.73,.055,.86,3,.025),black,0,.125,0);
 add(new RoundedBoxGeometry(.32,.22,.35,4,.055),black,0,.36,-.03);
 add(new T.CylinderGeometry(.12,.14,.06,32),metal,0,.5,.02);
 add(new T.CylinderGeometry(.029,.029,.04,16),black,.13,.46,-.12);
 for(let i=0;i<9;i++)add(new T.BoxGeometry(.21,.009,.008),metal,0,.485,-.08+i*.02);
 for(const x of [-.39,.39])for(const z of [-.28,.28]){
  const wheel=new T.Group();wheel.position.set(x,.16,z);root.add(wheel);wheels.push(wheel);
  const tire=new T.Mesh(new T.CylinderGeometry(.16,.16,.105,32),rubber);tire.rotation.z=Math.PI/2;tire.castShadow=true;wheel.add(tire);
  const hub=new T.Mesh(new T.CylinderGeometry(.093,.093,.109,16),metal);hub.rotation.z=Math.PI/2;wheel.add(hub);
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2;const tread=new T.Mesh(new T.BoxGeometry(.112,.017,.042),rubber);tread.position.set(0,Math.sin(a)*.158,Math.cos(a)*.158);tread.rotation.x=-a;wheel.add(tread);}
 }
 function tube(a,b,r,mat){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const o=add(new T.CylinderGeometry(r,r,d.length(),12),mat,...av.clone().add(bv).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());}
 for(const s of [-1,1]){tube([s*.25,.28,-.25],[s*.245,1.08,-.55],.017,metal);tube([s*.245,1.08,-.55],[s*.245,1.10,-.6],.023,black);}
 tube([-.27,1.08,-.55],[.27,1.08,-.55],.026,black);
 add(new RoundedBoxGeometry(.45,.29,.30,3,.04),black,0,.28,-.42);
 const cable=new T.CatmullRomCurve3([new T.Vector3(.2,1.08,-.55),new T.Vector3(.24,.74,-.61),new T.Vector3(.2,.41,-.34),new T.Vector3(.12,.4,-.1)]);
 add(new T.TubeGeometry(cable,24,.006,5,false),black,0,0,0);
 for(const x of [-.26,.26])for(const z of [-.3,.3])add(new T.CylinderGeometry(.018,.018,.012,6),metal,x,.286,z);
 return {root,wheels};
}
