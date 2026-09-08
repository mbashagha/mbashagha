import * as T from 'three';

// A depth-aware contact shading pass. The HDR scene stays linear until the final
// output conversion; this avoids applying display gamma or tone mapping twice.
export class GardenPost {
 constructor(renderer,camera){
  this.renderer=renderer;this.camera=camera;
  this.target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthTexture:new T.DepthTexture(1,1,T.UnsignedIntType)});
  this.scene=new T.Scene();this.ortho=new T.OrthographicCamera(-1,1,1,-1,0,1);
  this.material=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{colorMap:{value:this.target.texture},depthMap:{value:this.target.depthTexture},invProjection:{value:camera.projectionMatrixInverse},resolution:{value:new T.Vector2()},aoStrength:{value:.65}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
   varying vec2 vUv;uniform sampler2D colorMap,depthMap;uniform mat4 invProjection;uniform vec2 resolution;uniform float aoStrength;
   vec3 viewPoint(vec2 uv,float d){vec4 p=invProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
   void main(){vec3 color=texture2D(colorMap,vUv).rgb;float depth=texture2D(depthMap,vUv).x;
    if(depth<.99999){vec3 p=viewPoint(vUv,depth);vec3 normal=normalize(cross(dFdx(p),dFdy(p)));float occlusion=0.;
     float angle=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)*6.283;
     float radius=min(.055,.45/max(.4,-p.z));
     for(int i=0;i<12;i++){float a=angle+float(i)*2.39996;vec2 offset=vec2(cos(a)*resolution.y/resolution.x,sin(a))*radius*(.22+float(i)/15.);
      vec2 qUv=clamp(vUv+offset,vec2(.001),vec2(.999));float qDepth=texture2D(depthMap,qUv).x;vec3 q=viewPoint(qUv,qDepth);vec3 delta=q-p;float dist=length(delta);
      float facing=max(0.,dot(normal,delta/max(dist,.0001))-.12);occlusion+=facing*(1.-smoothstep(.02,.55,dist));}
     color*=1.-clamp(occlusion/12.*aoStrength*3.,0.,.48);
    }
    float vignette=1.-.17*smoothstep(.22,.82,length((vUv-.5)*vec2(1.,.85)));color*=vignette;
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
  this.scene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.material));
 }
 setQuality(quality){
  // Canvas antialiasing does not apply to this offscreen scene target.
  // Keep multisampling on touch devices too; clamp to the actual GPU capability.
  let samples=Math.min(quality.samples,this.renderer.capabilities.maxSamples);
  const gl=this.renderer.getContext?.();
  if(gl?.getInternalformatParameter){
   const supported=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
   samples=Math.max(0,...supported.filter(n=>n<=samples));
  }
  if(samples!==this.target.samples){this.target.dispose();this.target.samples=samples;}
 }
 setSize(w,h){const d=this.renderer.getPixelRatio();this.target.setSize(Math.round(w*d),Math.round(h*d));this.material.uniforms.resolution.value.set(w*d,h*d);}
 render(scene){
  // Count the scene, shadows and final pass as one frame, instead of reporting
  // only the fullscreen triangle/quad after Three resets its counters.
  const info=this.renderer.info,autoReset=info.autoReset;info.autoReset=false;info.reset();
  this.renderer.setRenderTarget(this.target);this.renderer.render(scene,this.camera);
  this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.ortho);
  this.metrics={calls:info.render.calls,triangles:info.render.triangles,textures:info.memory.textures,geometries:info.memory.geometries};
  info.autoReset=autoReset;
 }
 dispose(){this.target.dispose();this.material.dispose();}
}

// Recovery mode renders directly to the canvas: no floating-point,
// multisampled offscreen framebuffer or depth-texture postprocessing.
export class BasicGardenPost {
 constructor(renderer,camera){this.renderer=renderer;this.camera=camera;this.metrics={calls:0,triangles:0,textures:0,geometries:0};}
 setQuality(){}
 setSize(){}
 render(scene){
  const info=this.renderer.info,autoReset=info.autoReset;info.autoReset=false;info.reset();
  try{this.renderer.setRenderTarget(null);this.renderer.render(scene,this.camera);
   this.metrics={calls:info.render.calls,triangles:info.render.triangles,textures:info.memory.textures,geometries:info.memory.geometries};
  }finally{info.autoReset=autoReset;}
 }
 dispose(){}
}
