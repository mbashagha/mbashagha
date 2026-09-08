import * as T from 'three';
import {KTX2Loader} from './vendor/KTX2Loader.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.mjs';

export async function loadGardenMaps(renderer,{legacy=false}={}){
 const images=new T.TextureLoader(),compressed=new KTX2Loader().setTranscoderPath('./vendor/basis/').setWorkerLimit(2).detectSupport(renderer),maps={};
 async function load(name,base,color=true){
  let texture;
  try{texture=await compressed.loadAsync('./assets/garden/'+base+'.ktx2');}
  catch{try{texture=await images.loadAsync('./assets/garden/'+base+'.jpg');}catch{return;}}
  texture.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());maps[name]=texture;
 }
 try{
  const surfaces=legacy?['plaster','turf','fabric','bark','paving','limestone']:['plaster','paving'];
  // Enqueue every independent request together. The transcoder's two workers
  // already bound decode concurrency; waiting for material families just adds RTTs.
  const jobs=surfaces.map(n=>load(n,n));
  if(legacy)jobs.push(...['mo-face','hair-strands'].map(async n=>{maps[n]=await images.loadAsync('./assets/'+n+'.png');maps[n].colorSpace=T.SRGBColorSpace;maps[n].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());maps[n].wrapS=maps[n].wrapT=T.RepeatWrapping;}));
  jobs.push(...(legacy?['terrain','stone','wood']:['terrain','stone']).flatMap(n=>['Color','Normal','Roughness'].map(c=>load(n+c,n+'-'+c.toLowerCase(),c==='Color'))));
  jobs.push(...['color','normal','roughness'].map(async name=>{
   let texture;try{texture=await compressed.loadAsync('./assets/garden-v2/lawn-'+name+'.ktx2');}catch{try{texture=await images.loadAsync('./assets/garden-v2/lawn-'+name+'.jpg');}catch{return;}}
   texture.colorSpace=name==='color'?T.SRGBColorSpace:T.NoColorSpace;
   texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(10,12);
   texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
   maps['lawn'+name[0].toUpperCase()+name.slice(1)]=texture;
  }));
  await Promise.all(jobs);
  if(!maps.lawnColor&&!maps.turf){await load('turf','turf');if(!maps.turf){maps.turf=new T.DataTexture(new Uint8Array([74,101,32,255]),1,1);maps.turf.colorSpace=T.SRGBColorSpace;maps.turf.needsUpdate=true;}}
  if(legacy)try{maps.irradiance=await images.loadAsync('./assets/garden/irradiance.png');maps.irradiance.channel=1;maps.irradiance.colorSpace=T.NoColorSpace;}catch{}
  // A failed optional compressed asset does not prevent the original game loading.
  await Promise.all(surfaces.filter(n=>!maps[n]).map(async n=>{maps[n]=await images.loadAsync('./assets/'+n+'.png');maps[n].colorSpace=T.SRGBColorSpace;maps[n].wrapS=maps[n].wrapT=T.RepeatWrapping;}));
  return maps;
 }finally{compressed.dispose();}
}
export async function loadGardenMower(fallback){
 try{const asset=await new GLTFLoader().loadAsync('./assets/garden/mower.glb');const wheels=[];
  asset.scene.traverse(o=>{if(o.name.startsWith('wheel_'))wheels.push(o);if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return {root:asset.scene,wheels};
 }catch{return fallback();}
}
export async function loadGardenCharacter(fallback){
 try{
  const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('./assets/garden-v2/mo-wavy-packed.glb?v=22');
  const root=gltf.scene,mixer=new T.AnimationMixer(root);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material.alphaTest>0)o.material.alphaToCoverage=true;
   // Keep the authored curl highlights. Tint the sheen so the HDR sky does not
   // turn dark hair pale, without flattening its roughness/specular response.
   if(/hair|dark waves|dark curls/i.test(o.material.name)){if(o.material.sheen)o.material.sheen=Math.min(.025,o.material.sheen);o.material.sheenColor?.set(0x32251f);o.material.envMapIntensity=.6;}
   else if(o.material.sheen)o.material.sheen=.12;
  }});
  const walkClip=gltf.animations.find(c=>/push|walk/i.test(c.name)),idleClip=gltf.animations.find(c=>/idle/i.test(c.name));
  const walk=walkClip?mixer.clipAction(walkClip).play():null,idle=idleClip?mixer.clipAction(idleClip).play():null;
  let blend=0,stride=.6774193548;root.traverse(o=>{if(o.userData.metres_per_walk_cycle)stride=o.userData.metres_per_walk_cycle;});
  return {root,source:'authored',revision:22,firstPerson(hidden){root.visible=!hidden;},animate(distance,speed,time,reduced){
   blend+=(Math.min(1,Math.abs(speed)*3)-blend)*.18;
   if(walk){walk.setEffectiveWeight(blend);walk.time=reduced?0:T.MathUtils.euclideanModulo(distance/stride*walkClip.duration,walkClip.duration);}
   if(idle){idle.setEffectiveWeight(1-blend);idle.time=reduced?0:time%Math.max(.01,idleClip.duration);}
   mixer.update(0);
  }};
 }catch(error){console.error('Authored character failed to load',error);return fallback();}
}
