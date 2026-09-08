import * as T from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.mjs';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {OBSTACLES} from './sim-world.mjs';

const base='./assets/garden-v2/';
const edge=z=>10.17+.14*Math.sin(z*.29)+.075*Math.cos(z*.71);

function repeatTexture(texture,x,y){if(!texture)return null;const t=texture.clone();t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(x,y);t.needsUpdate=true;return t;}

// The asset remains editable in Blender. Browser instances share its real mesh
// and textured materials, while the layout remains deterministic and lightweight.
function placeAsset(scene,asset,placements,{name='plant',shadow=true,wind=false,bucket=false,low=null}={}){
 if(name.startsWith('border_')&&!bucket){
  const groups=new Map();
  for(const p of placements){const k=Math.floor(p.x/5)+','+Math.floor(p.z/5);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
  return [...groups.values()].flatMap(list=>placeAsset(scene,asset,list,{name,shadow,wind,bucket:true,low}));
 }
 asset.updateMatrixWorld(true);const meshes=[],lowGeometry=new Map();low?.traverse(o=>{if(o.isMesh)lowGeometry.set(o.material.name,o.geometry);});
 asset.traverse(source=>{
  if(!source.isMesh)return;
  const material=source.material.clone();
  if(material.alphaMap||material.alphaTest>0||material.transparent&&material.map){
   material.transparent=false;material.opacity=1;material.alphaTest=name.includes('tree')?(name.includes('background')?.10:.25):.35;
   material.alphaToCoverage=true;material.side=T.DoubleSide;material.shadowSide=T.DoubleSide;
  }
  material.envMapIntensity=.55;
  if(material.alphaTest>0){material.color.set(0xc4d2a8);material.roughness=.95;}
  else material.side=T.FrontSide;
  const mesh=new T.InstancedMesh(source.geometry,material,placements.length);
  mesh.name=name+'_'+source.name;const placement=new T.Matrix4(),q=new T.Quaternion(),up=new T.Vector3(0,1,0),scale=new T.Vector3(),p=new T.Vector3();
  for(let i=0;i<placements.length;i++){
   const v=placements[i];p.set(v.x,v.y||0,v.z);q.setFromAxisAngle(up,v.rotation||0);scale.setScalar(v.scale||1);
   placement.compose(p,q,scale).multiply(source.matrixWorld);mesh.setMatrixAt(i,placement);
  }
  mesh.castShadow=shadow;mesh.receiveShadow=true;
  mesh.userData.gardenAsset=true;mesh.userData.gardenWind=wind&&(material.alphaTest>0);
  mesh.userData.detailGeometry=source.geometry;mesh.userData.lowGeometry=lowGeometry.get(source.material.name)||source.geometry;
  mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);
 });
 return meshes;
}

