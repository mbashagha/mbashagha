import * as T from 'three';
import {WheelTracks} from './grass-effects.mjs';

// Geometry and the shadow pass share exactly the same deformation.
const declaration=`attribute vec4 blade;attribute vec4 bladeShape; uniform sampler2D mowMask;uniform float gardenTime;
uniform sampler2D trackMap;uniform vec3 mowerPosition;varying float bladeHeight;varying float cutAmount;`;
const deformation=`
float h=position.y;
float cut=texture2D(mowMask,vec2(blade.x/20.+.5,blade.y/24.+.5)).r;
float wind=(sin(blade.x*.53+blade.y*.32-gardenTime*1.15)+.35*sin(blade.y*1.7+gardenTime*.67))*.018;
float nearMower=1.-smoothstep(.3,.95,distance(vec2(blade.x,blade.y),mowerPosition.xz));
float track=texture2D(trackMap,vec2(blade.x/20.+.5,blade.y/24.+.5)).r;
float height=mix(blade.z,.028,cut)*(1.-nearMower*.4)*(1.-track*.30);
float bend=(bladeShape.y+wind)*(1.-cut*.94)*h*h;
float side=position.x*bladeShape.x;
float fold=sin(h*3.14159)*bladeShape.z;
vec3 transformed=vec3(blade.x+side*cos(blade.w)+bend*sin(blade.w),height*h-fold*(1.-cut),blade.y-side*sin(blade.w)+bend*cos(blade.w));
bladeHeight=h;cutAmount=cut;`;

