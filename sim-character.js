import * as T from 'three';
import {trouserLeg,seam} from './sim-tailoring.js?v=12';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Photo-informed approximation: front texture is generated from Mo's portrait.
// The unseen head/body proportions are authored approximations, not a face scan.
export function createMo(faceMap,fabricMap,hairMap){
 const root=new T.Group(),body=new T.Group();root.add(body);
 const skin=new T.MeshStandardMaterial({color:0xb98262,roughness:.8});
 const weave=fabricMap.clone();weave.colorSpace=T.NoColorSpace;weave.repeat.set(5,5);weave.needsUpdate=true;
 const shirt=new T.MeshPhysicalMaterial({color:0xd4d9c8,roughness:.9,sheen:.5,sheenColor:0xc5c9b6,sheenRoughness:.8,bumpMap:weave,bumpScale:.001});
 const pants=new T.MeshPhysicalMaterial({color:0x98694e,roughness:.94,sheen:.25,sheenColor:0xa87856,sheenRoughness:.9,bumpMap:weave,bumpScale:.001});
 const sole=new T.MeshStandardMaterial({color:0xd5d6c9,roughness:1});
 const shoe=new T.MeshStandardMaterial({color:0xaebbb4,roughness:.95});
 const hair=new T.MeshStandardMaterial({color:0x191715,roughness:.48});
 function ell(parent,x,y,z,sx,sy,sz,mat){const m=new T.Mesh(new T.SphereGeometry(1,24,18),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;}
 function link(parent,a,b,r1,r2,mat){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const m=new T.Mesh(new T.CylinderGeometry(r2,r1,d.length(),18),mat);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());m.castShadow=true;parent.add(m);return m;}
 // Oversized sage tee: dropped shoulders, long hem, and broad hanging folds.
 const pos=[],uv=[],idx=[];
 const profile=new T.CatmullRomCurve3([[.77,.249,.184],[.83,.249,.185],[.94,.246,.175],[1.03,.230,.15],[1.16,.225,.133],[1.33,.249,.132],[1.42,.229,.112],[1.50,.079,.061]].map(v=>new T.Vector3(...v)));
 const rows=56,cols=64;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const t=j/rows,a=i/cols*Math.PI*2,shape=profile.getPoint(t),y=shape.x;
  const drape=Math.max(0,1-Math.pow(t,3)),fold=(Math.sin(a*7+t*1.5)*.009+Math.sin(a*12-t*2)*.003)*drape;
  const backFold=Math.exp(-Math.pow((t-.58)/.28,2))*Math.sin(a*4+t*5)*.004;
  pos.push(Math.sin(a)*(shape.y+fold),y+Math.sin(a*3)*.006*drape,Math.cos(a)*(shape.z+fold+backFold)+.05);
  uv.push(i/cols,t);if(j<rows&&i<cols){const k=j*(cols+1)+i;idx.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const torso=new T.Mesh(g,shirt);torso.castShadow=true;body.add(torso);
 const seamMat=shirt.clone();seamMat.color.set(0xbfc6b3);
 const hem=[];for(let i=0;i<=64;i++){const k=i*3;hem.push([pos[k],pos[k+1]+.013,pos[k+2]]);}const hemMesh=seam(body,hem,.0018,seamMat);
 const collar=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;collar.push([Math.sin(a)*.079,1.495,Math.cos(a)*.061+.05]);}const collarMesh=seam(body,collar,.004,shirt);
 ell(body,0,.89,.025,.146,.09,.087,pants);
 const neck=link(body,[0,1.47,.05],[0,1.61,.07],.059,.059,skin);
 const head=new T.Group();head.position.set(0,1.72,.055);body.add(head);
 ell(head,0,0,-.012,.099,.133,.092,skin);
 // Nose bridge, cheeks, brow and chin are represented in the projection surface.
 const fp=[],fu=[],fi=[];for(let j=0;j<=48;j++)for(let i=0;i<=40;i++){
  const u=i/40,v=j/48,x=(u-.5)*2,y=(v-.5)*2;
  const width=.094*(.72+.28*Math.sqrt(Math.max(0,1-Math.pow(y*.85,2))));
  const cheek=.066*Math.sqrt(Math.max(0,1-x*x*.85));
  const nose=.042*Math.exp(-x*x*40-Math.pow(y+.06,2)*15);
  const chin=.009*Math.exp(-x*x*8-Math.pow(y+.76,2)*36);
  fp.push(x*width,y*.122,cheek+nose+chin+.014);fu.push(u,v);
  if(j<48&&i<40){const k=j*41+i;fi.push(k,k+1,k+41,k+1,k+42,k+41);}
 }
 const fg=new T.BufferGeometry();fg.setAttribute('position',new T.Float32BufferAttribute(fp,3));fg.setAttribute('uv',new T.Float32BufferAttribute(fu,2));fg.setIndex(fi);fg.computeVertexNormals();
 const face=new T.Mesh(fg,new T.MeshStandardMaterial({map:faceMap,color:0xffffff,roughness:.94}));head.add(face);face.castShadow=true;
 // Ears remain beneath the side hair and are not rendered through its surface.
 // A continuous textured hair volume carries fine strands; sparse loose locks soften its edge.
 const hairGroup=new T.Group();head.add(hairGroup);
 const hairBump=hairMap.clone();hairBump.colorSpace=T.NoColorSpace;hairBump.needsUpdate=true;
 const hairSurface=new T.MeshPhysicalMaterial({map:hairMap,color:0xffffff,roughness:.65,bumpMap:hairBump,bumpScale:.0007,sheen:.35,sheenColor:0x655144,sheenRoughness:.5,side:T.DoubleSide});
 const hp=[],hu=[],hi=[],hairRows=48,hairCols=96;
 function hairPoint(a,t){
  const back=T.MathUtils.smoothstep(-Math.cos(a),-.72,-.25),length=.143+back*(.190+.020*Math.sin(a*7));
  const crown=Math.sqrt(Math.min(1,t/.24)),wave=Math.pow(Math.max(0,(t-.32)/.68),1.2);
  const r=(.107+.018*Math.pow(Math.sin(a),4))*crown+.014*wave+Math.sin(a*9+t*9)*.011*wave;
  const angle=a+Math.sin(t*8+a*6)*.09*wave;
  return new T.Vector3(Math.sin(angle)*r,.137-length*t+Math.sin(a*9+t*6)*.008*wave,Math.cos(angle)*r-.014);
 }
 for(let j=0;j<=hairRows;j++)for(let i=0;i<=hairCols;i++){
  const t=j/hairRows,a=i/hairCols*Math.PI*2,p=hairPoint(a,t);hp.push(...p.toArray());hu.push(i/hairCols,1-t);
  if(j<hairRows&&i<hairCols){const k=j*(hairCols+1)+i;hi.push(k,k+hairCols+1,k+1,k+1,k+hairCols+1,k+hairCols+2);}
 }
 const hg=new T.BufferGeometry();hg.setAttribute('position',new T.Float32BufferAttribute(hp,3));hg.setAttribute('uv',new T.Float32BufferAttribute(hu,2));hg.setIndex(hi);hg.computeVertexNormals();
 const hairMesh=new T.Mesh(hg,hairSurface);hairMesh.castShadow=hairMesh.receiveShadow=true;hairGroup.add(hairMesh);
 const curls=[];
 for(let n=0;n<30;n++){
  const a=.95+n/29*4.38,points=[];
  for(let j=0;j<=18;j++){const t=.35+j/18*.65,p=hairPoint(a,t),w=(t-.35)/.65;p.x+=Math.sin(w*10+a*7)*.013*w;p.z+=Math.cos(w*10+a*7)*.012*w;points.push(p);}
  const curve=new T.CatmullRomCurve3(points),geo=new T.TubeGeometry(curve,24,.0028,5,false);curls.push(geo);
 }
 const wisps=new T.Mesh(mergeGeometries(curls),hair);wisps.castShadow=true;hairGroup.add(wisps);curls.forEach(g=>g.dispose());
 const legs=[];for(const s of [-1,1]){
  const rig=trouserLeg(root,s,pants),foot=rig.foot;
  ell(foot,0,.008,.052,.061,.047,.128,shoe);ell(foot,0,-.025,.052,.062,.013,.13,sole);
  for(let j=0;j<4;j++)link(foot,[-.035,.042,.033+j*.022],[.035,.042,.043+j*.022],.0025,.0025,sole);
  legs.push(rig);
 }
 for(const s of [-1,1]){
  const shoulder=[s*.165,1.423,.055],elbow=[s*.245,1.20,.23],wrist=[s*.245,1.08,.48];
  link(body,shoulder,[s*.245,1.215,.215],.100,.095,shirt);
  link(body,[s*.22,1.31,.15],elbow,.055,.042,skin);ell(body,...elbow,.044,.045,.043,skin);
  link(body,elbow,wrist,.043,.029,skin);ell(body,s*.245,1.08,.5,.037,.035,.055,skin);
 }
 const clothBase=g.attributes.position.array.slice();
 root.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});
 return {root,head,animate(distance,speed,time,reduced){const amp=Math.min(1,Math.abs(speed)/.6);const phase=distance/.7666666667;for(const{leg,shin,foot,s}of legs){
  const cycle=(phase+(s<0?.5:0))%1,stance=cycle<.6;
  const stride=(stance?.23-cycle/.6*.46:-.23+((cycle-.6)/.4)*.46)*amp*Math.sign(speed||1);
  const lift=stance?0:Math.sin((cycle-.6)/.4*Math.PI)*.10*amp;
  const dy=.038+lift-.88,dz=stride,dist=Math.min(.858,Math.hypot(dy,dz));
  const base=Math.atan2(dz,-dy),bend=Math.acos(T.MathUtils.clamp(dist/(2*.43),-1,1));
  leg.rotation.x=-(base+bend);shin.rotation.x=bend*2;foot.rotation.x=-(leg.rotation.x+shin.rotation.x);
 }body.position.y=reduced?0:Math.sin(time*1.7)*.0015;
 if(!reduced){const v=g.attributes.position;for(let i=0;i<v.count;i++){const y=clothBase[i*3+1],weight=Math.max(0,(1.32-y)/.6);v.setZ(i,clothBase[i*3+2]+Math.sin(time*3.2+clothBase[i*3]*8)*.003*weight*amp);}v.needsUpdate=true;g.computeVertexNormals();}
 hairGroup.rotation.z=reduced?0:Math.sin(time*2.2)*amp*.013;head.rotation.y=Math.sin(time*.5)*.018;},firstPerson(on){head.visible=!on;torso.visible=!on;neck.visible=!on;hemMesh.visible=!on;collarMesh.visible=!on;}};
}