function buildLand(scene,maps,random){
 const batches=new Map();
 const stone=new T.MeshStandardMaterial({map:repeatTexture(maps.stoneColor,1,1),normalMap:repeatTexture(maps.stoneNormal,1,1),roughnessMap:repeatTexture(maps.stoneRoughness,1,1),normalScale:new T.Vector2(.75,.75),roughness:1,color:0xe0d7bb});
 const cap=new T.MeshStandardMaterial({color:0xbab097,map:maps.plaster,roughness:.93});
 const soil=new T.MeshStandardMaterial({color:0xb5a78d,map:repeatTexture(maps.terrainColor,2,2),normalMap:repeatTexture(maps.terrainNormal,2,2),roughnessMap:repeatTexture(maps.terrainRoughness,2,2),roughness:1,normalScale:new T.Vector2(.35,.35)});
 const brick=new T.MeshStandardMaterial({color:0x938166,map:maps.paving,roughness:.98});
 function box(x,y,z,w,h,d,material,bevel=.015){
  const geometry=new RoundedBoxGeometry(w,h,d,2,bevel),uv=geometry.attributes.uv;
  if(material===stone){const pos=geometry.attributes.position,norm=geometry.attributes.normal;for(let i=0;i<uv.count;i++){
   const facingX=Math.abs(norm.getX(i))>.65;uv.setXY(i,(facingX?pos.getZ(i)+z:pos.getX(i)+x)/2,(pos.getY(i)+y)/2);
  }}
  geometry.translate(x,y,z);if(!batches.has(material))batches.set(material,[]);batches.get(material).push(geometry);
 }
 // The same complete PBR surface spans each wall; no random checkerboard tint.
 box(-12.65,1.15,0,.43,2.3,30,stone,.045);box(12.65,1.15,0,.43,2.3,30,stone,.045);
 box(0,1.15,-15.0,25.7,2.3,.43,stone,.045);
 for(const x of [-12.65,12.65])box(x,2.34,0,.61,.12,30.2,cap,.025);
 box(0,2.34,-15,25.9,.12,.61,cap,.025);
 for(const side of [-1,1]){
  const p=[],uv=[],indices=[];
  for(let i=0;i<=100;i++){
   const z=-13.1+i*.27,x=edge(z);p.push(side*x,-.009,z,side*12.42,-.009,z);uv.push(x*.8,z*.8,12.42*.8,z*.8);
   if(i<100){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  const bed=new T.BufferGeometry();bed.setAttribute('position',new T.Float32BufferAttribute(p,3));bed.setAttribute('uv',new T.Float32BufferAttribute(uv,2));bed.setIndex(indices);bed.computeVertexNormals();
  const m=soil.clone();m.side=T.DoubleSide;const mesh=new T.Mesh(bed,m);mesh.receiveShadow=true;scene.add(mesh);
  for(let i=0;i<89;i++){const z=-12.2+i*.292;box(side*edge(z),.018,z,.19,.095,.276,brick,.014);}
 }
 box(0,-.09,-13.5,25,.16,2.75,soil,.01);
 for(let i=0;i<72;i++)box(-10.4+i*.292,.018,-12.18,.276,.095,.19,brick,.012);
 // Low ground outside the enclosure removes the empty horizon without a green slab in the lawn.
 const outside=new T.Mesh(new T.PlaneGeometry(180,180),new T.MeshStandardMaterial({color:0x465038,roughness:1}));outside.rotation.x=-Math.PI/2;outside.position.y=-.20;outside.receiveShadow=true;scene.add(outside);
 for(const o of OBSTACLES){const g=new T.CylinderGeometry(o.r*.90,o.r*.94,.04,40);g.translate(o.x,-.012,o.z);if(!batches.has(soil))batches.set(soil,[]);batches.get(soil).push(g);}
 for(const [material,list] of batches){const geo=mergeGeometries(list.map(g=>g.index?g.toNonIndexed():g));const mesh=new T.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);list.forEach(g=>g.dispose());}
 const pebble=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({color:0x776b53,roughness:1}),450),dummy=new T.Object3D();
 for(let i=0;i<450;i++){const z=-12+random()*24;dummy.position.set((i%2?-1:1)*(edge(z)+.15+random()*.7),.006,z);dummy.rotation.set(random()*3,random()*6,random()*3);dummy.scale.set(.016+random()*.025,.01+random()*.014,.018+random()*.035);dummy.updateMatrix();pebble.setMatrixAt(i,dummy.matrix);}
 pebble.receiveShadow=true;scene.add(pebble);
}

export async function loadGardenEnvironmentAssets(){
 const response=await fetch(base+'manifest.json?v=23');if(!response.ok)throw new Error('Garden asset manifest unavailable');const manifest=await response.json();
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),assets={};
 await Promise.all(Object.entries(manifest.models).map(async([key,file])=>{const revision=key.endsWith('Low')&&manifest.loadingRevision?'?v='+encodeURIComponent(manifest.loadingRevision):'';assets[key]=(await loader.loadAsync(base+file+revision)).scene;}));
 return {manifest,assets};
}