export function createGrass(scene,mask,random,maps,free=()=>true){
  const tracks=new WheelTracks(),trackMap=new T.DataTexture(tracks.data,tracks.n,tracks.n,T.RedFormat);trackMap.magFilter=trackMap.minFilter=T.LinearFilter;trackMap.needsUpdate=true;let lastTime=0;
  const uniforms={trackMap:{value:trackMap},mowMask:{value:mask},gardenTime:{value:0},mowerPosition:{value:new T.Vector3(0,0,-8)}};
  const material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,side:T.DoubleSide,roughness:.87});
  function patch(shader,depth=false){
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=declaration+'\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',deformation);
    if(!depth){
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`vec3 objectNormal=normalize(vec3(sin(blade.w),.24+position.y*.38,cos(blade.w)));`);
      shader.fragmentShader='varying float bladeHeight;varying float cutAmount;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
       diffuseColor.rgb*=mix(.52,1.08,smoothstep(0.,.9,bladeHeight));
       diffuseColor.rgb*=mix(vec3(1.),vec3(1.08,1.035,.90),cutAmount);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`// Modest thin-leaf transmission; direct shadows remain authoritative.
       #if NUM_DIR_LIGHTS > 0
       float backlight=pow(max(0.,dot(-geometryViewDir,directionalLights[0].direction)),3.);
       outgoingLight+=diffuseColor.rgb*directionalLights[0].color*backlight*bladeHeight*.075;
       #endif
       #include <opaque_fragment>`);
    }
  }
  material.onBeforeCompile=s=>patch(s);material.customProgramCacheKey=()=> 'garden-grass-v20';
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});
  depth.onBeforeCompile=s=>patch(s,true);depth.customProgramCacheKey=()=> 'garden-grass-depth-v20';
  const chunks=[],p=[],uv=[],indices=[];
  for(let i=0;i<5;i++){const h=i/4,w=.013*(1-h)+.0003;p.push(-w,h,0,w,h,0);uv.push(0,h,1,h);if(i<4){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
  for(let z=0;z<6;z++)for(let x=0;x<5;x++){
    const geo=new T.InstancedBufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    const count=10500,blades=new Float32Array(count*4),shapes=new Float32Array(count*4),colors=new Float32Array(count*3),color=new T.Color();
    for(let i=0;i<count;i++){
      let bx,bz;do{bx=-10+x*4+random()*4;bz=-12+z*4+random()*4;}while(!free(bx,bz));
      const patch=(Math.sin(bx*.7+bz*.32)+Math.sin(bz*1.15-bx*.4))*.5;
      const variety=random(),height=.055+random()*.10+(patch+1)*.018;
      blades.set([bx,bz,height,random()*Math.PI*2],i*4);
      shapes.set([.27+variety*.48,.01+random()*.065,variety>.8?.009:0,variety],i*4);
      const dry=random()<.016;
      color.setHSL(dry?.12:.218+patch*.010+random()*.024,dry?.32:.48+random()*.14,.225+random()*.085+patch*.019,T.SRGBColorSpace);
      colors.set([color.r,color.g,color.b],i*3);
    }
    geo.setAttribute('blade',new T.InstancedBufferAttribute(blades,4));geo.setAttribute('bladeShape',new T.InstancedBufferAttribute(shapes,4));geo.setAttribute('color',new T.InstancedBufferAttribute(colors,3));geo.instanceCount=count;
    geo.boundingBox=new T.Box3(new T.Vector3(-10+x*4-.2,0,-12+z*4-.2),new T.Vector3(-6+x*4+.2,.45,-8+z*4+.2));geo.boundingSphere=geo.boundingBox.getBoundingSphere(new T.Sphere());
    const lods=[geo];
    for(const segments of [2,1]){
      const g=new T.InstancedBufferGeometry(),lp=[],lu=[],li=[];
      for(let j=0;j<=segments;j++){const h=j/segments,w=.013*(1-h)+.0003;lp.push(-w,h,0,w,h,0);lu.push(0,h,1,h);if(j<segments){const a=j*2;li.push(a,a+1,a+2,a+1,a+3,a+2);}}
      g.setAttribute('position',new T.Float32BufferAttribute(lp,3));g.setAttribute('uv',new T.Float32BufferAttribute(lu,2));g.setIndex(li);g.computeVertexNormals();
      for(const name of ['blade','bladeShape','color'])g.setAttribute(name,geo.getAttribute(name));
      g.boundingBox=geo.boundingBox;g.boundingSphere=geo.boundingSphere;g.instanceCount=count;lods.push(g);
    }
    const mesh=new T.Mesh(geo,material);mesh.receiveShadow=true;mesh.customDepthMaterial=depth;scene.add(mesh);chunks.push({mesh,lods,count,center:geo.boundingSphere.center});
  }
  const turf=maps.lawnColor||maps.turf;turf.repeat.set(10,12);
  const groundMat=new T.MeshStandardMaterial({map:turf,normalMap:maps.lawnNormal||null,roughnessMap:maps.lawnRoughness||null,normalScale:new T.Vector2(.4,.4),roughness:1,color:0xbbc19a});
  groundMat.onBeforeCompile=shader=>{
    shader.uniforms.mowMask=uniforms.mowMask;shader.uniforms.trackMap=uniforms.trackMap;
    shader.vertexShader='varying vec2 lawnUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlawnUv=vec2(position.x/20.+.5,.5-position.y/24.);');
    shader.fragmentShader='varying vec2 lawnUv;uniform sampler2D mowMask,trackMap;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
     float m=texture2D(mowMask,lawnUv).r;float stripe=.94+.06*cos(lawnUv.x*62.8318);
     float broad=.91+.055*sin(lawnUv.x*19.+sin(lawnUv.y*11.))+.035*cos(lawnUv.y*35.);
     diffuseColor.rgb*=broad*mix(.85,stripe,m)*(1.-texture2D(trackMap,lawnUv).r*.09);`);
  };
  const groundGeo=new T.PlaneGeometry(20,24);groundGeo.setAttribute("uv1",groundGeo.getAttribute("uv").clone());
  const ground=new T.Mesh(groundGeo,groundMat);ground.rotation.x=-Math.PI/2;ground.position.y=-.006;ground.receiveShadow=true;scene.add(ground);
  return {uniforms,chunks,clearTracks:()=>{tracks.data.fill(0);tracks.strength.fill(0);tracks.active.clear();trackMap.needsUpdate=true;},setNight:()=>{},trackSegment:(a,b)=>tracks.sweep(a,b),update(time,mower,camera,tier,delta){
    const dt=Math.min(.1,Math.max(0,delta??time-lastTime));lastTime=time;if(tracks.update(dt))trackMap.needsUpdate=true;
    uniforms.gardenTime.value=time;uniforms.mowerPosition.value.copy(mower);
    const density={high:1,medium:.72,low:.44}[tier];
    for(const c of chunks){const distance=c.center.distanceTo(camera.position);const desired=c.count*density*(distance>22?.38:distance>14?.65:1);c.visibleCount=c.visibleCount??desired;c.visibleCount+=(desired-c.visibleCount)*(1-Math.exp(-Math.max(.016,dt)*6));c.mesh.geometry=c.lods[distance>16?2:distance>8?1:0];c.mesh.geometry.instanceCount=Math.floor(c.visibleCount);c.mesh.castShadow=tier==='high'&&distance<9;}
  },dispose(){trackMap.dispose();material.dispose();depth.dispose();groundMat.dispose();ground.geometry.dispose();chunks.forEach(c=>c.lods.forEach(g=>g.dispose()));}};
}
