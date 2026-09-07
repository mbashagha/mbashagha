import * as T from 'three';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';

// Layered planting keeps every view inside a continuous, inhabited garden.
export function buildBorders(scene,random,maps){
 const dummy=new T.Object3D(),color=new T.Color();
 const material=(color)=>new T.MeshStandardMaterial({color,roughness:1});
 const earth=material(0x393425),rock=material(0xd6d1c2),edging=material(0x8f8166);
 rock.normalMap=maps.stoneNormal||null;rock.normalScale.set(.4,.4);rock.roughnessMap=maps.stoneRoughness||null;rock.map=maps.limestone;rock.color.set(0xffffff);const relief=maps.limestone.clone();relief.colorSpace=T.NoColorSpace;relief.needsUpdate=true;if(!maps.stoneNormal){rock.bumpMap=relief;rock.bumpScale=.016;}
 function instances(geo,mat,count,place,shadow=true){const mesh=new T.InstancedMesh(geo,mat,count);for(let i=0;i<count;i++){dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);place(i,dummy,mesh);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.castShadow=shadow;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
 const edge=(z)=>10.15+.24*Math.sin(z*.34)+.14*Math.cos(z*.67);
 // Narrow brick course traces the edge; deep earth beds continue behind it.
 instances(new T.BoxGeometry(1,1,1),earth,3,(i,d)=>{if(i<2){d.position.set(i?11.8:-11.8,-.035,0);d.scale.set(3.8,.14,28);}else{d.position.set(0,-.035,-13.4);d.scale.set(26,.14,3);}});
 instances(new RoundedBoxGeometry(1,1,1,2,.08),edging,244,(i,d)=>{if(i<160){const side=i<80?-1:1,z=-12.5+(i%80)*.33;d.position.set(side*edge(z),.06,z);d.rotation.y=-side*(.0816*Math.cos(z*.34)-.0938*Math.sin(z*.67));d.scale.set(.25,.10,.315);}else{d.position.set(-13.5+(i-160)*.325,.06,-12.05);d.scale.set(.31,.10,.25);} });
 // Staggered, individually varied masonry breaks up the flat wall surface.
 const stoneGeo=new RoundedBoxGeometry(1,1,1,4,.075),stonePos=stoneGeo.attributes.position;
 for(let i=0;i<stonePos.count;i++){const x=stonePos.getX(i),y=stonePos.getY(i),z=stonePos.getZ(i);const f=Math.sin(x*31+y*19+z*23)*Math.sin(x*13-y*37+z*17)*.025;stonePos.setXYZ(i,x+f,y+f*.7,z+f);}stoneGeo.computeVertexNormals();
 instances(stoneGeo,rock,1440,(i,d,m)=>{
  const face=Math.floor(i/480),n=i%480,row=Math.floor(n/60),col=n%60;
  const along=-14+col*.49+(row%2)*.245;
  d.position.set(face===0?-12.24:face===1?12.24:along,.15+row*.29+(col%3-1)*.011,face===2?-14.05:along);
  d.scale.set(face===2?.455+random()*.025:.28+random()*.08,.251+random()*.033,face===2?.30:.465);
  d.rotation.set((random()-.5)*.025,(random()-.5)*.025,(random()-.5)*.025);
  m.setColorAt(i,color.setHSL(.105+random()*.018,.12+random()*.12,.66+random()*.19,T.SRGBColorSpace));
 });
 const leaves=new T.BufferGeometry();leaves.setAttribute('position',new T.Float32BufferAttribute([0,0,-1,-.58,.10,-.35,-.66,.12,.2,0,.22,.85,.66,.12,.2,.58,.1,-.35,0,.19,0],3));leaves.setIndex([0,1,6,1,2,6,2,3,6,3,4,6,4,5,6,5,0,6]);leaves.computeVertexNormals();
 const foliage=material(0xffffff);foliage.side=T.DoubleSide;
 // Shrub forms are made from overlapping leaves, never solid cones.
 const shrubs=[];for(let i=0;i<210;i++){let x,z;if(i<150){z=-12+(i%75)*.35;x=(i<75?-1:1)*(edge(z)+.48+random()*1.25);}else{x=-11+(i-150)*.38;z=-12.6-random()*.8;}shrubs.push({x,z,h:.3+random()*.64,r:.32+random()*.4,hue:.19+random()*.10});}
 instances(leaves,foliage,210*260,(i,d,m)=>{const c=shrubs[Math.floor(i/260)],a=random()*6.283,t=random(),r=Math.sqrt(random())*c.r;d.position.set(c.x+Math.cos(a)*r,c.h*(.2+.8*t),c.z+Math.sin(a)*r);d.rotation.set(random()*2,random()*6.28,random()*2);d.scale.set(.039+random()*.028,.04,.067+random()*.045);m.setColorAt(i,color.setHSL(c.hue,.24+random()*.22,.19+random()*.20,T.SRGBColorSpace));});
 // Purple flower spires and cream daisies are grouped into irregular drifts.
 const bloom=material(0xffffff),stems=material(0x53633c),centres=[];
 for(let i=0;i<145;i++){const c=shrubs[Math.floor(random()*shrubs.length)];centres.push({x:c.x+(random()-.5)*.55,z:c.z+(random()-.5)*.55,h:.40+random()*.5,purple:i%3!==0});}
 instances(new T.CylinderGeometry(.005,.007,1,4),stems,145*5,(i,d)=>{const c=centres[Math.floor(i/5)],a=i*2.399;d.position.set(c.x+Math.cos(a)*.12,c.h*.5,c.z+Math.sin(a)*.12);d.rotation.z=Math.sin(a)*.18;d.scale.y=c.h;},false);
 instances(new T.IcosahedronGeometry(1,1),bloom,145*5*5,(i,d,m)=>{const c=centres[Math.floor(i/25)],n=Math.floor(i/5)%5,j=i%5,a=n*2.399;d.position.set(c.x+Math.cos(a)*.12,c.h-.14+j*.034,c.z+Math.sin(a)*.12);d.scale.set(c.purple?.025:.042,c.purple?.036:.013,c.purple?.025:.042);m.setColorAt(i,color.set(c.purple?(i%2?0x8c83a8:0x71618c):0xe6e1cb));},false);
 // Tall ornamental grasses give the edge fine, backlit silhouettes.
 const blades=new T.BufferGeometry();blades.setAttribute('position',new T.Float32BufferAttribute([-.014,0,0,.014,0,0,-.009,.5,.06,.009,.5,.06,0,1,.24],3));blades.setIndex([0,1,2,1,3,2,2,3,4]);blades.computeVertexNormals();const grass=material(0x9c9b68);grass.side=T.DoubleSide;
 instances(blades,grass,7000,(i,d,m)=>{const clump=Math.floor(i/100),z=-12+(clump%35)*.73,x=(clump<35?-1:1)*(11.0+.35*Math.sin(z));d.position.set(x+(random()-.5)*.4,.04,z+(random()-.5)*.4);d.rotation.y=random()*6.28;d.scale.set(1,.5+random()*.7,1);},false);
 // Dense background hedges hide the horizon between tree trunks.
 instances(leaves,foliage,88000,(i,d,m)=>{const side=Math.floor(i/22000),along=(random()-.5)*36,x=side===0?-14.1-random()*1.5:side===1?14.1+random()*1.5:along,z=side===2?-16.2-random()*1.4:side===3?21.2+random()*1.4:along;d.position.set(x,.8+random()*3.7,z);d.rotation.set(random()*3,random()*6.3,random()*3);d.scale.set(.075,.075,.14);m.setColorAt(i,color.setHSL(.22+random()*.06,.28+random()*.22,.16+random()*.16,T.SRGBColorSpace));});
}
