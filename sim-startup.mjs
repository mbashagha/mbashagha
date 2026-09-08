import * as T from 'three';

// MessageChannel yields to input/painting without the background-tab timer
// throttling that can turn a sequence of setTimeout(0) calls into seconds.
export function yieldToBrowser(){
 return new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};channel.port2.postMessage(null);});
}

export function compileForTarget(renderer,object,camera,target,targetScene){
 const previous=renderer.getRenderTarget();
 try{
  renderer.setRenderTarget(target);
  const programs=renderer.compileAsync(object,camera,targetScene),gl=renderer.getContext();
  // Startup runs before RAF. Submit work and make one driver round trip before
  // awaiting Three r170's readiness poll: WebKit can otherwise leave this wait
  // pending until another GL operation. Never do this in the animation loop.
  gl.flush();const error=gl.getError();
  if(error!==gl.NO_ERROR)console.warn('3D startup WebGL status',error);
  return programs;
 }
 finally{renderer.setRenderTarget(previous);}
}

export async function uploadSceneTextures(renderer,scene,extra=[],yieldWork=yieldToBrowser){
 const textures=new Set(extra.filter(t=>t?.isTexture));
 scene.traverse(o=>{for(const material of [o.material,o.customDepthMaterial].flat().filter(Boolean)){
  for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  for(const uniform of Object.values(material.uniforms||{}))if(uniform.value?.isTexture)textures.add(uniform.value);
 }});
 if(scene.background?.isTexture)textures.add(scene.background);
 let count=0;
 for(const texture of textures){
  if(texture.isRenderTargetTexture)continue;
  renderer.initTexture(texture);if(++count%4===0)await yieldWork();
 }
 return count;
}

// r170 compileAsync does not visit shadow materials. These compile-only proxies
// match WebGLShadowMap's directional PCF depth variants, including skinning and
// instancing, without copying the large geometry records stored in userData.
export function createShadowWarmup(scene){
 const shadowScene=new T.Scene(),owned=new Set();
 scene.traverseVisible(o=>{if(o.isLight)shadowScene.add(o.clone());});
 scene.traverse(source=>{
  if(!source.isMesh||source.isBatchedMesh)return;
  // Include grass even before distance-based shadow selection runs.
  if(!source.castShadow&&!source.customDepthMaterial)return;
  for(const surface of [source.material].flat()){
   const custom=source.customDepthMaterial;
   const depth=custom?custom.clone():new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
   if(custom){depth.onBeforeCompile=custom.onBeforeCompile;depth.customProgramCacheKey=custom.customProgramCacheKey;}
   for(const key of ['visible','wireframe','alphaMap','alphaTest','map','clipShadows','clippingPlanes','clipIntersection','displacementMap','displacementScale','displacementBias','wireframeLinewidth','linewidth'])depth[key]=surface[key];
   depth.side=surface.shadowSide??({[T.FrontSide]:T.BackSide,[T.BackSide]:T.FrontSide,[T.DoubleSide]:T.DoubleSide}[surface.side]);
   let proxy;
   if(source.isInstancedMesh){proxy=new T.InstancedMesh(source.geometry,depth,0);proxy.instanceMatrix=source.instanceMatrix;proxy.instanceColor=source.instanceColor;proxy.morphTexture=source.morphTexture;proxy.count=source.count;}
   else if(source.isSkinnedMesh){proxy=new T.SkinnedMesh(source.geometry,depth);proxy.bindMode=source.bindMode;proxy.bindMatrix.copy(source.bindMatrix);proxy.bindMatrixInverse.copy(source.bindMatrixInverse);proxy.skeleton=source.skeleton;}
   else proxy=new T.Mesh(source.geometry,depth);
   if(source.morphTargetInfluences)proxy.morphTargetInfluences=source.morphTargetInfluences;
   if(source.morphTargetDictionary)proxy.morphTargetDictionary=source.morphTargetDictionary;
   owned.add(depth);shadowScene.add(proxy);
  }
 });
 return {scene:shadowScene,dispose(){for(const material of owned)material.dispose();owned.clear();}};
}

export function captureGardenReflection(renderer,scene,cubeCamera,hidden=[]){
 const flags=hidden.map(object=>[object,object.visible]);
 const shadows=renderer.shadowMap,autoUpdate=shadows.autoUpdate,needsUpdate=shadows.needsUpdate;
 try{
  for(const [object] of flags)object.visible=false;
  // All six faces see one static instant. Generate its shadows once, not six times.
  shadows.autoUpdate=false;shadows.needsUpdate=true;cubeCamera.update(renderer,scene);
 }finally{
  for(const [object,visible] of flags)object.visible=visible;
  shadows.autoUpdate=autoUpdate;shadows.needsUpdate=needsUpdate;
 }
}
