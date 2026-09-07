import * as T from 'three';
// Wind applies to both visible leaves and their directional-light shadow geometry.
export function animateFoliage(scene){
 const time={value:0},materials=new Set(),depths=[];
 function patch(shader){shader.uniforms.foliageTime=time;shader.vertexShader='uniform float foliageTime;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#ifdef USE_INSTANCING
   vec3 leafWorld=(instanceMatrix*vec4(transformed,1.)).xyz;
   float sway=sin(foliageTime*.86+leafWorld.x*.43+leafWorld.z*.61)*.022;
   sway+=sin(foliageTime*2.1+leafWorld.x*7.+leafWorld.y*2.3)*.003;
   transformed.x+=sway*smoothstep(.05,2.5,leafWorld.y)/max(.01,length(instanceMatrix[0].xyz));
   #endif
   #include <project_vertex>`);
 }
 scene.traverse(o=>{if(o.isInstancedMesh&&(o.userData.gardenWind||!o.userData.gardenAsset&&o.material.side===T.DoubleSide)){
  materials.add(o.material);const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:o.material.side,map:o.material.map,alphaMap:o.material.alphaMap,alphaTest:o.material.alphaTest});
  depth.onBeforeCompile=patch;depth.customProgramCacheKey=()=> 'sim-foliage-depth-v20';o.customDepthMaterial=depth;depths.push(depth);
 }});
 materials.forEach(m=>{m.onBeforeCompile=patch;m.customProgramCacheKey=()=> 'sim-foliage-v20';});
 return {update:t=>{time.value=t;},dispose:()=>depths.forEach(d=>d.dispose())};
}