export function buildGardenEnvironment(scene,maps,random,{manifest,assets}){
 // LODs share photographic textures; only their geometric detail differs.
 if(assets.treeLow){const materials=new Map();assets.tree.traverse(o=>{if(o.isMesh)materials.set(o.material.name,o.material);});assets.treeLow.traverse(o=>{if(o.isMesh&&materials.has(o.material.name))o.material=materials.get(o.material.name);});}
 buildLand(scene,maps,random);
 const pavilion=assets.pavilion;pavilion.name='Blender_pavilion';
 pavilion.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;if(/glaz|glass/i.test(o.name)||/glaz|glass/i.test(o.material.name)){
  o.material=new T.MeshPhysicalMaterial({name:'Garden glazing',color:0xc4d0c9,metalness:0,roughness:.10,transparent:true,opacity:.22,depthWrite:false,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:.8});o.castShadow=false;o.userData.gardenGlass=true;
 }});scene.add(pavilion);
 const trees=[];
 for(const o of OBSTACLES)trees.push({x:o.x,z:o.z,scale:1,rotation:random()*6.28});
 const treeHeight=new T.Box3().setFromObject(assets.tree).getSize(new T.Vector3()).y;
 trees.forEach((t,i)=>t.scale=(i?7.1:7.6)/treeHeight);
 placeAsset(scene,assets.tree,trees,{name:'foreground_tree',wind:true});
 const back=[];
 for(let i=0;i<7;i++)back.push({x:-18+i*5.7,z:26+random()*3,scale:(8.5+random()*3)/treeHeight,rotation:random()*6.28});
 for(const side of [-1,1])for(let i=0;i<6;i++)back.push({x:side*(15.5+random()*1.5),z:-15+i*6,scale:(7.3+random()*2.5)/treeHeight,rotation:random()*6.28});
 for(let i=0;i<5;i++)back.push({x:-14+i*7,z:-19.5-random()*2,scale:(8+random()*3)/treeHeight,rotation:random()*6.28});
 for(let i=0;i<8;i++)back.push({x:-23+i*6.3,z:33+random()*5,scale:(11+random()*4)/treeHeight,rotation:random()*6.28});
 placeAsset(scene,assets.treeLow||assets.tree,back,{name:'background_tree',wind:true,shadow:false});
 const plants=[],types=['sorrel','shrub','flowers','tuft'].filter(k=>assets[k]);
 for(const [ti,key] of types.entries()){
  const placements=[],height=new T.Box3().setFromObject(assets[key]).getSize(new T.Vector3()).y;
  const wanted={sorrel:.26,shrub:.97,flowers:.77,tuft:.68}[key];
  for(const side of [-1,1])for(let i=0;i<128;i++){
   const z=-12.3+i*.204+(random()-.5)*.62;
   // Species occupy overlapping drifts instead of equal rows of repeated objects.
   const wave=Math.sin(z*.62+ti*1.9);if(wave<-.40&&random()<.75)continue;
   const x=side*(edge(z)+.23+ti*.19+random()*1.03);
   placements.push({x,z,y:.005,scale:wanted/Math.max(.05,height)*(.72+random()*.60),rotation:random()*6.28});
  }
  for(let i=0;i<42;i++)placements.push({x:-11.4+i*.55+(random()-.5)*.4,z:-12.5-random()*1.7,y:.005,scale:wanted/Math.max(.05,height)*(.7+random()*.6),rotation:random()*6.28});
  plants.push(...placeAsset(scene,assets[key],placements,{name:'border_'+key,wind:true,low:assets[key+'Low']}));
 }
 for(const x of [-6,6]){const lamp=new T.PointLight(0xffc68a,0,8,2);lamp.position.set(x,2.4,16.2);lamp.userData.gardenLamp=true;scene.add(lamp);}
 return {manifest,assets,pavilion,update(camera,tier){
  for(const mesh of plants){const distance=mesh.boundingSphere.center.distanceTo(camera.position);mesh.castShadow=distance<(tier==='high'?12:7);mesh.geometry=distance<(tier==='high'?7:4)?mesh.userData.detailGeometry:mesh.userData.lowGeometry;}
 }};
}
